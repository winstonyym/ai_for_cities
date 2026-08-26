/* ============================================================
   Heatscape NYC — main application.

   Loads the 250 m grid (grid_data.json), scores every cell from
   directional indicator percentiles weighted by one user-tunable
   Shapley value per indicator, colours the map, and drives the left
   panel: intervention ranking, indicator breakdown and the live
   causal systems diagram.
   ============================================================ */
(function () {
  "use strict";

  const DATA_URL = "./data/grid_data.json";
  const DIAGRAM_URL = "./data/diagram.json";
  const CAUSAL_URL = "./data/causal_weights.json";
  const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const POP_GATE = 50;          // residents for a fully "gated-in" cell
  const ACT_THRESHOLD = 0.62;   // diagram node activation cut-off

  // One entry per category in grid_data.json. `behav` was missing, so the
  // Behaviour & mental health dot rendered with no background at all; its
  // colour sits between physio's teal and adapt's violet, which is roughly
  // where it sits conceptually too. scripts/plot_intervention_layers.py keeps
  // its own copy of this map — change both together.
  const CAT_COLORS = {
    greenery: "#43AA8B", heat: "#E05E3D", built: "#C9A227", coloc: "#F9844A",
    physio: "#0DB39E", behav: "#4D8FAC", social: "#F29E4C", air: "#577590",
    adapt: "#6F63B0",
  };

  const RAMPS = {
    heat: {
      label: "Heat",
      stops: [[0, "#e8eaed"], [20, "#f3e6bc"], [40, "#f4c96b"], [58, "#ee9d4c"],
        [72, "#e06a44"], [85, "#c03e4a"], [100, "#7c1d40"]],
    },
    viridis: {
      label: "Viridis",
      stops: [[0, "#440154"], [20, "#414487"], [40, "#2a788e"], [60, "#22a884"],
        [80, "#7ad151"], [100, "#fde725"]],
    },
    magma: {
      label: "Magma",
      stops: [[0, "#000004"], [20, "#3b0f70"], [40, "#8c2981"], [60, "#de4968"],
        [80, "#fe9f6d"], [100, "#fcfdbf"]],
    },
    plasma: {
      label: "Plasma",
      stops: [[0, "#0d0887"], [20, "#6a00a8"], [40, "#b12a90"], [60, "#e16462"],
        [80, "#fca636"], [100, "#f0f921"]],
    },
    coolwarm: {
      label: "Cold–hot",
      stops: [[0, "#3b4cc0"], [20, "#688aef"], [40, "#c9d7f0"], [60, "#f7b89c"],
        [80, "#e26952"], [100, "#b40426"]],
    },
  };
  let rampKey = "heat";
  const curRamp = () => RAMPS[rampKey].stops;

  // ---------------------------------------------------------- state
  let META, CELLS, CELL_BY_ID = {}, VIDX = {};
  let map, miniDg, fullDg;
  let mode = "priority";        // 'priority' | 'iv' | category key
  let selectedId = null;
  let hoveredId = null;
  let weights = null;           // { indicator: shapleyValue } — flat, user-editable
  let CAUSAL = null;            // parsed data/causal_weights.json, or null
  let weightBasis = "shapley";  // 'shapley' | 'equal' | 'custom'
  const catOpen = {};           // accordion state

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------- utils
  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rampColor(v) {
    const RAMP = curRamp();
    if (v == null || !isFinite(v)) return "#e3e5e8";
    v = Math.max(0, Math.min(100, v));
    for (let i = 1; i < RAMP.length; i++) {
      if (v <= RAMP[i][0]) {
        const [v0, c0] = RAMP[i - 1], [v1, c1] = RAMP[i];
        const t = (v - v0) / (v1 - v0 || 1);
        const a = hex2rgb(c0), b = hex2rgb(c1);
        return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
      }
    }
    return RAMP[RAMP.length - 1][1];
  }
  function fmtVal(key, v) {
    if (v == null || !isFinite(v)) return "no data";
    const unit = META.variables[key].unit;
    let s;
    if (unit === "$") return "$" + Math.round(v).toLocaleString();
    if (["trees", "POIs", "res / cell"].includes(unit)) s = Math.round(v).toLocaleString();
    else if (unit === "m" && v > 100) s = Math.round(v).toLocaleString();
    else s = (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));
    return s + (unit ? " " + unit : "");
  }
  const debounce = (fn, ms) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  // ---------------------------------------------------------- weights payload
  //
  // The rendered diagram is nyc-greenery.json — the graph the SCM analysis
  // actually runs on. grid_data.json was rebuilt against it, so every indicator
  // and every category names a node that exists in the diagram and no id
  // remapping is needed. Two nodes were dropped in that revision: "Population
  // density", whose indicator pop_den went with it (residents still enter
  // scoring through the population gate), and the intermediate "Heat
  // vulnerability" construct, whose inbound composites now feed "Heat
  // emergency" directly. Node positions come straight from the authored file,
  // so re-laying the diagram out needs no change here — Diagram.fit() derives
  // its viewport from whatever coordinates it is given.
  //
  // data/causal_weights.json is produced by scm_tut/run_pipeline.py. The app
  // reads two things from it: the Shapley decomposition that sets the default
  // weights, and a few per-indicator flags the interface still surfaces
  // (constructOverlap, the bootstrap interval).
  //
  // The file also carries the full back-door effect estimates the retired
  // "Causal" preset used — effect, CI, estimator, adjustment set, FCI tier,
  // sign gate. Nothing reads them now. They are left in place because the file
  // is the pipeline's own export rather than an app asset, and regenerating it
  // would reintroduce them anyway.
  const cinfo = (vk) => (CAUSAL && CAUSAL.variables ? CAUSAL.variables[vk] : null);

  // Direction of risk is a property of the indicator, declared once in
  // grid_data.json and taken from the systems diagram. No weighting basis
  // overrides it: equal weighting has nothing to say about direction, and a
  // Shapley share is unsigned.
  const invertFor = (vk) => META.variables[vk].invert;

  // Shares span four orders of magnitude, so a fixed number of decimals either
  // rounds the small ones to a misleading "0.0%" or floods the large ones with
  // noise digits. Below the display floor say "under", never zero — a share of
  // 0.0025% and a share of exactly nothing are different claims.
  function fmtShare(share) {
    const pct = share * 100;
    if (pct === 0) return "0%";
    if (pct < 0.1) return "<0.1%";
    return pct.toFixed(1) + "%";
  }

  // Shapley shares are unsigned: an attribution says how much of the explained
  // variance an indicator accounts for, never in which direction it pushes. So
  // the Shapley basis never flips an indicator's polarity — it only re-weights.
  const sinfo = (vk) => {
    const i = cinfo(vk);
    return i && i.shapleyShare != null ? i : null;
  };

  // ---------------------------------------------------------- scoring
  function dpct(cell, vk) {
    const p = cell.pcts[VIDX[vk]];
    if (p == null) return null;
    return invertFor(vk) ? 100 - p : p;
  }
  // An indicator is *live* in a cell when the user has left it a Shapley value
  // above zero and the cell actually has a reading for it. Everything below is
  // computed over the live set and nothing else: an indicator zeroed on the
  // slider leaves its category's mean as well as its weight, so pulling a
  // slider to 0 removes the indicator completely rather than muting it.
  function catLive(cell, catKey) {
    const cat = META.categories.find((c) => c.key === catKey);
    const out = [];
    for (const vk of cat.vars) {
      const w = weights[vk];
      if (!(w > 0)) continue;
      const d = dpct(cell, vk);
      if (d == null) continue;
      out.push({ vk, w, d });
    }
    return out;
  }

  // The category's own reading: a plain, unweighted mean of the directed
  // percentiles of its live indicators. Weighting happens once, at the category
  // level, and never twice.
  function catMean(cell, catKey) {
    const live = catLive(cell, catKey);
    if (!live.length) return null;
    return live.reduce((s, x) => s + x.d, 0) / live.length;
  }

  // The category's weight: the summed Shapley value of the same live set. A
  // category is worth exactly what the decomposition attributes to the
  // indicators it can actually be read from in this cell.
  function catWeight(cell, catKey) {
    return catLive(cell, catKey).reduce((s, x) => s + x.w, 0);
  }

  const gate = (cell) => Math.max(0, Math.min(1, cell.pop / POP_GATE));

  // priority = Σ_cat ( Σ φ over the category's live indicators × mean of their
  // directed percentiles ), gated on population. Deliberately a straight sum
  // with no renormalisation: Shapley values sum to 1 across the full indicator
  // set, so a cell that can be read everywhere lands on 0–100 by construction,
  // and a cell with gaps scores lower because there is less evidence of risk in
  // it, not because the missing categories were quietly redistributed.
  function priority(cell) {
    let s = 0, any = false;
    for (const cat of META.categories) {
      const m = catMean(cell, cat.key);
      if (m == null) continue;
      any = true;
      s += catWeight(cell, cat.key) * m;
    }
    return any ? s * gate(cell) : null;
  }

  // Interventions read the same live Shapley values. `factors` names the levers
  // an intervention acts on and records their default value; the weight used
  // here is always the current one, so moving a slider moves the intervention
  // ranking with it. Weights are renormalised over the intervention's own lever
  // list, which is what keeps a score on the 0–100 scale.
  function ivScore(cell, iv) {
    let s = 0, w = 0;
    for (const f in iv.factors) {
      const isCat = f.startsWith("cat:");
      const fw = isCat ? catWeight(cell, f.slice(4)) : weights[f];
      if (!(fw > 0)) continue;
      const d = isCat ? catMean(cell, f.slice(4)) : dpct(cell, f);
      if (d == null) continue;
      s += d * fw; w += fw;
    }
    if (w === 0) return null;
    return (s / w) * gate(cell);
  }
  function rankInterventions(cell) {
    return META.interventions
      .map((iv) => ({ iv, score: ivScore(cell, iv) }))
      .filter((r) => r.score != null)
      .sort((a, b) => b.score - a.score);
  }

  // memoised per-cell scores (invalidated when weights change) so hover /
  // repaint never recompute the full scoring cascade
  const scoreCache = { p: new Map(), top: new Map() };
  function clearScoreCache() { scoreCache.p.clear(); scoreCache.top.clear(); }
  function getPriority(cell) {
    if (!scoreCache.p.has(cell.id)) scoreCache.p.set(cell.id, priority(cell));
    return scoreCache.p.get(cell.id);
  }
  function getTopIv(cell) {
    if (!scoreCache.top.has(cell.id)) scoreCache.top.set(cell.id, rankInterventions(cell)[0] || null);
    return scoreCache.top.get(cell.id);
  }

  // ---------------------------------------------------------- data load
  async function loadAll() {
    // `cache: "no-cache"` revalidates with the server on every load rather than
    // trusting the browser's heuristic freshness. python3 -m http.server sends
    // no Cache-Control, so browsers are free to reuse a stale copy without
    // asking — which silently pinned the systems diagram to an old layout after
    // data/diagram.json was rewritten. This still costs nothing when the file is
    // unchanged: the server answers 304 and no body is transferred.
    const noCache = { cache: "no-cache" };
    const [gridResp, dgResp] = await Promise.all([
      fetch(DATA_URL, noCache), fetch(DIAGRAM_URL, noCache),
    ]);
    if (!gridResp.ok) throw new Error("grid_data.json not found — run scripts/build_heatscape_grid.py");
    const grid = await gridResp.json();
    const dgData = await dgResp.json();
    META = grid.meta;
    META.varOrder.forEach((k, i) => (VIDX[k] = i));
    CELLS = grid.cells.map((c) => ({
      id: c[0], ring: c[1], pop: c[2] || 0, nta: c[3], vals: c[4], pcts: c[5],
    }));
    CELLS.forEach((c) => (CELL_BY_ID[c.id] = c));

    // The weights payload is optional: without it the app is fully usable on
    // equal weighting, and simply hides the "Shapley" preset.
    try {
      const causalResp = await fetch(CAUSAL_URL, noCache);
      if (causalResp.ok) CAUSAL = await causalResp.json();
    } catch (e) { CAUSAL = null; }

    if (!applyShapleyWeights()) applyEqualWeights();
    return dgData;
  }

  // Equal weighting spreads one unit of attribution evenly over every
  // indicator, so a category is worth its size and nothing else. Every
  // indicator is live, which is the point of the comparison: the difference
  // between this map and the Shapley one is the attribution doing its work.
  function applyEqualWeights() {
    weights = {};
    const share = 1 / META.varOrder.length;
    META.varOrder.forEach((v) => (weights[v] = share));
    weightBasis = "equal";
  }

  // The default basis. Weights come from the Shapley decomposition of explained
  // variance in heat-emergency incidence over the fitted SCM: each indicator's
  // average marginal contribution across coalition orderings, expressed as a
  // share of the total (shapley_values.csv, column shapley_share).
  //
  // The slider *is* the Shapley value. There is no multiplier layer and no
  // rescaling between what the decomposition reports and what the app scores
  // with: the panel hands the user the 43 attributions directly and the score
  // is a weighted sum over them,
  //
  //     priority = Σ_cat ( Σ_{v∈cat} φ_v × mean_{v∈cat} directed percentile_v )
  //
  // over the live indicators of each category. Because φ sums to 1 across the
  // full set, a fully-read cell lands on 0–100 with no normalising constant.
  //
  // Two earlier rules are gone. The first normalised each share against its
  // category mean and clipped to a 0–2 slider range, which broke proportionality
  // at the top of the table. The second fixed that by rescaling category and
  // variable sliders so their ratios survived — correct, but it meant the number
  // on the slider was a display artefact rather than the quantity itself, and an
  // indicator's weight was still the product of two controls. This basis drops
  // the second control: one slider per indicator, holding its own attribution.
  function applyShapleyWeights() {
    if (!CAUSAL || !CAUSAL.shapley) return false;
    weights = {};
    META.varOrder.forEach((v) => {
      const info = cinfo(v);
      weights[v] = info && info.shapleyShare != null ? info.shapleyShare : 0;
    });
    weightBasis = "shapley";
    return true;
  }

  function buildGeojson() {
    return {
      type: "FeatureCollection",
      features: CELLS.map((c) => {
        const r = c.ring;
        return {
          type: "Feature", id: c.id,
          properties: { pop: c.pop },
          geometry: {
            type: "Polygon",
            coordinates: [[[r[0], r[1]], [r[2], r[3]], [r[4], r[5]], [r[6], r[7]], [r[0], r[1]]]],
          },
        };
      }),
    };
  }

  // ---------------------------------------------------------- map colouring
  function applyColors() {
    const isCat = mode !== "priority" && mode !== "iv";
    for (const c of CELLS) {
      let color, op;
      const g = gate(c);
      if (g <= 0) { color = "#eef0f2"; op = 0.16; }
      else if (mode === "priority") {
        color = rampColor(getPriority(c)); op = 0.34 + 0.38 * g;
      } else if (mode === "iv") {
        const top = getTopIv(c);
        if (!top) { color = "#eef0f2"; op = 0.16; }
        else {
          color = top.iv.color;
          op = (0.12 + 0.6 * (top.score / 100)) * (0.4 + 0.6 * g);
        }
      } else {
        const cs = catMean(c, mode);
        color = rampColor(cs); op = cs == null ? 0.1 : 0.34 + 0.38 * g;
      }
      map.setFeatureState({ source: "grid", id: c.id }, { color, op });
    }
  }

  // ---------------------------------------------------------- legend
  function renderLegend() {
    const box = $("legend");
    if (mode === "iv") {
      box.innerHTML = `<div class="legend__cats">` + META.interventions.map((iv) =>
        `<div class="legend__cat"><i style="background:${iv.color}"></i>${iv.label}</div>`).join("") +
        `</div><div class="legend__labels" style="margin-top:8px"><span>opacity ∝ suitability × population</span></div>`;
      return;
    }
    const grad = curRamp().map(([v, c]) => `${c} ${v}%`).join(", ");
    const label = mode === "priority" ? "Composite priority (0–100)" :
      META.categories.find((c) => c.key === mode).label + " — risk percentile";
    box.innerHTML = `
      <div class="legend__bar" style="background:linear-gradient(90deg, ${grad})"></div>
      <div class="legend__labels"><span>low</span><span>${label}</span><span>high</span></div>`;
  }

  // ---------------------------------------------------------- colour scale picker
  function renderScalePicker() {
    const box = $("scale-swatches");
    box.innerHTML = "";
    Object.entries(RAMPS).forEach(([key, r]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch" + (rampKey === key ? " active" : "");
      b.title = r.label;
      b.setAttribute("aria-label", "Colour scale: " + r.label);
      b.style.background = `linear-gradient(90deg, ${r.stops.map(([v, c]) => `${c} ${v}%`).join(", ")})`;
      b.onclick = () => {
        rampKey = key;
        $("scale-name").textContent = r.label;
        renderScalePicker();
        renderLegend();
        applyColors();
        if (selectedId != null) renderCell(CELL_BY_ID[selectedId]);
      };
      box.appendChild(b);
    });
    $("scale-name").textContent = RAMPS[rampKey].label;
  }

  // ---------------------------------------------------------- layer chips
  function renderChips() {
    const box = $("layer-chips");
    box.innerHTML = "";
    const mk = (label, key) => {
      const b = document.createElement("button");
      b.className = "chip" + (mode === key ? " active" : "");
      b.textContent = label;
      b.onclick = () => { mode = key; renderChips(); renderLegend(); applyColors(); };
      box.appendChild(b);
    };
    mk("Priority score", "priority");
    mk("Top intervention", "iv");
    const sel = document.createElement("select");
    const isCat = mode !== "priority" && mode !== "iv";
    sel.className = "chip" + (isCat ? " active" : "");
    sel.innerHTML = `<option value="" ${isCat ? "" : "selected"}>Category risk…</option>` +
      META.categories.map((c) =>
        `<option value="${c.key}" ${mode === c.key ? "selected" : ""}>${c.label}</option>`).join("");
    sel.onchange = () => {
      if (!sel.value) return;
      mode = sel.value; renderChips(); renderLegend(); applyColors();
    };
    box.appendChild(sel);
  }

  // ---------------------------------------------------------- weights UI
  //
  // One slider per indicator, holding that indicator's Shapley value. The
  // category row above them carries no control of its own: its weight is the
  // sum of the sliders beneath it, so it is rendered as a readout that moves
  // when they do. Removing the category multiplier removed the only place where
  // two controls multiplied into one number.
  const W_MAX = 0.4;            // slider ceiling — ~1.7x the largest observed share
  const W_STEP = 0.0001;        // 0.01 percentage points of attribution

  // Sum of the sliders in a category, ignoring data availability. This is the
  // panel's number: it says what the weighting *declares* the group is worth,
  // where catWeight() says what a particular cell could actually be read on.
  function catWeightTotal(cat) {
    return cat.vars.reduce((s, v) => s + (weights[v] > 0 ? weights[v] : 0), 0);
  }

  function renderWeights() {
    const box = $("weight-sliders");
    box.innerHTML = "";
    const totals = META.categories.map(catWeightTotal);
    const peak = Math.max(...totals, 1e-9);

    META.categories.forEach((cat, ci) => {
      const grp = document.createElement("div");
      grp.className = "wgroup";
      const row = document.createElement("div");
      row.className = "wrow wrow--cat";
      row.innerHTML = `
        <label title="${cat.label}">${cat.label}</label>
        <span class="wtotal" title="Sum of the Shapley values of this group's indicators. This is the weight the group carries in the priority score — it is not a separate control, it moves when the sliders below it move.">
          <span class="wtotal__track"><i style="background:${CAT_COLORS[cat.key] || "#C8C7D6"}"></i></span>
        </span>
        <output></output>
        <button class="subchev" aria-expanded="false" title="Indicator weights">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>`;
      const bar = row.querySelector(".wtotal__track i");
      const catOut = row.querySelector("output");
      const paintCat = () => {
        const t = catWeightTotal(cat);
        const hi = Math.max(...META.categories.map(catWeightTotal), 1e-9);
        bar.style.width = Math.max(t > 0 ? 1.5 : 0, (t / hi) * 100) + "%";
        catOut.textContent = fmtShare(t);
        row.classList.toggle("is-dead", t <= 0);
      };
      bar.style.width = Math.max(totals[ci] > 0 ? 1.5 : 0, (totals[ci] / peak) * 100) + "%";
      catOut.textContent = fmtShare(totals[ci]);
      row.classList.toggle("is-dead", totals[ci] <= 0);

      const sub = document.createElement("div");
      sub.className = "wsub";
      cat.vars.forEach((vk) => {
        const vr = document.createElement("div");
        vr.className = "wrow";
        vr.innerHTML = `
          <label title="${META.variables[vk].label}">${META.variables[vk].label}</label>
          <input type="range" min="0" max="${W_MAX}" step="${W_STEP}" value="${weights[vk]}"
                 aria-label="${META.variables[vk].label} — Shapley value">
          <output>${fmtShare(weights[vk])}</output>`;
        const vs = vr.querySelector("input");
        const vo = vr.querySelector("output");
        vs.oninput = () => {
          weights[vk] = +vs.value;
          vo.textContent = fmtShare(+vs.value);
          vr.classList.toggle("is-dead", +vs.value <= 0);
          // Every category readout on screen is relative to the largest, so a
          // single slider can rescale all nine bars. Repaint them together.
          box.querySelectorAll(".wrow--cat").forEach((r, i) => {
            const c = META.categories[i], t = catWeightTotal(c);
            const hi = Math.max(...META.categories.map(catWeightTotal), 1e-9);
            r.querySelector(".wtotal__track i").style.width = Math.max(t > 0 ? 1.5 : 0, (t / hi) * 100) + "%";
            r.querySelector("output").textContent = fmtShare(t);
            r.classList.toggle("is-dead", t <= 0);
          });
          if (weightBasis !== "custom") setBasis("custom");
          onWeightsChanged();
        };
        vr.classList.toggle("is-dead", !(weights[vk] > 0));
        sub.appendChild(vr);
        const ev = weightBasis === "shapley" ? shapleyRow(vk) : null;
        if (ev) sub.appendChild(ev);
      });
      const chevBtn = row.querySelector(".subchev");
      chevBtn.onclick = () => {
        const open = sub.classList.toggle("open");
        chevBtn.setAttribute("aria-expanded", open);
      };
      grp.appendChild(row);
      if (weightBasis === "shapley") {
        const cev = shapleyCatRow(cat);
        if (cev) grp.appendChild(cev);
      }
      grp.appendChild(sub);
      box.appendChild(grp);
      paintCat();
    });
  }

  // A category is flagged "barely contributing" when its summed attribution
  // rounds to 0.0% at the precision the panel shows. Nothing here is exactly
  // zero any more, so the test is against the displayed value.
  const NEG_W = 0.0005;

  // Category-level attribution line, shown under a category readout in the
  // Shapley basis. The share is what the whole group accounts for; the count
  // says how much of the group earned any attribution at all, which is the
  // more useful number when a category's share is small.
  function shapleyCatRow(cat) {
    const c = CAUSAL && CAUSAL.categories ? CAUSAL.categories[cat.key] : null;
    if (!c || c.shapleyShare == null) return null;
    const row = document.createElement("div");
    row.className = "wev wev--cat";
    const dead = c.shapleyShare < NEG_W;
    row.innerHTML = `
      <span class="wev__primary" title="Share of the total explained variance in heat-emergency incidence attributed to this category, summed over its indicators. This is the group's weight in the priority score.">
        ${fmtShare(c.shapleyShare)} of attribution at the default</span>
      <span class="wev__meta">${c.shapleyNNonzero} of ${c.shapleyNVars} indicator${c.shapleyNVars === 1 ? "" : "s"} attributed &middot; the rest are switched off</span>
      ${dead ? `<span class="tag tag--warn" title="This category's indicators are attributed so little between them that the group makes no practical difference to the priority score. Raise their sliders to put it back in, or switch to Equal weights.">barely contributing</span>` : ""}`;
    return row;
  }

  // Per-indicator attribution line for the Shapley basis. Deliberately narrower
  // than the retired causal evidence line: a Shapley share carries no direction, no
  // identification verdict, so claiming any of those here would overstate it.
  function shapleyRow(vk) {
    const info = sinfo(vk);
    if (!info) return null;
    const row = document.createElement("div");
    row.className = "wev";
    const share = info.shapleyShare;

    if (share === 0) {
      row.innerHTML = `
        <span class="wev__muted">no attribution — marginal contribution was non-positive across the sampled orderings</span>`;
      return row;
    }

    const band = info.shapleyLo != null && info.shapleyHi != null
      ? `<span class="wev__ci"> [${info.shapleyLo.toFixed(3)}, ${info.shapleyHi.toFixed(3)}]</span>` : "";
    const stable = info.shapleySignStable;
    const tags = [];
    if (!stable) tags.push(`<span class="tag tag--warn" title="The bootstrap interval for this indicator's contribution includes zero, so the attribution is not separable from noise at ${CAUSAL.shapley.nBootstrap} replicates. The weight is still shown, but should not be read as an ordering against its neighbours.">interval spans 0</span>`);
    if (info.constructOverlap) tags.push(`<span class="tag tag--warn" title="This indicator feeds the published HVI formula, so part of its attribution is definitional rather than causal.">HVI input</span>`);

    row.innerHTML = `
      <span class="wev__eff pos" title="Share of total explained variance in heat-emergency incidence attributed to this indicator by the Shapley decomposition.${
        share * 100 < 0.1 ? ` Exact share: ${(share * 100).toFixed(4)}%.` : ""}">
        ${fmtShare(share)} of attribution</span>
      <span class="wev__primary" title="Raw Shapley value with its bootstrap interval, in units of explained variance.">
        &phi; ${info.shapley.toFixed(4)}${band}</span>
      <span class="wev__meta">${stable ? "interval excludes 0" : "unstable"} · the slider holds this value directly</span>
      ${tags.length ? `<span class="wev__tags">${tags.join("")}</span>` : ""}`;
    return row;
  }

  function renderWeightsNote() {
    const box = $("weights-note");
    const hint = $("weights-hint");
    if (weightBasis === "shapley" && CAUSAL && CAUSAL.shapley) {
      renderShapleySummary(box, hint);
      return;
    }
    box.classList.add("hidden");
    hint.textContent = weightBasis === "custom"
      ? "Weights have been adjusted by hand. Pick a preset above to return to a defined basis."
      : "One unit of attribution spread evenly over all 43 indicators, so every indicator counts the same — which means a category is worth its size. Physiological vulnerability and social determinants hold 23 of the 43 indicators between them, so this map leans heavily on tract-level health and census rates and looks very different from the Shapley one. That gap is the reference point: it is what the attribution is doing.";
  }

  // The Shapley provenance panel. It reports an attribution rather than an
  // effect, so the rows say what the decomposition can support and no more: how
  // concentrated it is, how many indicators got nothing, and how thin the
  // resampling behind it is.
  function renderShapleySummary(box, hint) {
    const s = CAUSAL.shapley;
    const cats = CAUSAL.categories || {};
    box.classList.remove("hidden");
    hint.textContent =
      "Weights come from a Shapley decomposition of explained variance in heat-emergency " +
      "incidence over the fitted structural model: each indicator's average marginal " +
      "contribution across coalition orderings. Each slider holds one indicator's share " +
      "directly — there is no multiplier layer between the number you see and the number " +
      "the score uses. A category is worth the sum of the sliders beneath it, and its " +
      "reading is the plain mean of the indicators still switched on.";

    const ranked = Object.entries(cats)
      .filter(([, c]) => c.shapleyShare != null)
      .sort((a, b) => b[1].shapleyShare - a[1].shapleyShare);
    const top = ranked[0][1].shapleyShare;
    const bars = ranked.map(([k, c]) => `
      <div class="cshare${c.shapleyShare < NEG_W ? " is-dead" : ""}">
        <span class="cshare__dot" style="background:${CAT_COLORS[k] || "#C8C7D6"}"></span>
        <span class="cshare__label" title="${c.label}">${c.label}</span>
        <span class="cshare__bar"><i style="width:${Math.max(0.8, (c.shapleyShare / top) * 100)}%;background:${CAT_COLORS[k] || "#C8C7D6"}"></i></span>
        <span class="cshare__num" title="${(c.shapleyShare * 100).toFixed(4)}% of total attribution">${fmtShare(c.shapleyShare)}</span>
        <span class="cshare__w">${c.shapleyNNonzero}/${c.shapleyNVars}</span>
      </div>`).join("");

    box.innerHTML = `
      <div class="cnote__row"><b>Quantity</b><span>Share of explained variance in <b>heat-emergency incidence</b> attributed to each indicator, averaged over coalition orderings of the fitted SCM. An attribution, not an effect estimate — it says how much of the model's fit an indicator accounts for, never in which direction it pushes.</span></div>
      <div class="cnote__row"><b>Score</b><span>Every category contributes <b>its summed share &times; the plain mean of its live indicators&rsquo; percentiles</b>, and the priority score is the straight sum of those nine terms, gated by population. Shares add to 1 across the full indicator set, so a cell that can be read everywhere lands on 0&ndash;100 with no normalising constant; a cell with gaps scores lower because there is less evidence in it.</span></div>
      <div class="cnote__row"><b>Controls</b><span>One slider per indicator, holding that indicator&rsquo;s Shapley value. There is no category multiplier &mdash; a category&rsquo;s weight is the sum of the sliders inside it. Setting a slider to zero removes the indicator from its category&rsquo;s mean as well as from its weight, so it leaves the score entirely rather than being muted.</span></div>
      <div class="cnote__row"><b>Diagram</b><span>${s.diagram || (CAUSAL.meta && CAUSAL.meta.diagram) || "nyc-greenery.json"} — the same graph rendered below, so every weighted indicator lights a node you can see</span></div>
      <div class="cnote__row"><b>Concentration</b><span>The top four indicators carry <b>${Math.round((s.concentration || 0) * 100)}%</b> of the total attribution; ${s.nVars - s.nNonZero} of ${s.nVars} receive none at all</span></div>
      <div class="cnote__row"><b>Resampling</b><span>${s.nPoint} point fits, ${s.nBootstrap} bootstrap replicates — thin, so shares under about 1% are not separable from one another, and most bootstrap intervals here span zero</span></div>
      <div class="cnote__row cnote__row--wide"><b>By category</b><div class="cshares">${bars}</div></div>
      <p class="cnote__caveat">Direction of risk is <b>not</b> taken from this basis. A Shapley share is unsigned, so each indicator keeps the polarity declared in the systems diagram; only the magnitude changes. Two categories &mdash; physiological vulnerability and behaviour &amp; mental health &mdash; receive so little attribution (<b>0.05%</b> between them) that they make no practical difference to the priority score. That is what the decomposition says at 250&nbsp;m, not a judgement that health burden is irrelevant: those indicators arrive as tract-level rates and barely vary between cells inside a tract, so there is little for the model to attribute. Raise their sliders, or switch to <b>Equal</b>, to see how much the ranking depends on it.</p>`;
  }

  function setBasis(basis) {
    weightBasis = basis;
    const map = { shapley: "preset-shapley", equal: "preset-equal" };
    Object.entries(map).forEach(([b, id]) => {
      const btn = $(id);
      if (btn) btn.classList.toggle("is-active", basis === b);
    });
    $("weights-state").textContent = basis;
    renderWeightsNote();
  }

  const weightsMatch = (pick) => META.varOrder.every((v) => weights[v] === pick(v));
  function weightsAreEqual() {
    const share = 1 / META.varOrder.length;
    return weightsMatch(() => share);
  }
  function weightsAreShapley() {
    if (!CAUSAL || !CAUSAL.shapley) return false;
    return weightsMatch((v) => {
      const info = cinfo(v);
      return info && info.shapleyShare != null ? info.shapleyShare : 0;
    });
  }

  const onWeightsChanged = debounce(() => {
    if (weightBasis === "custom" && weightsAreShapley()) setBasis("shapley");
    else if (weightBasis === "custom" && weightsAreEqual()) setBasis("equal");
    else $("weights-state").textContent = weightBasis;
    clearScoreCache();
    applyColors();
    if (selectedId != null) renderCell(CELL_BY_ID[selectedId]);
  }, 130);

  // ---------------------------------------------------------- cell panel
  function ntaName(cell) {
    return cell.nta >= 0 ? META.ntaNames[cell.nta] : "No resident population";
  }

  function renderCell(cell) {
    $("cell-empty").classList.add("hidden");
    $("cell-detail").classList.remove("hidden");

    const p = priority(cell);
    $("cell-nta").textContent = ntaName(cell);
    $("cell-sub").textContent =
      `Cell #${cell.id} · 250 × 250 m · ${Math.round(cell.pop).toLocaleString()} residents`;
    $("cell-score").textContent = p == null ? "–" : Math.round(p);
    $("cell-score-badge").style.background = rampColor(p);

    const g = gate(cell);
    const note = $("cell-gate-note");
    if (g < 1) {
      note.classList.remove("hidden");
      note.innerHTML = g === 0
        ? `No residents in this cell — interventions are not prioritised where nobody lives, so the priority score is gated to zero. Indicators below are still shown for context.`
        : `Only ${Math.round(cell.pop)} residents here — the priority score is scaled by ${(g * 100).toFixed(0)}% (full weight at ${POP_GATE}+ residents).`;
    } else note.classList.add("hidden");

    // interventions
    const ivBox = $("interventions");
    ivBox.innerHTML = "";
    const ranked = rankInterventions(cell).slice(0, 3);
    if (!ranked.length) ivBox.innerHTML = `<p class="hint">Not enough data to rank interventions here.</p>`;
    ranked.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "iv" + (i === 0 ? " iv--top" : "");
      if (i === 0) d.style.borderColor = r.iv.color;
      d.innerHTML = `
        <div class="iv__rank" style="background:${r.iv.color}">${i + 1}</div>
        <div class="iv__body">
          <div class="iv__label"><b>${r.iv.label}</b><span>${Math.round(r.score)}/100</span></div>
          ${i === 0 ? `<p class="iv__desc">${r.iv.desc}</p>` : ""}
          <div class="iv__bar"><i style="width:${r.score}%;background:${r.iv.color}"></i></div>
        </div>`;
      ivBox.appendChild(d);
    });

    // categories accordion
    const catBox = $("categories");
    catBox.innerHTML = "";
    META.categories.forEach((cat) => {
      const cs = catMean(cell, cat.key);
      const wrap = document.createElement("div");
      wrap.className = "cat";
      const head = document.createElement("button");
      head.className = "cat__head";
      head.setAttribute("aria-expanded", !!catOpen[cat.key]);
      head.innerHTML = `
        <span class="cat__dot" style="background:${CAT_COLORS[cat.key]}"></span>
        <span class="cat__name">${cat.label}</span>
        <span class="cat__scorewrap">
          <span class="cat__minibar"><i style="width:${cs == null ? 0 : cs}%;background:${rampColor(cs)}"></i></span>
          <span class="cat__num">${cs == null ? "–" : Math.round(cs)}</span>
        </span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
      const body = document.createElement("div");
      body.className = "cat__body" + (catOpen[cat.key] ? " open" : "");
      cat.vars.forEach((vk) => {
        const raw = cell.vals[VIDX[vk]];
        const d = dpct(cell, vk);
        const inv = invertFor(vk);
        const info = cinfo(vk);
        const showShapley = weightBasis === "shapley" && info && info.shapleyShare != null;
        const v = document.createElement("div");
        v.className = "var";
        v.title = inv
          ? "Lower values of this indicator increase risk (percentile inverted)."
          : "Higher values of this indicator increase risk.";
        v.innerHTML = `
          <div>
            <div class="var__name">${META.variables[vk].label}${inv ? " <span style='color:var(--ink-faint)'>↓</span>" : ""}</div>
            <div class="var__raw">${fmtVal(vk, raw)}</div>
            ${showShapley ? `<div class="var__eff" title="Share of explained variance in heat-emergency incidence attributed to this indicator, which is the weight it carries in the priority score. Attribution carries no direction — the arrow above still comes from the systems diagram.">
                ${!(weights[vk] > 0)
                  ? `<span class="var__eff--zero" title="${info.shapleyShare === 0
                        ? "This indicator earned no attribution, so it is switched off: it counts neither toward its category's weight nor toward its mean."
                        : "Its slider is at zero, so it counts neither toward its category's weight nor toward its mean."}">switched off</span>`
                  : `${fmtShare(weights[vk])} of attribution${
                      d == null ? ` · <span class="var__eff--zero" title="No reading in this cell, so the indicator drops out of its category's mean and weight here.">no reading here</span>` : ""}${
                      info.shapleySignStable ? "" : " · interval spans 0"}`}
              </div>` : ""}
          </div>
          <div class="var__pct">
            <div class="var__bar"><i style="width:${d == null ? 0 : d}%;background:${rampColor(d)}"></i></div>
            <div class="var__pcttxt">${d == null ? "no data" : "risk P" + Math.round(d)}</div>
          </div>`;
        body.appendChild(v);
      });
      head.onclick = () => {
        catOpen[cat.key] = !catOpen[cat.key];
        head.setAttribute("aria-expanded", catOpen[cat.key]);
        body.classList.toggle("open", catOpen[cat.key]);
      };
      wrap.appendChild(head);
      wrap.appendChild(body);
      catBox.appendChild(wrap);
    });

    updateDiagramForCell(cell);
  }

  function clearCell() {
    selectedId = null;
    $("cell-detail").classList.add("hidden");
    $("cell-empty").classList.remove("hidden");
    if (map.getLayer("grid-selected")) map.setFilter("grid-selected", ["==", ["id"], -1]);
    miniDg && miniDg.clearActivation();
    fullDg && fullDg.clearActivation();
    $("diagram-hint").textContent =
      "Causal structure of urban heat risk. Select a cell to trace which parts of the system are activated there.";
    $("overlay-context").textContent = "Citywide view — no cell selected";
    $("overlay-readout").classList.add("hidden");
  }

  // ---------------------------------------------------------- diagram
  // Map a clicked cell onto activation levels for the systems diagram.
  //
  // Every one of the 43 indicators carries the id of a node that exists in
  // nyc-greenery.json, and every category carries the id of the composite node
  // that summarises it. So this reduces to: light each measured node by its own
  // risk percentile, light each composite by its category score, and light the
  // sink — now "Heat emergency" — by the cell's priority. No hand-written
  // special cases and no id aliasing.
  //
  // Note that the composites are lit by the *weighted* category score, so a
  // category the Shapley basis zeroes out still shows its own risk here while
  // contributing nothing to the priority that lights the sink.
  function nodeActivation(cell) {
    const act = {};
    const bump = (node, v) => {
      if (!node || v == null || !Number.isFinite(v)) return;
      act[node] = Math.max(act[node] || 0, v);
    };

    for (const vk of META.varOrder) {
      const d = dpct(cell, vk);
      bump(META.variables[vk].node, d == null ? null : d / 100);
    }
    META.categories.forEach((c) => {
      const cs = catMean(cell, c.key);
      bump(c.node, cs == null ? null : cs / 100);
    });

    const p = priority(cell);
    bump(window.HeatscapeDiagram.SINK,
      p == null ? null : Math.max(0.001, p / 100));
    return act;
  }

  function updateDiagramForCell(cell) {
    const act = nodeActivation(cell);
    const res = miniDg.setActivation(act, ACT_THRESHOLD);
    fullDg && fullDg.setActivation(act, ACT_THRESHOLD);
    const n = res.active.length;
    $("diagram-hint").textContent = n
      ? `${n} system driver${n > 1 ? "s" : ""} activated in this cell (risk ≥ P${Math.round(ACT_THRESHOLD * 100)}) — flow animates toward heat vulnerability.`
      : "No indicator exceeds the activation threshold in this cell — a comparatively low-risk location.";
    $("overlay-context").textContent =
      `${ntaName(cell)} · cell #${cell.id} · priority ${Math.round(priority(cell) ?? 0)}/100`;
    // overlay readout: active nodes sorted by activation
    const items = res.active
      .map((id) => ({ id, a: act[id] || 0, label: (miniDg.nodeById[id] || {}).label || id }))
      .sort((a, b) => b.a - a.a).slice(0, 9);
    const ro = $("overlay-readout");
    if (items.length) {
      ro.classList.remove("hidden");
      ro.innerHTML = `<h4>Activated drivers here</h4><ul>` +
        items.map((it) => `<li><b>${it.label}</b> — risk P${Math.round(it.a * 100)}</li>`).join("") + `</ul>`;
    } else ro.classList.add("hidden");
  }

  function renderDiagramLegend() {
    const used = [...new Set(miniDg.data.nodes.map((n) => n.subsystem))];
    $("diagram-legend").innerHTML = used.map((s) =>
      `<span><i style="background:${window.HeatscapeDiagram.SUBSYSTEM_COLORS[s] || "#C8C7D6"}"></i>${s}</span>`).join("");
  }

  // ---------------------------------------------------------- map
  function initMap(geojson) {
    map = new maplibregl.Map({
      container: "map",
      style: BASEMAP,
      center: [-73.94, 40.71],
      zoom: 9.9,
      minZoom: 8.5,
      maxZoom: 16,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("grid", { type: "geojson", data: geojson });
      map.addLayer({
        id: "grid-fill", type: "fill", source: "grid",
        paint: {
          "fill-color": ["coalesce", ["feature-state", "color"], "rgba(0,0,0,0)"],
          "fill-opacity": ["coalesce", ["feature-state", "op"], 0],
        },
      });
      map.addLayer({
        id: "grid-line", type: "line", source: "grid",
        paint: { "line-color": "#ffffff", "line-opacity": 0.14, "line-width": 0.4 },
      });
      // hover outline driven by feature-state (fast: repaints one feature,
      // unlike setFilter which re-evaluates the whole 16.5k-cell layer)
      map.addLayer({
        id: "grid-hover", type: "line", source: "grid",
        paint: {
          "line-color": "#34424f",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.6, 0],
          "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0],
        },
      });
      map.addLayer({
        id: "grid-selected", type: "line", source: "grid",
        paint: { "line-color": "#1d2733", "line-width": 2.6, "line-opacity": 1 },
        filter: ["==", ["id"], -1],
      });

      applyColors();
      renderLegend();
      $("loading-modal").classList.add("hidden");

      // interactions
      const tooltip = $("tooltip");
      map.on("mousemove", "grid-fill", (e) => {
        const f = e.features[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        // tooltip follows the cursor every frame (cheap) …
        tooltip.style.left = Math.min(e.point.x + 14, window.innerWidth - 240) + "px";
        tooltip.style.top = (e.point.y + 14) + "px";
        if (hoveredId === f.id) return;
        // … but state + content update only when the cell changes
        if (hoveredId != null) map.setFeatureState({ source: "grid", id: hoveredId }, { hover: false });
        hoveredId = f.id;
        map.setFeatureState({ source: "grid", id: hoveredId }, { hover: true });
        const cell = CELL_BY_ID[f.id];
        if (!cell) return;
        const p = getPriority(cell);
        const top = getTopIv(cell);
        tooltip.classList.remove("hidden");
        tooltip.innerHTML = `<b>${ntaName(cell)}</b>
          Priority ${p == null ? "–" : Math.round(p)}/100 · ${Math.round(cell.pop).toLocaleString()} residents<br>
          <span>${top ? "→ " + top.iv.label : "no intervention ranked"}</span>`;
      });
      map.on("mouseleave", "grid-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredId != null) map.setFeatureState({ source: "grid", id: hoveredId }, { hover: false });
        hoveredId = null;
        tooltip.classList.add("hidden");
      });
      map.on("click", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["grid-fill"] });
        if (!feats.length) { clearCell(); return; }
        selectedId = feats[0].id;
        map.setFilter("grid-selected", ["==", ["id"], selectedId]);
        renderCell(CELL_BY_ID[selectedId]);
      });
    });
  }

  // ---------------------------------------------------------- UI wiring
  function wireUI() {
    $("panel-collapse").onclick = () => {
      $("panel").classList.add("collapsed");
      $("panel-open").classList.remove("hidden");
    };
    $("panel-open").onclick = () => {
      $("panel").classList.remove("collapsed");
      $("panel-open").classList.add("hidden");
    };
    document.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.onclick = () => {
        const body = $(btn.dataset.toggle);
        const open = !body.classList.contains("collapsed");
        body.classList.toggle("collapsed", open);
        btn.setAttribute("aria-expanded", String(!open));
      };
    });
    const useBasis = (apply, basis) => () => {
      if (apply() === false) return;
      setBasis(basis);
      renderWeights();
      onWeightsChanged();
    };
    $("weights-reset").onclick = CAUSAL && CAUSAL.shapley
      ? useBasis(applyShapleyWeights, "shapley")
      : useBasis(applyEqualWeights, "equal");
    $("preset-shapley").onclick = useBasis(applyShapleyWeights, "shapley");
    $("preset-equal").onclick = useBasis(applyEqualWeights, "equal");
    $("diagram-expand").onclick = () => {
      $("diagram-overlay").classList.remove("hidden");
      requestAnimationFrame(() => {
        fullDg.fit();
        if (selectedId != null) updateDiagramForCell(CELL_BY_ID[selectedId]);
      });
    };
    $("diagram-close").onclick = () => $("diagram-overlay").classList.add("hidden");
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("diagram-overlay").classList.add("hidden");
    });
    $("flow-toggle").onclick = () => {
      const paused = $("diagram-overlay").classList.toggle("diagram-paused");
      $("flow-toggle").textContent = paused ? "Resume flow" : "Pause flow";
    };
  }

  // ---------------------------------------------------------- boot
  (async function boot() {
    try {
      const dgData = await loadAll();
      $("loading-message").textContent = "Preparing map layers";
      miniDg = new window.HeatscapeDiagram.Diagram($("diagram-mini"), dgData, { labelChars: 14 });
      fullDg = new window.HeatscapeDiagram.Diagram($("diagram-full"), dgData, { labelChars: 18 });
      renderDiagramLegend();
      renderChips();
      renderScalePicker();
      if (!CAUSAL || !CAUSAL.shapley) $("preset-shapley").classList.add("hidden");
      setBasis(weightBasis);
      renderWeights();
      wireUI();

      // Minimal hook for the headless smoke test (test_weights.js).
      // Exposes only what the test needs to drive the app; no app code reads it.
      window.__heatscapeTest = {
        setBasis(basis) {
          if (basis === "shapley") applyShapleyWeights();
          else applyEqualWeights();
          setBasis(basis);
          clearScoreCache();
        },
        weights() { return JSON.parse(JSON.stringify(weights)); },
        varOrder() { return META.varOrder.slice(); },
        categories() { return META.categories.map((c) => ({ key: c.key, node: c.node, vars: c.vars.slice() })); },
        diagramNodeIds() { return miniDg.data.nodes.map((n) => n.id); },
        sink() { return window.HeatscapeDiagram.SINK; },
        scoreAll() {
          return CELLS.filter((c) => c.pop >= POP_GATE)
                      .map((c) => priority(c) || 0);
        },
        sampleCellId() {
          const c = CELLS.find((x) => x.pop >= POP_GATE && x.pcts.some((p) => p != null));
          return c ? c.id : null;
        },
        selectCell(id) { if (id != null) renderCell(CELL_BY_ID[id]); },
        activationFor(id) {
          return id == null ? {} : nodeActivation(CELL_BY_ID[id]);
        },
      };
      initMap(buildGeojson());
    } catch (err) {
      // Two failures land here and they want different advice, so name both.
      // A TypeError during boot almost always means the browser is running a
      // cached older app.js against freshly-fetched JSON: the data files are
      // fetched with `cache: "no-cache"` and revalidate, a script tag does not,
      // so the two can drift apart and the old code reads a field the new
      // payload dropped. That is what "reading 'toFixed'" and its relatives mean
      // here — not a bad file on disk. A fetch failure is the other case, and
      // there the usual cause is opening index.html over file://.
      console.error(err);
      const stale = err instanceof TypeError;
      $("loading-title").textContent = stale
        ? "Stale copy in the browser cache" : "Could not load data";
      $("loading-message").textContent = err.message + (stale
        ? " — this is what a cached older app.js looks like when it meets current data. Hard-reload (⇧⌘R / Ctrl-⇧-R), or run `python3 serve.py` instead of `python3 -m http.server`, which sends no-store on everything."
        : " — serve this folder over HTTP (`python3 serve.py`) rather than opening the file directly.");
      document.querySelector(".loading-modal__spinner").style.display = "none";
    }
  })();
})();
