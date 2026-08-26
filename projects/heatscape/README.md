# Heatscape NYC — Urban Heat Intervention Planner

A static, dependency-free web app (same architecture as `gridnberg/app`) that maps a
**250 m × 250 m grid over New York City** and recommends, for every populated cell, the
urban cooling intervention best matched to its context — derived from the causal systems
diagram in `../scm_tut/nyc-greenery.json` and the geospatial layers in `/data`.

## Run

```bash
cd heatscape
python3 serve.py          # or: npm run serve
# open http://localhost:8000
```

Opening `index.html` directly via `file://` will not work, because the app fetches
`data/grid_data.json`.

Use `serve.py` rather than `python3 -m http.server` while editing. `http.server` sends
no `Cache-Control`, which lets browsers apply *heuristic freshness* and reuse a response
without revalidating — so an edited `app.js`, `styles.css` or `data/diagram.json` can
keep serving the previous version until a hard reload. This has already bitten once: the
systems diagram went on rendering an old node layout after `data/diagram.json` had been
rewritten. `serve.py` sends `no-store`, so a reload always shows what is on disk. The
data fetches in `app.js` additionally pass `cache: "no-cache"`, so the app revalidates
even behind a server that does cache.

Any static host works for deployment; there, caching is worth having back (ideally with
hashed asset names).

## What you can do

- **Priority score layer** — composite risk from 9 indicator categories (Shapley-attributed
  weights by default), gated by residential population: no residents → no priority.
- **Top intervention layer** — each cell coloured by its best-matched intervention
  (street trees, cool roofs, permeable paving, outdoor cooling amenities, indoor cooling
  support, shaded pedestrian corridors, new green space).
- **Category risk layers** — any single category as a choropleth.
- **Click a cell** — the left panel shows its NTA, priority, ranked interventions, and all
  43 indicators grouped by category with percentile-vs-city bars (percentiles ranked
  across populated cells only; `↓` marks indicators where *low* values raise risk).
  The systems diagram lights up every node the cell activates.
- **Tune weights** — sliders for every category and every variable within a category;
  map, scores and intervention ranking update live.
- **Switch the weighting basis** — *Shapley* (the default: share of attributed variance in
  heat-emergency incidence) or *Equal* (every indicator counts the same). See below.
  Dragging any slider moves the basis to *custom*.
- **Systems diagram** — presentation-mode view of `nyc-greenery.json`. Selecting a cell
  activates the nodes whose indicators exceed the P62 risk threshold there and animates
  the information flow along every causal path toward *Heat emergency*.
  Expand to full screen for presenting.

## Indicator set

The 43 indicators are kept in step with the systems diagram by
`../scm_tut/rebuild_grid_indicators.py`, which rewrites `data/grid_data.json`:

- **removes** indicators with no node in the diagram — `canopy_height`,
  `bldg_cover`, `bldg_height`, all near-collinear duplicates of `canopy_cover`
  and `bldg_volume`. Keeping them meant the priority score counted canopy twice
  and built form three times.
- **adds** the diagram variables the app never exposed: urban shading, four
  health conditions (arthritis, cancer, physical disability), four behavioural
  measures in a new *Behaviour & mental health* category, and two deprivation
  measures.
- **recomputes every percentile** across populated cells on one basis.
- **binds every indicator and category to a diagram node id**, which is what
  makes presentation mode light up correctly on a cell click. Two category nodes
  (`heat`, `air`) previously pointed at ids that no longer existed and never lit
  at all.

### Reconciled against `nyc-greenery.json`

The current diagram (52 nodes, 95 edges) made two structural changes the app had to
follow:

- **`Population density` was removed**, taking the `pop_den` indicator with it. Its
  share of the *Plant street trees* and *New open & green space* factor sets was
  redistributed pro rata over the remaining factors. Nothing is lost: residents still
  enter every score through the population gate, and `pop_den` had no Shapley
  attribution to contribute.
- **`Heat vulnerability` was removed as an intermediate construct.** Its four inbound
  composites — urban heat island, social vulnerability, air pollution and human
  co-location — now feed `Heat emergency` directly, which is both the diagram's only
  sink and the outcome the SCM and the Shapley decomposition are estimated against.
  `diagram.js` animates flow toward it.

Re-run it after any change to the diagram:

```bash
python ../scm_tut/rebuild_grid_indicators.py --dry-run   # report the diff
python ../scm_tut/rebuild_grid_indicators.py             # apply (keeps a .bak)
python ../scm_tut/run_pipeline.py --stage export         # refresh the weights payload
```

## Shapley weighting basis (default)

Equal weighting encodes an assumption it cannot check: that every indicator matters
as much as every other. The **Shapley** preset — now the basis the app opens on, and
what *Reset* returns to — replaces that with an attribution.

`shapley_values.csv` (from `../scm_tut/scm_results/causal_weights/`) decomposes the
explained variance in **heat-emergency incidence** over the fitted SCM into each
indicator's average marginal contribution across coalition orderings, reported as
`shapley_share`. Those shares are merged into `data/causal_weights.json` and drive the
sliders.

**Shares are normalised within a category, not globally.** The decomposition is very
lopsided — `bldg_volume`, `ped_flow`, `pct_ac` and `poi_den` carry 76% of the total
attribution between them, and 18 of the 43 indicators receive zero. A single
global normalisation onto the `[0, 2]` slider range would pin most sliders to zero and
destroy the ordering *inside* every group. Splitting it in two puts the within-group
ordering on the variable sliders and the between-group ordering on the category
multiplier:

```
variable weight = shapley_share / mean(shapley_share within its category)
category weight = category total share / mean(category total across categories)
both clipped to [0, 2]
```

Three consequences worth stating plainly, because the interface states them too:

- **Nothing is shrunk.** A Shapley share is an attribution rather than an effect
  estimate, so there is no reliability term to shrink it toward 1. What the
  decomposition says is what the slider reads.
- **Direction is never taken from this basis.** A Shapley share is unsigned — it says
  how much of the fit an indicator accounts for, never which way it pushes. Every
  indicator keeps the polarity declared in the systems diagram; only magnitude changes.
- **Two categories fall out entirely.** *Physiological vulnerability* (0.01% of
  attribution) and *Behaviour & mental health* (0.05%) both round to a `0.00×`
  multiplier and contribute nothing to the priority score. That is a resolution
  artefact worth being explicit about: those indicators arrive as tract-level rates and
  barely vary between 250 m cells within a tract, so there is little for the model to
  attribute. It is not a finding that health burden is irrelevant. Raise the sliders,
  or switch to **Equal**, to see how much the ranking depends on it.

The attribution rests on 6 point fits and 16 bootstrap replicates, so shares under
about 1% are not separable from one another; indicators whose bootstrap interval
spans zero are tagged as such under their slider.

Indicators tagged **HVI input** (surface temperature, green space, canopy, AC coverage,
poverty, income) contribute to the published HVI formula, so part of their attribution
is definitional rather than causal. The interface says so.

Against Equal weighting, Shapley changes the score of 96% of populated cells and
replaces 45% of the top-decile priority cells.

If `data/causal_weights.json` is absent, the Shapley preset hides itself and the app
falls back to Equal weighting.

### The retired Causal preset

An earlier build carried a third basis whose weights came from back-door effect
estimates on heat-emergency incidence, shrunk by a reliability score `θ²/(θ²+se²)` and
by FCI's identification verdict. It has been removed from the interface.

`data/causal_weights.json` still carries all of it — effect, CI, p-value, estimator,
adjustment set, robustness value, refutation verdict, FCI tier, sign gate — because the
file is the pipeline's own export rather than an app asset, and
`run_pipeline.py --stage export` would write those fields back anyway. Nothing in the
app reads them; `test_weights.js` asserts that none of them reach the screen.

### Tests

```bash
npm install     # jsdom only
npm test        # headless smoke test
```

`test_weights.js` boots `app.js` in jsdom against the real data, switches presets,
selects a cell, drags a slider, and asserts that scores change, that the two bases
genuinely disagree about which cells to prioritise, that every indicator and category
resolves to a node in `nyc-greenery.json`, and that nothing throws.

It also compares `data/diagram.json` against `../scm_tut/nyc-greenery.json` node by node
— ids, positions and edges — because the first is a copy of the second and copies drift.
A re-authored layout that never made it into the app fails there rather than on screen.
One further check asserts the layout still fits legibly in the 250 px mini panel:
`Diagram.fit()` scales to the tighter of the two axes, so a very tall graph shrinks until
its labels are unreadable even though nothing is technically broken.

## Data pipeline

`../scripts/build_heatscape_grid.py` rebuilds `data/grid_data.json`:

- All layers aggregated / interpolated to a 250 m UTM-18N grid clipped to the NYC hull.
- Tract polygons (CDC PLACES health, ACS socioeconomics) and NTA tables (air quality,
  % households with AC) are **dasymetrically rasterised**: each 30 m population point
  inherits its tract/NTA value, and cells take the population-weighted mean — so
  prevalence lands where people actually live.
- Pedestrian flows: length-weighted mean predicted volume per street metre per cell.
- 1 m canopy height model aggregated to mean height + % cover ≥ 3 m.
- Percentiles ranked across the 10,081 populated cells (≥ 10 residents).

Requires `geopandas pyarrow rasterio scipy` and `data/crosswalk/tract_nta_crosswalk.csv`
(2020 census tract → NTA2020 equivalency, NYC Open Data `hm78-6dwm`).
