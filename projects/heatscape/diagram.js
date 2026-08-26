/* ============================================================
   Heatscape NYC — causal-loop diagram renderer.

   Presentation-mode style view of nyc-greenery.json: subsystem-
   coloured nodes at their authored positions, curved causal links
   with +/- polarity, pan/zoom, and per-cell "activation": active
   nodes glow and information flow is animated along every directed
   path from the activated drivers to the outcome node (heat
   emergency incidence).
   ============================================================ */
(function () {
  "use strict";

  const SUBSYSTEM_COLORS = {
    Demographics: "#F94144", "Land Use": "#F3722C", Housing: "#F8961E",
    Transportation: "#F9844A", Infrastructure: "#F9C74F", Energy: "#90BE6D",
    Utilities: "#43AA8B", Environment: "#4D908E", Economy: "#577590",
    Governance: "#277DA1", Finance: "#54478C", Health: "#0DB39E",
    Social: "#F29E4C", Others: "#C8C7D6",
  };

  // Terminal node of the systems diagram — every causal path is animated
  // toward it. nyc-greenery.json removed the intermediate "Heat vulnerability"
  // construct and wired its four inbound composites (urban heat island, social
  // vulnerability, air pollution, human co-location) straight into
  // "Heat emergency", which is now the only sink in the graph and is also the
  // outcome the SCM and the Shapley decomposition are estimated against.
  const SINK = "heat_emergency_1785298152221";
  const NODE_R = 13;
  const SVGNS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /** Curved cubic path between node centres, trimmed to circle edges. */
  function pathFor(sx, sy, tx, ty, r) {
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const sxE = sx + ux * r, syE = sy + uy * r;
    const txE = tx - ux * (r + 4), tyE = ty - uy * (r + 4);
    const cdx = txE - sxE, cdy = tyE - syE;
    const cLen = Math.hypot(cdx, cdy) || 1;
    const px = -cdy / cLen, py = cdx / cLen;
    const bulge = Math.min(cLen * 0.2, 40);
    const c1x = sxE + cdx * 0.35 + px * bulge, c1y = syE + cdy * 0.35 + py * bulge;
    const c2x = sxE + cdx * 0.78, c2y = syE + cdy * 0.78;
    return `M${sxE},${syE} C${c1x},${c1y} ${c2x},${c2y} ${txE},${tyE}`;
  }

  function wrapLabel(text, maxChars) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }

  class Diagram {
    constructor(container, data, opts = {}) {
      this.container = container;
      this.data = data;
      this.opts = Object.assign({ labelChars: 16, onNodeHover: null }, opts);
      this.nodeById = {};
      data.nodes.forEach((n) => (this.nodeById[n.id] = n));
      this.adj = {}; // source -> [targets]
      data.links.forEach((l) => {
        (this.adj[l.source] = this.adj[l.source] || []).push(l.target);
      });
      this._build();
      this._bindPanZoom();
      this.fit();
    }

    _build() {
      const c = this.container;
      c.innerHTML = "";
      this.svg = el("svg", { xmlns: SVGNS }, c);
      const defs = el("defs", {}, this.svg);
      for (const [id, cls] of [["dg-arrow-pos", "dg-marker-pos"], ["dg-arrow-neg", "dg-marker-neg"]]) {
        const m = el("marker", {
          id: id + "-" + (this._uid = Math.random().toString(36).slice(2, 7)),
          viewBox: "0 0 10 10", refX: 8, refY: 5,
          markerWidth: 6.5, markerHeight: 6.5, orient: "auto-start-reverse",
        }, defs);
        el("path", { d: "M0,0 L10,5 L0,10 z", class: cls }, m);
        this[id] = m.getAttribute("id");
      }
      this.g = el("g", {}, this.svg);

      // links
      this.linkEls = [];
      this.data.links.forEach((l) => {
        const s = this.nodeById[l.source], t = this.nodeById[l.target];
        if (!s || !t) return;
        const neg = l.polarity === "-";
        const p = el("path", {
          d: pathFor(s.x, s.y, t.x, t.y, NODE_R),
          class: "dg-link " + (neg ? "neg" : "pos"),
          "marker-end": `url(#${neg ? this["dg-arrow-neg"] : this["dg-arrow-pos"]})`,
        }, this.g);
        this.linkEls.push({ el: p, s: l.source, t: l.target, neg });
      });

      // nodes
      this.nodeEls = {};
      this.data.nodes.forEach((n) => {
        const grp = el("g", { class: "dg-node", transform: `translate(${n.x},${n.y})` }, this.g);
        const color = SUBSYSTEM_COLORS[n.subsystem] || SUBSYSTEM_COLORS.Others;
        el("circle", { class: "dg-pulse", r: NODE_R, stroke: color }, grp);
        el("circle", { r: NODE_R, fill: color }, grp);
        const lines = wrapLabel(n.label, this.opts.labelChars);
        const txt = el("text", { y: NODE_R + 11, "text-anchor": "middle" }, grp);
        lines.forEach((ln, i) => {
          const ts = el("tspan", { x: 0, dy: i === 0 ? 0 : 11 }, txt);
          ts.textContent = ln;
        });
        grp.addEventListener("mouseenter", () => this.opts.onNodeHover && this.opts.onNodeHover(n));
        grp.addEventListener("mouseleave", () => this.opts.onNodeHover && this.opts.onNodeHover(null));
        this.nodeEls[n.id] = grp;
      });
    }

    _bindPanZoom() {
      this.view = { x: 0, y: 0, k: 1 };
      const c = this.container;
      let drag = null;
      c.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener("pointermove", (e) => {
        if (!drag) return;
        this.view.x = drag.vx + (e.clientX - drag.x);
        this.view.y = drag.vy + (e.clientY - drag.y);
        this._apply();
      });
      c.addEventListener("pointerup", () => (drag = null));
      c.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0016);
        const k2 = Math.min(4, Math.max(0.12, this.view.k * factor));
        this.view.x = mx - ((mx - this.view.x) / this.view.k) * k2;
        this.view.y = my - ((my - this.view.y) / this.view.k) * k2;
        this.view.k = k2;
        this._apply();
      }, { passive: false });
      new ResizeObserver(() => this.fit(this._lastIds)).observe(c);
    }

    _apply() {
      this.g.setAttribute("transform",
        `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`);
    }

    /** Fit given node ids (or all) into the viewport. */
    fit(ids) {
      this._lastIds = ids;
      const nodes = (ids && ids.length ? ids.map((i) => this.nodeById[i]) : this.data.nodes).filter(Boolean);
      const w = this.container.clientWidth, h = this.container.clientHeight;
      if (!nodes.length || !w || !h) return;
      const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60;
      const minY = Math.min(...ys) - 55, maxY = Math.max(...ys) + 70;
      const k = Math.min(w / (maxX - minX), h / (maxY - minY), 2.5);
      this.view = {
        k,
        x: w / 2 - ((minX + maxX) / 2) * k,
        y: h / 2 - ((minY + maxY) / 2) * k,
      };
      this._apply();
    }

    /**
     * Highlight per-cell state.
     * activation: { nodeId: 0..1 }. Nodes >= threshold are "active";
     * flow is animated along all directed paths active -> SINK.
     */
    setActivation(activation, threshold = 0.6) {
      this.activation = activation || null;
      const anyActive = activation && Object.values(activation).some((v) => v >= threshold);
      const active = new Set();
      if (anyActive) {
        for (const id in activation) if (activation[id] >= threshold && this.nodeById[id]) active.add(id);
      }

      // edges on any directed path from an active node toward the sink
      const flowEdges = new Set();
      const onPath = new Set(active);
      if (anyActive) {
        // reverse reachability: nodes that can reach SINK
        const radj = {};
        this.data.links.forEach((l) => (radj[l.target] = radj[l.target] || []).push(l.source));
        const canReach = new Set([SINK]);
        const stack = [SINK];
        while (stack.length) {
          const cur = stack.pop();
          (radj[cur] || []).forEach((p) => { if (!canReach.has(p)) { canReach.add(p); stack.push(p); } });
        }
        // forward walk from each active node, only through nodes that reach the sink
        const visit = new Set();
        const stack2 = [...active].filter((a) => canReach.has(a));
        stack2.forEach((a) => visit.add(a));
        while (stack2.length) {
          const cur = stack2.pop();
          (this.adj[cur] || []).forEach((nxt) => {
            if (!canReach.has(nxt) && nxt !== SINK) return;
            flowEdges.add(cur + "→" + nxt);
            onPath.add(nxt);
            if (!visit.has(nxt)) { visit.add(nxt); stack2.push(nxt); }
          });
        }
        onPath.add(SINK);
      }

      // apply node classes
      for (const id in this.nodeEls) {
        const g = this.nodeEls[id];
        g.classList.toggle("active", active.has(id));
        g.classList.toggle("dim", anyActive && !onPath.has(id) && !active.has(id));
      }
      // apply link classes
      this.linkEls.forEach((l) => {
        const isFlow = flowEdges.has(l.s + "→" + l.t);
        l.el.classList.toggle("flow", isFlow);
        l.el.classList.toggle("dim", anyActive && !isFlow);
      });
      return { active: [...active], onPath: [...onPath] };
    }

    clearActivation() {
      this.setActivation(null);
    }
  }

  window.HeatscapeDiagram = { Diagram, SUBSYSTEM_COLORS, SINK };
})();
