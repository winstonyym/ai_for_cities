/* =========================================================================
   AI for Cities — hero globe
   A dotted Earth built from an embedded 720x360 land bitmask (landmask.js),
   rendered with three.js: point-cloud continents, fresnel atmosphere,
   graticule, city markers with projected HTML labels, and animated great-
   circle arcs. No network requests, no textures.
   ========================================================================= */

(function () {
  "use strict";

  var canvas = document.getElementById("globe-canvas");
  if (!canvas || typeof THREE === "undefined" || !window.AI4C_LANDMASK) return;

  /* --- capability + motion gates ---------------------------------------- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    var probe = document.createElement("canvas");
    if (!(probe.getContext("webgl") || probe.getContext("experimental-webgl"))) return;
  } catch (e) { return; }

  var R = 1;                                   // globe radius, world units
  var stage = canvas.parentElement;
  var labelLayer = document.getElementById("globe-labels");

  /* --- land mask --------------------------------------------------------- */
  var MASK = window.AI4C_LANDMASK;
  var maskBytes = (function (b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  })(MASK.bits);

  function isLand(lat, lon) {
    var row = Math.floor(((90 - lat) / 180) * MASK.h);
    var col = Math.floor(((lon + 180) / 360) * MASK.w);
    if (row < 0) row = 0; if (row >= MASK.h) row = MASK.h - 1;
    col = ((col % MASK.w) + MASK.w) % MASK.w;
    var bit = row * MASK.w + col;
    return (maskBytes[bit >> 3] >> (7 - (bit & 7))) & 1;
  }

  function toVec(lat, lon, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* --- renderer ---------------------------------------------------------- */
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 3.6);

  var root = new THREE.Group();       // scroll / layout transforms
  var globe = new THREE.Group();      // spin
  root.add(globe);
  scene.add(root);
  globe.rotation.z = -0.41;           // axial tilt, reads as "a planet"

  /* --- 1. continents as points ------------------------------------------ */
  var isSmall = window.innerWidth < 760;
  var SAMPLES = isSmall ? 34000 : 76000;

  var pos = [], col = [], siz = [], pha = [];
  var cCool = new THREE.Color("#a9cbdb");
  var cTeal = new THREE.Color("#5fd3ae");
  var cWarm = new THREE.Color("#f2a25c");
  var cRed = new THREE.Color("#e35d5d");
  var tmp = new THREE.Color();

  var golden = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < SAMPLES; i++) {
    var y = 1 - (i / (SAMPLES - 1)) * 2;
    var rad = Math.sqrt(Math.max(0, 1 - y * y));
    var th = golden * i;
    var x = Math.cos(th) * rad, z = Math.sin(th) * rad;

    var lat = Math.asin(y) * 180 / Math.PI;
    var lon = Math.atan2(z, -x) * 180 / Math.PI - 180;
    if (lon < -180) lon += 360;
    if (!isLand(lat, lon)) continue;

    pos.push(x * R, y * R, z * R);

    var r = Math.random();
    if (r > 0.965) tmp.copy(cRed);
    else if (r > 0.90) tmp.copy(cWarm);
    else if (r > 0.72) tmp.copy(cTeal);
    else tmp.copy(cCool);
    // slight per-point luminance jitter keeps the field from looking printed
    var lum = 0.74 + Math.random() * 0.55;
    col.push(tmp.r * lum, tmp.g * lum, tmp.b * lum);
    siz.push(0.72 + Math.random() * 0.75);
    pha.push(Math.random() * Math.PI * 2);
  }

  var dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  dotGeo.setAttribute("aColor", new THREE.Float32BufferAttribute(col, 3));
  dotGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(siz, 1));
  dotGeo.setAttribute("aPhase", new THREE.Float32BufferAttribute(pha, 1));

  var dotUniforms = {
    uTime: { value: 0 },
    uPointScale: { value: 6 },
    uOpacity: { value: 1 }
  };

  var dots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({
    uniforms: dotUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: [
      "attribute vec3 aColor;",
      "attribute float aSize;",
      "attribute float aPhase;",
      "uniform float uTime;",
      "uniform float uPointScale;",
      "varying vec3 vColor;",
      "varying float vFade;",
      "void main() {",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  vec3 n = normalize(normalMatrix * normalize(position));",
      "  float facing = dot(n, normalize(-mv.xyz));",
      // front hemisphere reads solid, far side survives as a faint ghost
      "  float f = smoothstep(-0.30, 0.42, facing);",
      "  vFade = 0.09 + 0.91 * pow(f, 1.35);",
      "  vFade *= 0.86 + 0.14 * sin(uTime * 1.1 + aPhase);",
      "  vColor = aColor;",
      "  gl_Position = projectionMatrix * mv;",
      "  gl_PointSize = aSize * uPointScale / max(0.001, -mv.z);",
      "  gl_PointSize *= 0.62 + 0.38 * f;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform float uOpacity;",
      "varying vec3 vColor;",
      "varying float vFade;",
      "void main() {",
      "  vec2 c = gl_PointCoord - vec2(0.5);",
      "  float d = length(c);",
      "  float a = smoothstep(0.5, 0.16, d);",
      "  if (a < 0.01) discard;",
      "  gl_FragColor = vec4(vColor, a * vFade * uOpacity);",
      "}"
    ].join("\n")
  }));
  dots.renderOrder = 2;
  globe.add(dots);

  /* --- 2. glass shell + atmosphere -------------------------------------- */
  var shellUniforms = { uOpacity: { value: 1 } };
  var shell = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.992, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: shellUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
      vertexShader: [
        "varying vec3 vN; varying vec3 vP;",
        "void main(){ vN = normalize(normalMatrix * normal);",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz;",
        "  gl_Position = projectionMatrix * mv; }"
      ].join("\n"),
      fragmentShader: [
        "uniform float uOpacity;",
        "varying vec3 vN; varying vec3 vP;",
        "void main(){",
        "  float rim = 1.0 - abs(dot(normalize(vN), normalize(-vP)));",
        "  float body = 0.46 + 0.30 * pow(rim, 2.6);",
        "  vec3 tint = mix(vec3(0.012,0.022,0.037), vec3(0.035,0.105,0.100), pow(rim,2.4));",
        "  gl_FragColor = vec4(tint, body * uOpacity);",
        "}"
      ].join("\n")
    })
  );
  shell.renderOrder = 1;
  globe.add(shell);

  var atmoUniforms = { uOpacity: { value: 1 } };
  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.22, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        "varying vec3 vN; varying vec3 vV;",
        "void main(){ vN = normalize(normalMatrix * normal);",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz;",
        "  gl_Position = projectionMatrix * mv; }"
      ].join("\n"),
      fragmentShader: [
        "uniform float uOpacity;",
        "varying vec3 vN; varying vec3 vV;",
        "void main(){",
        // rim-only: 0 at the disc centre, 1 at the silhouette
        "  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));",
        "  float i = pow(clamp(rim, 0.0, 1.0), 4.5) * 0.85;",
        "  vec3 c = mix(vec3(0.10,0.36,0.33), vec3(0.34,0.10,0.11), 0.30);",
        "  gl_FragColor = vec4(c, i * uOpacity);",
        "}"
      ].join("\n")
    })
  );
  atmosphere.renderOrder = 0;
  root.add(atmosphere);

  /* --- 3. graticule ------------------------------------------------------ */
  var gratPts = [];
  function pushRing(fn) {
    var prev = null;
    for (var d = 0; d <= 360; d += 3) {
      var v = fn(d);
      if (prev) gratPts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z);
      prev = v;
    }
  }
  for (var la = -60; la <= 60; la += 30) {
    (function (lat) { pushRing(function (lon) { return toVec(lat, lon - 180, R * 1.004); }); })(la);
  }
  for (var lo = -180; lo < 180; lo += 30) {
    (function (lon) {
      var prev = null;
      for (var t = -90; t <= 90; t += 3) {
        var v = toVec(t, lon, R * 1.004);
        if (prev) gratPts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z);
        prev = v;
      }
    })(lo);
  }
  var gratGeo = new THREE.BufferGeometry();
  gratGeo.setAttribute("position", new THREE.Float32BufferAttribute(gratPts, 3));
  var gratMat = new THREE.LineBasicMaterial({
    color: 0x4c7f88, transparent: true, opacity: 0.115, depthWrite: false
  });
  var graticule = new THREE.LineSegments(gratGeo, gratMat);
  graticule.renderOrder = 1;
  globe.add(graticule);

  /* --- 4. cities + arcs -------------------------------------------------- */
  var CITIES = [
    { name: "Ithaca, NY", lat: 42.444, lon: -76.502, hub: true, label: true, dx: -18, dy: -30 },
    { name: "New York City", lat: 40.713, lon: -74.006, label: true, dx: 26, dy: 22 },
    { name: "Singapore", lat: 1.352, lon: 103.820 },
    { name: "Manila", lat: 14.600, lon: 120.984 },
    { name: "London", lat: 51.507, lon: -0.128 },
    { name: "Tokyo", lat: 35.676, lon: 139.650 },
    { name: "Nairobi", lat: -1.292, lon: 36.822 },
    { name: "São Paulo", lat: -23.551, lon: -46.633 },
    { name: "Delhi", lat: 28.614, lon: 77.209 }
  ];

  var mkPos = [], mkSize = [], mkPhase = [];
  CITIES.forEach(function (c, idx) {
    var v = toVec(c.lat, c.lon, R * 1.012);
    c.vec = v;
    mkPos.push(v.x, v.y, v.z);
    mkSize.push(c.hub ? 2.6 : 1.85);
    mkPhase.push(idx * 0.7);
  });
  var mkGeo = new THREE.BufferGeometry();
  mkGeo.setAttribute("position", new THREE.Float32BufferAttribute(mkPos, 3));
  mkGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(mkSize, 1));
  mkGeo.setAttribute("aPhase", new THREE.Float32BufferAttribute(mkPhase, 1));

  var mkUniforms = { uTime: { value: 0 }, uPointScale: { value: 6 }, uOpacity: { value: 1 } };
  var markers = new THREE.Points(mkGeo, new THREE.ShaderMaterial({
    uniforms: mkUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      "attribute float aSize; attribute float aPhase;",
      "uniform float uTime; uniform float uPointScale;",
      "varying float vFade; varying float vPulse;",
      "void main(){",
      "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
      "  vec3 n = normalize(normalMatrix * normalize(position));",
      "  float facing = dot(n, normalize(-mv.xyz));",
      "  vFade = smoothstep(-0.05, 0.35, facing);",
      "  vPulse = fract(uTime * 0.42 + aPhase);",
      "  gl_Position = projectionMatrix * mv;",
      "  gl_PointSize = aSize * uPointScale / max(0.001,-mv.z) * 7.0;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform float uOpacity;",
      "varying float vFade; varying float vPulse;",
      "void main(){",
      "  vec2 c = gl_PointCoord - vec2(0.5);",
      "  float d = length(c) * 2.0;",
      "  float core = smoothstep(0.30, 0.06, d);",
      "  float ringR = mix(0.15, 0.94, vPulse);",
      "  float ring = smoothstep(0.10, 0.0, abs(d - ringR)) * (1.0 - vPulse);",
      "  float a = core + ring * 0.75;",
      "  if (a < 0.01) discard;",
      "  vec3 col = mix(vec3(0.37,0.83,0.68), vec3(1.0,0.94,0.86), core);",
      "  gl_FragColor = vec4(col, a * vFade * uOpacity);",
      "}"
    ].join("\n")
  }));
  markers.renderOrder = 3;
  globe.add(markers);

  /* Great-circle arcs from the Ithaca hub */
  var hub = CITIES[0].vec;
  var arcUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 } };
  var arcMat = new THREE.ShaderMaterial({
    uniforms: arcUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      "attribute float aT; attribute float aOffset;",
      "varying float vT; varying float vOffset;",
      "void main(){ vT = aT; vOffset = aOffset;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
    ].join("\n"),
    fragmentShader: [
      "uniform float uTime; uniform float uOpacity;",
      "varying float vT; varying float vOffset;",
      "void main(){",
      "  float head = fract(uTime * 0.19 + vOffset);",
      "  float d = abs(vT - head);",
      "  d = min(d, 1.0 - d);",
      "  float pulse = smoothstep(0.14, 0.0, d);",
      "  float base = 0.17 * smoothstep(0.0,0.12,vT) * smoothstep(1.0,0.88,vT);",
      "  float a = base + pulse * 0.72;",
      "  vec3 col = mix(vec3(0.28,0.66,0.60), vec3(0.95,0.78,0.45), pulse);",
      "  gl_FragColor = vec4(col, a * uOpacity);",
      "}"
    ].join("\n")
  });

  CITIES.slice(1).forEach(function (c, k) {
    var a = hub.clone(), b = c.vec.clone();
    var mid = a.clone().add(b).multiplyScalar(0.5);
    var lift = 1 + 0.34 * a.distanceTo(b) / (2 * R);
    mid.normalize().multiplyScalar(R * lift * 1.16);
    var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    var pts = curve.getPoints(96);
    var p = [], t = [], off = [];
    pts.forEach(function (v, j) {
      p.push(v.x, v.y, v.z);
      t.push(j / (pts.length - 1));
      off.push(k * 0.11);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aOffset", new THREE.Float32BufferAttribute(off, 1));
    var line = new THREE.Line(g, arcMat);
    line.renderOrder = 3;
    globe.add(line);
  });

  /* --- 5. HTML labels ---------------------------------------------------- */
  var labels = [];
  if (labelLayer) {
    CITIES.filter(function (c) { return c.label; }).forEach(function (c) {
      var el = document.createElement("span");
      el.className = "globe-label";
      el.innerHTML = '<i></i>' + c.name;
      labelLayer.appendChild(el);
      labels.push({ el: el, city: c });
    });
  }

  /* --- 6. sizing --------------------------------------------------------- */
  var W = 1, H = 1, dpr = 1, baseY = 0, visH = 2.2;

  function resize() {
    var rect = stage.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // World units visible at the globe's depth
    visH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
    var visW = visH * camera.aspect;

    var wide = W >= 900;
    // Diameter as a fraction of the viewport, then the scale that produces it
    var diam = wide
      ? Math.min(visH * 0.80, visW * 0.425)
      : Math.min(visH * 0.46, visW * 0.86);
    var scale = diam / (2 * R);

    root.scale.setScalar(scale);
    root.position.x = wide ? visW * 0.205 : 0;
    baseY = wide ? visH * 0.012 : visH * 0.22;
    root.position.y = baseY;

    // Point size tracks the globe's on-screen size, not the world scale
    var globePx = (diam / visH) * H * dpr;
    dotUniforms.uPointScale.value = globePx * 0.0102 * (isSmall ? 0.95 : 1);
    mkUniforms.uPointScale.value = globePx * 0.0094;
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  /* --- 7. interaction ---------------------------------------------------- */
  var spin = { y: -0.34, x: 0.17 };        // current
  var target = { y: -0.34, x: 0.17 };      // eased toward
  var velocity = 0.0;
  var dragging = false, lastX = 0, lastY = 0;
  var pointer = { x: 0, y: 0 };

  function onDown(e) {
    dragging = true;
    stage.classList.add("is-dragging");
    lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    lastY = (e.touches ? e.touches[0].clientY : e.clientY);
  }
  function onMove(e) {
    var cx = (e.touches ? e.touches[0].clientX : e.clientX);
    var cy = (e.touches ? e.touches[0].clientY : e.clientY);
    pointer.x = (cx / window.innerWidth) * 2 - 1;
    pointer.y = (cy / window.innerHeight) * 2 - 1;
    if (!dragging) return;
    var dx = cx - lastX, dy = cy - lastY;
    lastX = cx; lastY = cy;
    target.y += dx * 0.0052;
    target.x = Math.max(-0.85, Math.min(0.85, target.x + dy * 0.0032));
    velocity = dx * 0.00034;
  }
  function onUp() { dragging = false; stage.classList.remove("is-dragging"); }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  /* --- 8. external hooks (GSAP scroll) ----------------------------------- */
  var scrollP = 0;
  var baseOpacity = isSmall ? 0.9 : 1;

  window.AI4CGlobe = {
    setScroll: function (p) { scrollP = Math.max(0, Math.min(1, p)); },
    setOpacity: function (raw) {
      var o = raw * baseOpacity;
      dotUniforms.uOpacity.value = o;
      shellUniforms.uOpacity.value = o;
      atmoUniforms.uOpacity.value = o;
      mkUniforms.uOpacity.value = o;
      arcUniforms.uOpacity.value = o;
      gratMat.opacity = 0.115 * o;
      if (labelLayer) labelLayer.style.opacity = o;
    },
    points: pos.length / 3
  };
  window.AI4CGlobe.setOpacity(1);

  /* --- 9. loop ----------------------------------------------------------- */
  var clock = new THREE.Clock();
  var projected = new THREE.Vector3();
  var visible = true;

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.01 }).observe(stage);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    if (!dragging) {
      target.y += (reduceMotion ? 0 : 0.036) * dt * 60 * 0.016 + velocity;
      velocity *= 0.94;
    }
    spin.y += (target.y - spin.y) * 0.075;
    spin.x += (target.x - spin.x) * 0.075;

    globe.rotation.y = spin.y;
    globe.rotation.x = spin.x + pointer.y * 0.045;

    // scroll response: sink and tilt away as the hero leaves
    root.position.y = baseY - scrollP * visH * 0.42;
    root.rotation.z = scrollP * 0.16;
    atmosphere.scale.setScalar(1 + Math.sin(t * 0.6) * 0.006);

    dotUniforms.uTime.value = t;
    mkUniforms.uTime.value = t;
    arcUniforms.uTime.value = t;

    renderer.render(scene, camera);

    // labels follow their markers
    if (labels.length) {
      var rect = stage.getBoundingClientRect();
      for (var i = 0; i < labels.length; i++) {
        var L = labels[i];
        projected.copy(L.city.vec).applyMatrix4(globe.matrixWorld);
        var depth = projected.clone().project(camera);
        var facing = projected.clone().normalize().dot(
          camera.position.clone().sub(projected).normalize()
        );
        var on = facing > 0.12 && depth.z < 1;
        L.el.style.opacity = on ? String(Math.min(1, (facing - 0.12) * 4)) : "0";
        L.el.style.transform =
          "translate(" +
          ((depth.x * 0.5 + 0.5) * rect.width + (L.city.dx || 0)) + "px," +
          ((-depth.y * 0.5 + 0.5) * rect.height + (L.city.dy || 0)) + "px)" +
          " translate(-50%,-50%)";
      }
    }
  }
  frame();

  stage.classList.add("globe-ready");
})();
