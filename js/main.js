(function () {
  "use strict";

  var T = window.T || {};
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- Intro splash ---------- */
  var intro = $(".intro");
  if (intro && root.classList.contains("js-intro")) {
    try { sessionStorage.setItem("intro", "1"); } catch (e) {}
    setTimeout(function () { intro.remove(); root.classList.remove("js-intro"); }, 2500);
  }

  /* ---------- Photo strip: duplicate the track for a seamless loop ---------- */
  var track = $(".strip__track");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- Photos: soft placeholder until a real photo exists ---------- */
  $$(".photo img").forEach(function (img) {
    var fig = img.closest(".photo");
    var miss = function () { fig.classList.add("is-missing"); };
    if (img.complete && img.naturalWidth === 0) miss();
    img.addEventListener("error", miss);
  });

  /* ---------- Theme toggle ---------- */
  var themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("theme", next);
    });
  }

  /* ---------- Header: scroll state + progress + mobile menu ---------- */
  var header = $(".header");
  var burger = $("#burger");
  var nav = $("#nav");
  var progress = $(".progress");

  function setMenu(open) {
    header.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? T.closeMenu : T.openMenu);
  }
  burger.addEventListener("click", function () { setMenu(!header.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 960px)").addEventListener("change", function (mq) { if (mq.matches) setMenu(false); });

  /* ---------- Scroll effects (one rAF loop): header, progress, parallax ---------- */
  var parallax = reduceMotion ? [] : $$("[data-speed]");
  var heroBg = reduceMotion ? null : $(".hero__bg");
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    header.classList.toggle("is-scrolled", y > 20);
    var max = document.documentElement.scrollHeight - vh;
    if (progress && max > 0) progress.style.setProperty("--p", Math.min(1, y / max).toFixed(4));

    if (heroBg && y < vh * 1.2) heroBg.style.translate = "0 " + (y * 0.22).toFixed(1) + "px";

    for (var i = 0; i < parallax.length; i++) {
      var el = parallax[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var offset = (r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.speed);
      el.style.translate = "0 " + offset.toFixed(1) + "px";
    }
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", requestFrame, { passive: true });
  window.addEventListener("resize", requestFrame);
  frame();

  /* ---------- Menu: tabs, search, filters ---------- */
  var tabsEl = $("#menuTabs");
  var tabsWrap = $(".tabs-wrap");
  var panelsEl = $("#menuPanels");
  var panels = $$(".menu__panel", panelsEl);
  var tabs = tabsEl ? $$(".tab", tabsEl) : [];
  var search = $("#menuSearch");
  var chips = $$(".chip");
  var emptyEl = $("#menuEmpty");

  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.classList.toggle("is-active", on);
    });
  }
  if (tabs.length) {
    tabsEl.addEventListener("click", function (e) {
      var tab = e.target.closest(".tab");
      if (!tab || tab.getAttribute("aria-selected") === "true") return;
      selectTab(tab);
      tab.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
    });
    tabsEl.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
    selectTab(tabs[0]);
  }

  function applyFilter() {
    var q = (search ? search.value : "").trim().toLowerCase();
    var active = chips.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
                      .map(function (c) { return c.dataset.filter; });
    var searching = q.length > 0 || active.length > 0;
    panelsEl.classList.toggle("is-searching", searching);
    if (tabsWrap) tabsWrap.classList.toggle("is-muted", searching);

    var total = 0;
    panels.forEach(function (panel) {
      var shown = 0;
      $$(".menu-item", panel).forEach(function (item) {
        var tags = (item.dataset.tags || "").split(" ");
        var ok = (!q || (item.dataset.q || "").indexOf(q) !== -1) &&
                 active.every(function (f) { return tags.indexOf(f) !== -1; });
        item.hidden = !ok;
        if (ok) shown++;
      });
      panel.classList.toggle("is-empty", searching && shown === 0);
      total += shown;
    });
    if (emptyEl) emptyEl.hidden = !(searching && total === 0);
  }
  if (search) search.addEventListener("input", applyFilter);
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      applyFilter();
    });
  });

  /* ---------- "Open now" status (Kyiv time) ---------- */
  function kyivNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Kyiv", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date());
      var get = function (type) { return parts.find(function (p) { return p.type === type; }).value; };
      return { weekend: get("weekday") === "Sat" || get("weekday") === "Sun", minutes: +get("hour") * 60 + +get("minute") };
    } catch (err) {
      var d = new Date();
      return { weekend: d.getDay() === 0 || d.getDay() === 6, minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function toMinutes(hhmm) { var p = String(hhmm).split(":"); return +p[0] * 60 + (+p[1] || 0); }

  var now = kyivNow();
  $$("[data-hours]").forEach(function (el) {
    var hours;
    try { hours = JSON.parse(el.getAttribute("data-hours")); } catch (err) { return; }
    var range = now.weekend ? hours.we : hours.wd;
    if (!range) return;
    var open = now.minutes >= toMinutes(range[0]) && now.minutes < toMinutes(range[1]);
    el.classList.add(open ? "is-open" : "is-closed");
    el.textContent = open ? T.open : T.closed;
  });

  /* ---------- Map: switch between cafés ---------- */
  var mapFrame = $("#mapFrame");
  var mapOpen = $("#mapOpen");
  var mapTabs = $$(".map__tab");

  function loadMap() {
    if (mapFrame && !mapFrame.getAttribute("src")) mapFrame.setAttribute("src", mapFrame.dataset.src);
  }
  function selectMap(tab) {
    mapTabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t === tab)); });
    mapFrame.setAttribute("src", tab.dataset.embed);
    mapOpen.setAttribute("href", tab.dataset.link);
  }
  mapTabs.forEach(function (tab) { tab.addEventListener("click", function () { selectMap(tab); }); });
  $$("[data-map]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var tab = mapTabs[+btn.dataset.map];
      if (!tab || !mapFrame) return; // fall back to the Google Maps link
      e.preventDefault();
      selectMap(tab);
      document.getElementById("map").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  });

  /* ---------- Soft reveal on scroll ---------- */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    $$(".hero__inner, .features, .timeline, .section-head, .locations__grid, .reviews__grid").forEach(function (group) {
      $$(".reveal", group).forEach(function (el, i) { el.style.setProperty("--delay", (Math.min(i, 5) * 0.09) + "s"); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add("is-visible");
        io.unobserve(el);
        setTimeout(function () { el.style.setProperty("--delay", "0s"); }, 1400);
        if (el.id === "map") loadMap();
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });

    // load the map a bit before it scrolls into view
    if (mapFrame) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { loadMap(); obs.disconnect(); }
      }, { rootMargin: "400px 0px" }).observe(mapFrame);
    }
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    loadMap();
  }

  /* ---------- Card tilt + magnetic buttons (mouse only) ---------- */
  if (finePointer && !reduceMotion) {
    $$(".location").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
    $$(".magnetic").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.translate = (dx * 0.22).toFixed(1) + "px " + (dy * 0.32).toFixed(1) + "px";
      });
      btn.addEventListener("pointerleave", function () { btn.style.translate = ""; });
    });
  }

  /* ---------- Active nav link ---------- */
  var links = $$(".nav__link");
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main section[id]").forEach(function (s) { spy.observe(s); });
  }


  /* ---------- "Back to top" / logo: scroll to the very top ---------- */
  $$('a[href="#top"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      setMenu(false);
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
