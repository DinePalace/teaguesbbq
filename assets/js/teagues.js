/* Teague's BBQ — light interactions: mobile nav, sticky header offset,
   reveal-on-scroll, and "today" hours highlight. No dependencies. */
(function () {
  "use strict";
  var doc = document;

  /* sticky header height -> --header-h so anchors clear it */
  var header = doc.querySelector(".site-header");
  function setHeaderH() {
    if (header) doc.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }
  setHeaderH();
  if (window.ResizeObserver && header) new ResizeObserver(setHeaderH).observe(header);
  window.addEventListener("resize", setHeaderH, { passive: true });

  /* mobile nav toggle */
  var toggle = doc.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = doc.body.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    doc.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () { doc.body.classList.remove("mobile-open"); });
    });
  }

  /* reveal on scroll */
  var reveals = doc.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* highlight today's row in any hours table (data-day = 0..6, Sun=0) */
  var today = new Date().getDay();
  doc.querySelectorAll("[data-day]").forEach(function (row) {
    if (parseInt(row.getAttribute("data-day"), 10) === today) row.classList.add("today");
  });
})();
