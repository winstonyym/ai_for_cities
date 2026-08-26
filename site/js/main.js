/* =========================================================================
   AI for Cities — motion + interaction layer
   Lenis (smooth scroll) → GSAP ticker → ScrollTrigger, plus the small
   behaviours that make the glass feel physical.
   ========================================================================= */

(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasST = hasGSAP && typeof ScrollTrigger !== "undefined";
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. Lenis smooth scroll ------------------------------------ */
  var lenis = null;
  var LenisCtor = window.Lenis || (window.lenis && window.lenis.default);

  if (LenisCtor && !reduce) {
    lenis = new LenisCtor({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.6
    });

    if (hasGSAP) {
      lenis.on("scroll", function () { if (hasST) ScrollTrigger.update(); });
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
    }
  }

  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: -78, duration: 1.2 });
    else {
      var el = typeof target === "string" ? document.querySelector(target) : target;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 78, behavior: "smooth" });
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute("href");
    if (!id || id === "#" || !document.querySelector(id)) return;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      scrollTo(id);
      closeDrawer();
    });
  });

  /* ---------- 2. Navigation --------------------------------------------- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav__toggle");

  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle("is-stuck", window.pageYOffset > 24);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  if (lenis) lenis.on("scroll", onScrollNav);
  onScrollNav();

  function closeDrawer() {
    if (!nav) return;
    nav.classList.remove("is-open");
    if (toggle) { toggle.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  document.querySelectorAll(".nav__drawer a").forEach(function (a) {
    a.addEventListener("click", closeDrawer);
  });

  /* ---------- 3. Reveals ------------------------------------------------- */
  if (hasST && !reduce) {
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.0, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    gsap.utils.toArray("[data-reveal-stagger]").forEach(function (group) {
      gsap.to(group.children, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.075,
        scrollTrigger: { trigger: group, start: "top 86%", once: true }
      });
    });
  } else {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.style.opacity = 1; el.style.transform = "none";
    });
    document.querySelectorAll("[data-reveal-stagger]").forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (el) {
        el.style.opacity = 1; el.style.transform = "none";
      });
    });
  }

  /* ---------- 4. Hero intro --------------------------------------------- */
  var hero = document.querySelector(".hero");
  if (hero && hasGSAP && !reduce) {
    var tl = gsap.timeline({ delay: 0.15, defaults: { ease: "power3.out" } });
    tl.from(".hero__badge", { y: 18, opacity: 0, duration: 0.8 })
      .from(".hero__title .line > span", { yPercent: 112, duration: 1.05, stagger: 0.09 }, "-=0.55")
      .from(".hero__lede", { y: 20, opacity: 0, duration: 0.9 }, "-=0.6")
      .from(".hero__actions > *", { y: 18, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.6")
      .from(".hero__stats", { y: 26, opacity: 0, duration: 0.9 }, "-=0.5")
      .from(".globe-key__item", { x: 20, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.7")
      .from(".scroll-cue", { opacity: 0, duration: 0.8 }, "-=0.4");
  }

  /* ---------- 5. Globe ↔ scroll ----------------------------------------- */
  if (hero && hasST && window.AI4CGlobe) {
    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      onUpdate: function (self) {
        window.AI4CGlobe.setScroll(self.progress);
        window.AI4CGlobe.setOpacity(1 - self.progress * 0.9);
      }
    });
    gsap.to(".hero__copy", {
      y: -70, opacity: 0.15, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 }
    });
  }

  /* ---------- 6. Counters ------------------------------------------------ */
  function animateCount(el) {
    var to = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals || "0", 10);
    if (isNaN(to)) return;
    if (reduce || !hasGSAP) { el.textContent = to.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); return; }
    var o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.7, ease: "power2.out",
      onUpdate: function () {
        el.textContent = o.v.toLocaleString(undefined, {
          minimumFractionDigits: dec, maximumFractionDigits: dec
        });
      }
    });
  }
  document.querySelectorAll("[data-count]").forEach(function (el) {
    if (hasST && !reduce) {
      ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: function () { animateCount(el); } });
    } else { animateCount(el); }
  });

  /* ---------- 7. Marquee -------------------------------------------------- */
  document.querySelectorAll(".marquee").forEach(function (m) {
    var track = m.querySelector(".marquee__track");
    if (!track) return;
    var original = track.innerHTML;
    track.innerHTML = original + original;              // seamless loop
    if (reduce || !hasGSAP) return;
    var half = track.scrollWidth / 2;
    gsap.to(track, {
      x: -half, duration: half / 42, ease: "none", repeat: -1,
      modifiers: { x: function (x) { return (parseFloat(x) % half) + "px"; } }
    });
  });

  /* ---------- 8. Pointer-reactive glass --------------------------------- */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce) {
    document.querySelectorAll("[data-glow]").forEach(function (card) {
      var glow = card.querySelector(".theme-card__glow");
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        if (glow) {
          glow.style.left = (e.clientX - r.left - 120) + "px";
          glow.style.top = (e.clientY - r.top - 120) + "px";
          glow.style.right = "auto";
          glow.style.bottom = "auto";
        }
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width).toFixed(3));
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height).toFixed(3));
      });
    });

    document.querySelectorAll("[data-magnetic]").forEach(function (btn) {
      var strength = 0.28;
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        if (hasGSAP) gsap.to(btn, { x: x, y: y, duration: 0.5, ease: "power3.out" });
      });
      btn.addEventListener("pointerleave", function () {
        if (hasGSAP) gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.4)" });
      });
    });
  }

  /* ---------- 9. Year stamp --------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- 10. Refresh triggers once images settle -------------------- */
  window.addEventListener("load", function () { if (hasST) ScrollTrigger.refresh(); });
})();
