/* ============================================================
   NEON — interactions & animations
   ============================================================ */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* ---------- Preloader ---------- */
  function preloader() {
    const pre = document.getElementById("preloader");
    if (!pre) {
      document.body.classList.add("loaded");
      heroReveal();
      return;
    }
    const bar = pre.querySelector(".pre-bar i");
    const pct = pre.querySelector(".pre-pct");
    let p = 0;
    const finish = () => {
      pre.classList.add("done");
      document.body.classList.add("loaded");
      heroReveal();
      // guarantee removal even if the CSS transition is throttled
      setTimeout(() => { pre.style.display = "none"; }, 820);
    };
    const tick = () => {
      p += Math.max(4, (100 - p) * 0.12);
      if (p >= 100) p = 100;
      bar.style.width = p + "%";
      if (pct) pct.textContent = Math.round(p) + "%";
      if (p < 100) {
        setTimeout(tick, 70 + Math.random() * 70);
      } else {
        setTimeout(finish, 320);
      }
    };
    setTimeout(tick, 220);
  }

  /* ---------- Hero line-mask reveal ---------- */
  function heroReveal() {
    const lines = document.querySelectorAll("#hero .line-mask > span");
    const fades = document.querySelectorAll("#hero [data-hero-fade]");
    const showAll = () => {
      lines.forEach((s) => (s.style.transform = "none"));
      fades.forEach((s) => { s.style.opacity = "1"; s.style.transform = "none"; });
    };
    if (reduce) { showAll(); return; }
    lines.forEach((line, i) => {
      const a = line.animate(
        [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
        { duration: 900, delay: 120 + i * 130, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
      );
      a.addEventListener("finish", () => (line.style.transform = "none"));
    });
    fades.forEach((el, i) => {
      const a = el.animate(
        [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }],
        { duration: 800, delay: 560 + i * 110, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
      );
      a.addEventListener("finish", () => { el.style.opacity = "1"; el.style.transform = "none"; });
    });
    // hard fallback — guarantee the hero is visible even if WAAPI is throttled
    setTimeout(showAll, 2000);
  }

  /* ---------- Custom cursor + spotlight ---------- */
  function cursor() {
    if (!fine) return;
    const ring = document.querySelector(".cursor-ring");
    const dot = document.querySelector(".cursor-dot");
    const spot = document.querySelector(".spotlight");
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      spot.style.setProperty("--mx", mx + "px");
      spot.style.setProperty("--my", my + "px");
    });

    (function loop() {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    const hot = "a, button, .btn, .card, .magnetic, [data-cursor]";
    document.querySelectorAll(hot).forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hot"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hot"));
    });
    document.addEventListener("mouseleave", () => (spot.style.opacity = "0"));
    document.addEventListener("mouseenter", () => (spot.style.opacity = "1"));
  }

  /* ---------- Magnetic buttons ---------- */
  function magnetic() {
    if (!fine || reduce) return;
    document.querySelectorAll(".magnetic").forEach((el) => {
      const strength = parseFloat(el.dataset.strength || "0.4");
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = "translate(0,0)"));
    });
  }

  /* ---------- 3D tilt + glow-follow cards ---------- */
  function tilt() {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const max = 7;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--cx", px * 100 + "%");
        el.style.setProperty("--cy", py * 100 + "%");
        if (fine && !reduce) {
          const rx = (0.5 - py) * max * 2;
          const ry = (px - 0.5) * max * 2;
          el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        }
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
      });
    });
  }

  /* ---------- Animated counters ---------- */
  function counters() {
    const els = document.querySelectorAll("[data-count]");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const target = parseFloat(el.dataset.count);
        const dec = parseInt(el.dataset.decimals || "0", 10);
        const dur = 1600;
        const start = performance.now();
        const numEl = el.querySelector(".val") || el;
        const run = (t) => {
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = target * eased;
          numEl.textContent = v.toLocaleString("pt-BR", {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec,
          });
          if (p < 1) requestAnimationFrame(run);
          else numEl.textContent = target.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };
        requestAnimationFrame(run);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Scroll reveals (staggered) ---------- */
  function reveals() {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const delay = parseFloat(en.target.dataset.delay || "0");
        setTimeout(() => en.target.classList.add("in"), delay);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Header shrink + scroll progress ---------- */
  function scrollUI() {
    const header = document.getElementById("header");
    const prog = document.getElementById("progress");
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("shrink", y > 40);
      const h = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Boot ---------- */
  function finalizeStatic() {
    // Frozen-transition environments: snap everything to its visible end-state.
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const numEl = el.querySelector(".val") || el;
      numEl.textContent = target.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    });
    document.querySelectorAll(".line-mask > span").forEach((s) => (s.style.transform = "none"));
    document.querySelectorAll("#hero [data-hero-fade]").forEach((s) => { s.style.opacity = "1"; s.style.transform = "none"; });
  }

  function detectMotion(cb) {
    if (reduce) { cb(false); return; }
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0.01;transition:opacity .12s linear;pointer-events:none;";
    document.body.appendChild(probe);
    let settled = false;
    const cleanup = (ok) => { if (settled) return; settled = true; probe.remove(); cb(ok); };
    probe.addEventListener("transitionend", () => cleanup(true));
    requestAnimationFrame(() => (probe.style.opacity = "1"));
    setTimeout(() => (probe.style.opacity = "1"), 50);
    setTimeout(() => cleanup(false), 1200);
  }

  /* ---------- FAQ accordion ---------- */
  function faq() {
    const items = document.querySelectorAll(".faq-item");
    items.forEach((item) => {
      const q = item.querySelector(".faq-q");
      if (!q) return;
      q.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        items.forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    preloader();
    cursor();
    magnetic();
    tilt();
    counters();
    reveals();
    scrollUI();
    faq();
    detectMotion((ok) => {
      if (!ok) {
        document.documentElement.classList.add("no-anim");
        finalizeStatic();
      }
    });
  });
})();
