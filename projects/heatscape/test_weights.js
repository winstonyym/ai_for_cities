/* ============================================================
   Headless smoke test for the weighting bases.

   Boots app.js inside jsdom against the real grid_data.json and
   causal_weights.json, stubbing only maplibre and the diagram module (both need
   WebGL). It then drives the UI the way a user would -- switch between the
   Shapley and Equal presets, select a cell, drag a slider -- and asserts that
   scores change, that nothing throws, and that the two bases genuinely disagree
   about which cells are the priority.

   Also guards the reconciliation against nyc-greenery.json: no indicator or
   category may name a diagram node that does not exist, the dropped pop_den
   indicator must be gone everywhere, and the sink must be the node diagram.js
   actually animates toward.

   The Causal preset was retired; data/causal_weights.json still carries its
   estimates because it is the pipeline's own export, so a few checks here
   assert that none of it reaches the interface any more.

   Run:  node test_weights.js
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
function check(name, condition, detail) {
  const ok = !!condition;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
}

const grid = JSON.parse(read("data/grid_data.json"));
const causal = JSON.parse(read("data/causal_weights.json"));
const diagram = JSON.parse(read("data/diagram.json"));

const dom = new JSDOM(read("index.html"), {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;

// ---- stubs for the WebGL-dependent pieces -------------------------------
const noop = () => {};
class FakeMap {
  constructor() { this.handlers = {}; }
  on(evt, a, b) { this.handlers[evt] = b || a; if (evt === "load") setTimeout(() => (b || a)(), 0); }
  addSource() {} addLayer() {} setPaintProperty() {} setFeatureState() {}
  removeFeatureState() {} getCanvas() { return { style: {} }; } fitBounds() {}
  addControl() {} setFilter() {} queryRenderedFeatures() { return []; }
  getSource() { return { setData: noop }; } easeTo() {} flyTo() {}
}
window.maplibregl = {
  Map: FakeMap,
  NavigationControl: class {},
  LngLatBounds: class { extend() { return this; } },
  Popup: class { setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() {} },
};
// Read the real SINK out of diagram.js so this stub cannot drift from the
// value the app actually uses.
const SINK_ID = (read("diagram.js").match(/const SINK = "([^"]+)"/) || [])[1];
if (!SINK_ID) throw new Error("could not read SINK from diagram.js");

window.HeatscapeDiagram = {
  Diagram: class {
    constructor(el, data) { this.data = data; }
    setActive() {} resize() {} render() {} animate() {} setCell() {} clear() {}
    setActivation() { return { active: [], paths: [] }; }
    setPresentation() {} highlight() {} reset() {}
  },
  SUBSYSTEM_COLORS: {},
  SINK: SINK_ID,
};

// ---- fetch stub over the real files -------------------------------------
window.fetch = async (url) => {
  const map = {
    "./data/grid_data.json": grid,
    "./data/diagram.json": diagram,
    "./data/causal_weights.json": causal,
  };
  if (!(url in map)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => map[url] };
};
window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop }));

// ---- boot ----------------------------------------------------------------
(async function main() {
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

  window.eval(read("app.js"));
  await new Promise((r) => setTimeout(r, 700));

  const $ = (id) => window.document.getElementById(id);

  check("app booted without an error banner",
    $("loading-title").textContent !== "Could not load data",
    $("loading-message").textContent.slice(0, 120));
  check("no uncaught errors during boot", errors.length === 0, errors.join(" | "));

  const shapleyBtn = $("preset-shapley");
  const equalBtn = $("preset-equal");
  check("both weighting presets rendered", !!shapleyBtn && !!equalBtn);
  check("the retired Causal preset is gone from the markup",
    !$("preset-causal"));
  check("shapley preset is visible (payload present)",
    shapleyBtn && !shapleyBtn.classList.contains("hidden"));
  check("shapley is active on load",
    shapleyBtn.classList.contains("is-active"));
  check("weights state reads 'shapley'",
    $("weights-state").textContent === "shapley",
    $("weights-state").textContent);

  // Exactly one slider per indicator, and none for a category: the category
  // multiplier was removed, and a stray control there would silently reintroduce
  // a second weighting layer.
  const sliders = $("weight-sliders").querySelectorAll("input[type=range]");
  const expected = grid.meta.categories.reduce((n, c) => n + c.vars.length, 0);
  check("one slider per indicator and none per category",
    sliders.length === expected, `${sliders.length} vs ${expected}`);
  check("category rows render a derived readout, not a control",
    $("weight-sliders").querySelectorAll(".wrow--cat").length === grid.meta.categories.length &&
    $("weight-sliders").querySelectorAll(".wrow--cat input").length === 0);

  // ---- indicator set matches the systems diagram ------------------------
  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const meta = grid.meta;

  // canopy_height is deliberately back: the diagram gives it its own node now.
  // pop_den is deliberately gone: nyc-greenery.json dropped its node, so the
  // indicator went with it and residents enter scoring only via the pop gate.
  check("no stale indicators remain",
    !["bldg_cover", "bldg_height", "pop_den"]
      .some((v) => meta.varOrder.includes(v)));
  check("pop_den is gone from every category",
    meta.categories.every((c) => !c.vars.includes("pop_den")));
  check("pop_den is gone from the causal payload",
    !("pop_den" in causal.variables));
  check("pop_den is gone from every cell array",
    grid.cells.every((c) => c[4].length === meta.varOrder.length));
  check("the dropped diagram nodes are really absent",
    !nodeIds.has("population_density_1783691363491") &&
    !nodeIds.has("population_vulnerability_1783971475568"));
  check("the diagram is the nyc-greenery graph",
    nodeIds.has("heat_emergency_1785298152221") && diagram.nodes.length === 52,
    `${diagram.nodes.length} nodes`);

  // data/diagram.json is a copy of the authored file. Copies drift: the layout
  // was re-authored once and the app kept rendering the old positions. Compare
  // the two directly so a stale copy fails here instead of on screen.
  const SOURCE = "../scm_tut/nyc-greenery.json";
  let source = null;
  try { source = JSON.parse(read(SOURCE)); } catch (e) { /* not checked out */ }
  if (!source) {
    check(`source diagram ${SOURCE} present to compare against`, false);
  } else {
    check("served diagram matches the authored node set",
      source.nodes.length === diagram.nodes.length &&
      source.nodes.every((n) => nodeIds.has(n.id)),
      `${source.nodes.length} authored vs ${diagram.nodes.length} served`);

    const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));
    const moved = source.nodes.filter((n) => {
      const s = byId[n.id];
      return !s || Math.abs(s.x - n.x) > 1e-6 || Math.abs(s.y - n.y) > 1e-6;
    });
    check("served diagram matches the authored layout",
      moved.length === 0,
      moved.length
        ? `${moved.length} node(s) at stale positions, e.g. ${moved[0].label}: ` +
          `served (${byId[moved[0].id].x}, ${byId[moved[0].id].y}) vs authored (${moved[0].x}, ${moved[0].y})`
        : "");

    const key = (l) => `${l.source}->${l.target}:${l.polarity}`;
    const served = new Set(diagram.links.map(key));
    check("served diagram matches the authored edges",
      source.links.length === diagram.links.length &&
      source.links.every((l) => served.has(key(l))),
      `${source.links.length} authored vs ${diagram.links.length} served`);
  }

  // The layout has to be usable in the 250 px mini panel, not just in the
  // fullscreen overlay: Diagram.fit() scales to the smaller of the two axes, so
  // a very tall graph shrinks until the labels are unreadable.
  {
    const xs = diagram.nodes.map((n) => n.x), ys = diagram.nodes.map((n) => n.y);
    const w = (Math.max(...xs) + 60) - (Math.min(...xs) - 60);
    const h = (Math.max(...ys) + 70) - (Math.min(...ys) - 55);
    const k = Math.min(360 / w, 250 / h);
    check("layout is legible at mini-panel size", k > 0.12,
      `fit scale ${k.toFixed(3)} in a 360x250 panel (extent ${Math.round(w)}x${Math.round(h)})`);
  }
  check("diagram.js animates toward the heat-emergency sink",
    SINK_ID === "heat_emergency_1785298152221", SINK_ID);
  check("the sink has inbound edges",
    diagram.links.filter((l) => l.target === SINK_ID).length >= 4,
    `${diagram.links.filter((l) => l.target === SINK_ID).length} inbound`);
  check("nothing flows out of the sink",
    diagram.links.every((l) => l.source !== SINK_ID));
  check("diagram indicators are all exposed",
    ["shadow_accrual_value", "arthritis", "cancer", "disability", "depression",
     "drinking", "short_sleep", "smoking", "trans_insec", "util_insec",
     "canopy_height", "median_age"]
      .every((v) => meta.varOrder.includes(v)));
  check("every cell array matches varOrder length",
    grid.cells.every((c) => c[4].length === meta.varOrder.length &&
                            c[5].length === meta.varOrder.length));

  const unresolvedVars = meta.varOrder
    .filter((v) => !nodeIds.has(meta.variables[v].node));
  check("every indicator maps to a diagram node",
    unresolvedVars.length === 0, unresolvedVars.join(", "));
  const unresolvedCats = meta.categories
    .filter((c) => !nodeIds.has(c.node)).map((c) => c.key);
  check("every category maps to a diagram node",
    unresolvedCats.length === 0, unresolvedCats.join(", "));

  const ivVars = new Set();
  meta.interventions.forEach((iv) => Object.keys(iv.factors).forEach((f) => {
    if (!f.startsWith("cat:")) ivVars.add(f);
  }));
  const danglingIv = [...ivVars].filter((v) => !meta.varOrder.includes(v));
  check("intervention factors reference live indicators",
    danglingIv.length === 0, danglingIv.join(", "));
  const catRefs = new Set();
  meta.interventions.forEach((iv) => Object.keys(iv.factors).forEach((f) => {
    if (f.startsWith("cat:")) catRefs.add(f.slice(4));
  }));
  const danglingCat = [...catRefs]
    .filter((k) => !meta.categories.some((c) => c.key === k));
  check("intervention category factors resolve",
    danglingCat.length === 0, danglingCat.join(", "));

  // ---- the shapley basis, which is now the default ----------------------
  check("shapley payload present", !!causal.shapley);
  check("shapley targets heat emergencies",
    causal.shapley.outcome === "heat_emergency", causal.shapley.outcome);
  check("every indicator carries a shapley share",
    meta.varOrder.every((v) => causal.variables[v].shapleyShare != null),
    meta.varOrder.filter((v) => causal.variables[v].shapleyShare == null).join(", "));
  const shareSum = meta.varOrder
    .reduce((s, v) => s + causal.variables[v].shapleyShare, 0);
  check("shares sum to one", Math.abs(shareSum - 1) < 1e-4, `${shareSum}`);
  // The Shapley value IS the weight now: there is no rescaled slider number to
  // reconcile, so what has to hold is that nothing survives in the payload that
  // would let an old two-level reader keep working by accident.
  check("no rescaled slider weights remain in the payload",
    meta.varOrder.every((v) => causal.variables[v].shapleyWeight === undefined) &&
    meta.categories.every((c) => causal.categories[c.key].shapleyWeight === undefined));

  // A category's declared weight is the sum of its indicators' shares, and the
  // nine of them must still add to the whole attribution. If a variable is ever
  // filed under the wrong category, or under two, this is what catches it.
  let catSumDrift = 0, worstCat = "";
  meta.categories.forEach((c) => {
    const summed = c.vars.reduce((s, v) => s + causal.variables[v].shapleyShare, 0);
    const drift = Math.abs(summed - causal.categories[c.key].shapleyShare);
    if (drift > catSumDrift) { catSumDrift = drift; worstCat = c.key; }
  });
  check("each category share is the sum of its indicators",
    catSumDrift < 1e-5, `worst ${worstCat} off by ${catSumDrift.toExponential(2)}`);
  const catTotal = meta.categories
    .reduce((s, c) => s + causal.categories[c.key].shapleyShare, 0);
  check("category shares add to the whole attribution",
    Math.abs(catTotal - 1) < 1e-4, `${catTotal}`);
  check("every share is inside the slider range",
    meta.varOrder.every((v) => {
      const w = causal.variables[v].shapleyShare;
      return w != null && w >= 0 && w <= 0.4;
    }));

  // The headline ordering the panel claims. Pinning it means a regenerated
  // shapley_values.csv that reorders the top of the table fails loudly here
  // rather than quietly changing every priority score.
  const topShare = Object.entries(causal.variables)
    .sort((a, b) => b[1].shapleyShare - a[1].shapleyShare)
    .slice(0, 4).map(([k]) => k);
  check("the four dominant indicators are as reported",
    topShare.join(",") === "bldg_volume,ped_flow,pct_ac,poi_den",
    topShare.join(","));
  check("concentration claim matches the payload",
    Math.abs(causal.shapley.concentration -
      topShare.reduce((s, k) => s + causal.variables[k].shapleyShare, 0)) < 1e-3);
  check("zero-attribution count matches the payload",
    causal.shapley.nVars - causal.shapley.nNonZero ===
      meta.varOrder.filter((v) => causal.variables[v].shapleyShare === 0).length);

  const shapSummary = $("weights-note");
  check("shapley summary is shown on load",
    !shapSummary.classList.contains("hidden"));
  check("summary names the quantity as an attribution",
    /attribution|attributed/.test(shapSummary.textContent));
  check("summary discloses the thin resampling",
    /bootstrap replicates/.test(shapSummary.textContent));
  check("summary warns that direction is not taken from shapley",
    /unsigned/.test(shapSummary.textContent));
  check("summary breaks attribution down by category",
    shapSummary.querySelectorAll(".cshare").length === meta.categories.length,
    `${shapSummary.querySelectorAll(".cshare").length} rows`);

  // Every category needs a colour: the dot in the cell panel and the bar in the
  // Shapley summary both read from CAT_COLORS, and a missing key renders as no
  // background rather than as an error. `behav` was missing for exactly that
  // reason and nothing caught it.
  {
    const catColors = (read("app.js").match(/const CAT_COLORS = \{[\s\S]*?\};/) || [""])[0];
    const missing = meta.categories.filter((c) => !new RegExp(`\\b${c.key}\\s*:`).test(catColors));
    check("every category has a colour in CAT_COLORS",
      missing.length === 0, missing.map((c) => c.key).join(", "));
    const dots = Array.from($("weights-note").querySelectorAll(".cshare__dot"));
    check("no category bar renders without a colour",
      dots.every((d) => /rgb|#/.test(d.getAttribute("style") || "")),
      `${dots.filter((d) => !/rgb|#/.test(d.getAttribute("style") || "")).length} uncoloured`);
  }

  const shapRows = $("weight-sliders").querySelectorAll(".wev");
  check("attribution lines render under the sliders", shapRows.length > 20,
    `${shapRows.length} rows`);
  const shapText = Array.from(shapRows).map((e) => e.textContent).join(" ");
  check("zero-attribution indicators say so plainly",
    /no attribution/.test(shapText));
  check("attribution lines report a share", /% of attribution/.test(shapText));

  // Categories the decomposition all but zeroes out must actually be inert in
  // the live weights, not merely labelled that way. The test is against the
  // share the panel displays (0.0%), matching NEG_W in app.js.
  const NEG_W = 0.0005;
  const deadCats = meta.categories
    .filter((c) => causal.categories[c.key].shapleyShare < NEG_W).map((c) => c.key);
  check("negligible categories are flagged in the UI",
    deadCats.length === 0 || /barely contributing/.test(shapText),
    deadCats.join(", "));
  if (api0()) {
    const w = api0().weights();
    check("negligible categories carry a negligible summed weight in the live state",
      deadCats.every((k) => {
        const c = meta.categories.find((x) => x.key === k);
        return c.vars.reduce((s, v) => s + w[v], 0) < NEG_W;
      }), deadCats.join(", "));
  }
  function api0() { return window.__heatscapeTest; }

  // ---- the two bases must actually disagree -----------------------------
  const api = window.__heatscapeTest;
  check("test hook exposed", !!api);
  if (api) {
    api.setBasis("equal");
    const equalScores = api.scoreAll();
    api.setBasis("shapley");
    const shapleyScores = api.scoreAll();

    const n = equalScores.length;
    check("every populated cell scored under both bases",
      n > 9000 && shapleyScores.length === n, `${n} cells`);
    check("shapley scores are all finite",
      shapleyScores.every((v) => Number.isFinite(v)));

    const rank = (arr) => {
      const idx = arr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      const out = new Array(arr.length);
      idx.forEach(([, i], r) => (out[i] = r));
      return out;
    };
    const topN = Math.round(n * 0.1);
    const topSet = (arr) => {
      const r = rank(arr);
      return new Set(r.map((v, i) => [v, i]).filter(([v]) => v < topN).map(([, i]) => i));
    };
    const overlapOf = (a, b) => {
      const A = topSet(a), B = topSet(b);
      let o = 0; B.forEach((i) => { if (A.has(i)) o++; });
      return o / topN;
    };

    // Shapley must move the map, but must not scramble it: if the two bases
    // shared no more of their top decile than two random selections would, the
    // weighting would be doing all the work and the risk percentiles none.
    //
    // The floor here used to be 0.2 and the observed overlap ~0.51. Both moved
    // when the category multiplier was removed, and the cause is the Equal
    // basis, not the Shapley one. Equal now means every indicator carries the
    // same share, so a category is worth its size — and physiological
    // vulnerability and social determinants hold 23 of the 43 indicators
    // between them, i.e. 53% of the weight. Those arrive as tract-level rates,
    // so the Equal map is close to a tract health map while the Shapley map is
    // driven by footfall and built volume. The two genuinely part company; the
    // floor is now set against the 10% a coin flip would give.
    const CHANCE = 0.1;
    const se = overlapOf(equalScores, shapleyScores);
    check("shapley and equal disagree on the top 10% of cells",
      se < 0.9, `${(se * 100).toFixed(1)}% overlap`);
    check("but they are not unrelated", se > CHANCE * 1.4,
      `${(se * 100).toFixed(1)}% overlap vs ${(CHANCE * 100).toFixed(0)}% at chance`);

    const changed = equalScores.filter((v, i) => Math.abs(v - shapleyScores[i]) > 0.5).length;
    check("most cells change score under shapley", changed / n > 0.5,
      `${((changed / n) * 100).toFixed(1)}% of cells`);

    // Intervention ranking is scored from raw indicator percentiles and fixed
    // factor sets, so it must survive the pop_den removal intact.
    api.setBasis("shapley");
    const sample = api.sampleCellId();
    api.selectCell(sample);
    await new Promise((r) => setTimeout(r, 150));
    const ivCards = $("interventions").querySelectorAll(".iv");
    check("intervention ranking still renders", ivCards.length > 0,
      `${ivCards.length} ranked`);
    // Factors are the levers' raw default shares, not a renormalised list, so
    // each one must equal the share the payload gives that lever. A drifting
    // factor would silently make an intervention score on a weight the sliders
    // never show.
    let ivDrift = 0, worstLever = "";
    meta.interventions.forEach((iv) => {
      Object.entries(iv.factors).forEach(([f, w]) => {
        const want = f.startsWith("cat:")
          ? causal.categories[f.slice(4)].shapleyShare
          : causal.variables[f].shapleyShare;
        const d = Math.abs(w - want);
        if (d > ivDrift) { ivDrift = d; worstLever = `${iv.key}:${f}`; }
      });
    });
    check("intervention factors are the levers' default shapley values",
      ivDrift < 1e-5, `worst ${worstLever} off by ${ivDrift.toExponential(2)}`);
    check("no intervention keeps a zero-attribution lever",
      meta.interventions.every((iv) => Object.values(iv.factors).every((w) => w > 0)));
  }

  // ---- selecting a cell -------------------------------------------------
  if (api) {
    api.setBasis("shapley");
    api.selectCell(api.sampleCellId());
    await new Promise((r) => setTimeout(r, 200));
    const detail = $("cell-detail");
    check("cell panel opens", !detail.classList.contains("hidden"));
    const effLines = detail.querySelectorAll(".var__eff");
    check("per-indicator attribution shown in the cell panel", effLines.length > 10,
      `${effLines.length} indicators annotated`);
    check("no retired causal annotations leak into the cell panel",
      !/\bHE [+-]|\bSCM [+-]|direction (not determined|disputed)/.test(detail.textContent));

    // Clicking a tile must light up the diagram, not silently no-op.
    const act = api.activationFor(api.sampleCellId());
    const activeIds = Object.keys(act);
    check("clicking a cell activates diagram nodes", activeIds.length > 20,
      `${activeIds.length} nodes activated`);
    const strays = activeIds.filter((id) => !nodeIds.has(id));
    check("every activated node exists in the diagram",
      strays.length === 0, strays.join(", "));
    check("the sink is activated", SINK_ID in act);
    const newlyExposed = ["shadow_accrual_value", "smoking", "depression"]
      .map((v) => meta.variables[v].node);
    check("newly exposed indicators reach the diagram",
      newlyExposed.every((id) => id in act));
  }

  // ---- hand-editing a slider falls back to 'custom' ---------------------
  const varSlider = $("weight-sliders").querySelector(".wsub input[type=range]");
  varSlider.value = "1.7";
  varSlider.dispatchEvent(new window.Event("input"));
  await new Promise((r) => setTimeout(r, 300));
  check("editing a slider switches the basis to custom",
    $("weights-state").textContent === "custom", $("weights-state").textContent);
  check("no preset stays active once weights are custom",
    !shapleyBtn.classList.contains("is-active") &&
    !equalBtn.classList.contains("is-active"));

  // ---- reset now returns to shapley, not to equal weights ---------------
  $("weights-reset").dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 300));
  check("reset returns to the shapley basis",
    $("weights-state").textContent === "shapley" &&
    shapleyBtn.classList.contains("is-active"),
    $("weights-state").textContent);

  // ---- the Equal preset still works as the reference basis --------------
  equalBtn.dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 300));
  check("equal preset becomes active",
    equalBtn.classList.contains("is-active") &&
    $("weights-state").textContent === "equal", $("weights-state").textContent);
  if (api) {
    const w = api.weights();
    const evenShare = 1 / meta.varOrder.length;
    check("equal basis spreads one unit of attribution evenly",
      meta.varOrder.every((v) => Math.abs(w[v] - evenShare) < 1e-12) &&
      Math.abs(meta.varOrder.reduce((s, v) => s + w[v], 0) - 1) < 1e-9);
  }
  check("equal basis hides the provenance panel",
    $("weights-note").classList.contains("hidden"));

  shapleyBtn.dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 300));
  // The slider snaps its knob to the 0.0001 step grid; `weights` keeps the
  // exact share, so compare to within one step.
  check("switching back to shapley restores the payload weights",
    shapleyBtn.classList.contains("is-active") &&
    Math.abs(+$("weight-sliders").querySelector("input[type=range]").value -
      causal.variables[grid.meta.categories[0].vars[0]].shapleyShare) <= 1e-4,
    $("weight-sliders").querySelector("input[type=range]").value);

  check("no uncaught errors overall", errors.length === 0, errors.join(" | "));

  console.log(failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})();
