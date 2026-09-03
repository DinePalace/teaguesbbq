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

  /* =========================================================================
     Gallery Tag Filtering
     ========================================================================= */
  var filterButtons = Array.from(doc.querySelectorAll(".gallery-filter-btn"));
  var galleryFigures = Array.from(doc.querySelectorAll(".masonry figure, .food-gallery figure, .team-grid figure, [data-lightbox]"));

  if (filterButtons.length && galleryFigures.length) {
    function updateCounts() {
      filterButtons.forEach(function (btn) {
        var filter = btn.getAttribute("data-filter");
        var countSpan = btn.querySelector(".count");
        if (!countSpan) return;
        if (filter === "all") {
          countSpan.textContent = galleryFigures.length;
        } else {
          var count = galleryFigures.filter(function (fig) {
            var cat = (fig.getAttribute("data-category") || "").toLowerCase();
            return cat.indexOf(filter.toLowerCase()) !== -1;
          }).length;
          countSpan.textContent = count;
        }
      });
    }
    updateCounts();

    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = this.getAttribute("data-filter");
        filterButtons.forEach(function (b) { b.classList.remove("active"); });
        this.classList.add("active");

        galleryFigures.forEach(function (fig) {
          var cat = (fig.getAttribute("data-category") || "").toLowerCase();
          if (filter === "all" || cat.indexOf(filter.toLowerCase()) !== -1) {
            fig.classList.remove("filter-hidden");
            fig.classList.add("filter-show");
          } else {
            fig.classList.add("filter-hidden");
            fig.classList.remove("filter-show");
          }
        });
      });
    });
  }

  /* =========================================================================
     Interactive Lightbox Modal with Zoom, Slideshow & Touch Gestures
     ========================================================================= */
  if (galleryFigures.length) {
    var activeItems = [];
    var currentIndex = 0;
    var isZoomed = false;
    var isPlaying = false;
    var playTimer = null;
    var SLIDE_DURATION = 4000;

    function getVisibleItems() {
      var visibleFigs = galleryFigures.filter(function (fig) {
        return !fig.classList.contains("filter-hidden");
      });
      return visibleFigs.map(function (fig) {
        var img = fig.querySelector("img");
        var captionEl = fig.querySelector("figcaption");
        var title = (captionEl && captionEl.textContent.trim()) || (img && img.getAttribute("alt")) || "Teague's BBQ";
        return {
          src: img ? img.getAttribute("src") : "",
          alt: (img && img.getAttribute("alt")) || title,
          title: title,
          element: fig
        };
      });
    }

    // Build DOM
    var overlay = doc.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Image Lightbox");
    overlay.innerHTML =
      '<div class="lightbox-topbar">' +
        '<div class="lightbox-counter" id="lbCounter">1 / 1</div>' +
        '<div class="lightbox-actions">' +
          '<button class="lightbox-btn" id="lbPlay" aria-label="Toggle Slideshow" title="Slideshow (Space)">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path id="lbPlayIcon" d="M8 5v14l11-7z"/></svg>' +
          '</button>' +
          '<button class="lightbox-btn" id="lbZoom" aria-label="Toggle Zoom" title="Zoom (Z)">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path id="lbZoomPath" d="M11 8v6M8 11h6"/></svg>' +
          '</button>' +
          '<button class="lightbox-btn" id="lbClose" aria-label="Close Lightbox" title="Close (Esc)">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="lightbox-stage" id="lbStage">' +
        '<button class="lightbox-nav prev" id="lbPrev" aria-label="Previous image" title="Previous (←)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' +
        '</button>' +
        '<div class="lightbox-img-wrap" id="lbImgWrap">' +
          '<img class="lightbox-img" id="lbImg" src="" alt="">' +
        '</div>' +
        '<button class="lightbox-nav next" id="lbNext" aria-label="Next image" title="Next (→)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="lightbox-footer">' +
        '<div class="lightbox-caption" id="lbCaption">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c1 3-1 4-1 6 0 1 1 2 2 2s2-1 2-3c2 2 3 4 3 7a6 6 0 1 1-12 0c0-3 2-5 3-6 1 2 2 2 2 1 0-2-1-3-1-4 0-3 2-5 3-6Z"/></svg>' +
          '<span id="lbCaptionText"></span>' +
        '</div>' +
        '<div class="lightbox-hint">← / → navigate · Space slideshow · Z zoom · Esc close</div>' +
      '</div>' +
      '<div class="lightbox-progress" id="lbProgress"></div>';
    doc.body.appendChild(overlay);

    var lbImg = doc.getElementById("lbImg");
    var lbImgWrap = doc.getElementById("lbImgWrap");
    var lbCounter = doc.getElementById("lbCounter");
    var lbCaptionText = doc.getElementById("lbCaptionText");
    var lbClose = doc.getElementById("lbClose");
    var lbPrev = doc.getElementById("lbPrev");
    var lbNext = doc.getElementById("lbNext");
    var lbZoom = doc.getElementById("lbZoom");
    var lbPlay = doc.getElementById("lbPlay");
    var lbPlayIcon = doc.getElementById("lbPlayIcon");
    var lbZoomPath = doc.getElementById("lbZoomPath");
    var lbProgress = doc.getElementById("lbProgress");
    var lbStage = doc.getElementById("lbStage");

    function preload(src) {
      if (!src) return;
      var i = new Image();
      i.src = src;
    }

    function renderItem(direction) {
      if (!activeItems.length) return;
      var cur = activeItems[currentIndex];
      
      // Reset zoom
      if (isZoomed) toggleZoom(false);

      // Slide animation
      lbImg.className = "lightbox-img";
      if (direction === "next") {
        void lbImg.offsetWidth;
        lbImg.classList.add("slide-next");
      } else if (direction === "prev") {
        void lbImg.offsetWidth;
        lbImg.classList.add("slide-prev");
      }

      lbImg.src = cur.src;
      lbImg.alt = cur.alt;
      lbCounter.textContent = (currentIndex + 1) + " / " + activeItems.length;
      lbCaptionText.textContent = cur.title;

      // Preload next and previous
      var nextIdx = (currentIndex + 1) % activeItems.length;
      var prevIdx = (currentIndex - 1 + activeItems.length) % activeItems.length;
      preload(activeItems[nextIdx].src);
      preload(activeItems[prevIdx].src);

      // Reset slideshow progress if playing
      if (isPlaying) {
        resetProgress();
      }
    }

    function openLightbox(fig) {
      activeItems = getVisibleItems();
      if (!activeItems.length) return;
      var matchIdx = activeItems.findIndex(function (item) {
        return item.element === fig;
      });
      currentIndex = matchIdx >= 0 ? matchIdx : 0;
      renderItem();
      overlay.classList.add("active");
      doc.body.style.overflow = "hidden";
    }

    galleryFigures.forEach(function (fig) {
      fig.addEventListener("click", function (e) {
        e.preventDefault();
        openLightbox(fig);
      });
    });

    function closeLightbox() {
      overlay.classList.remove("active");
      doc.body.style.overflow = "";
      if (isPlaying) stopSlideshow();
      if (isZoomed) toggleZoom(false);
    }

    function showNext() {
      if (!activeItems.length) return;
      currentIndex = (currentIndex + 1) % activeItems.length;
      renderItem("next");
    }

    function showPrev() {
      if (!activeItems.length) return;
      currentIndex = (currentIndex - 1 + activeItems.length) % activeItems.length;
      renderItem("prev");
    }

    function toggleZoom(force) {
      isZoomed = typeof force === "boolean" ? force : !isZoomed;
      if (isZoomed) {
        lbImgWrap.classList.add("zoomed");
        lbZoom.classList.add("active");
        lbZoomPath.setAttribute("d", "M8 11h6");
      } else {
        lbImgWrap.classList.remove("zoomed");
        lbZoom.classList.remove("active");
        lbZoomPath.setAttribute("d", "M11 8v6M8 11h6");
      }
    }

    function resetProgress() {
      lbProgress.style.transition = "none";
      lbProgress.style.width = "0%";
      void lbProgress.offsetWidth;
      lbProgress.style.transition = "width " + SLIDE_DURATION + "ms linear";
      lbProgress.style.width = "100%";
    }

    function startSlideshow() {
      isPlaying = true;
      lbPlay.classList.add("active");
      lbPlayIcon.setAttribute("d", "M6 4h4v16H6zm8 0h4v16h-4z");
      resetProgress();
      playTimer = setInterval(function () {
        showNext();
      }, SLIDE_DURATION);
    }

    function stopSlideshow() {
      isPlaying = false;
      lbPlay.classList.remove("active");
      lbPlayIcon.setAttribute("d", "M8 5v14l11-7z");
      clearInterval(playTimer);
      playTimer = null;
      lbProgress.style.transition = "none";
      lbProgress.style.width = "0%";
    }

    function toggleSlideshow() {
      if (isPlaying) stopSlideshow();
      else startSlideshow();
    }

    // Button event listeners
    lbClose.addEventListener("click", closeLightbox);
    lbNext.addEventListener("click", function (e) { e.stopPropagation(); showNext(); });
    lbPrev.addEventListener("click", function (e) { e.stopPropagation(); showPrev(); });
    lbZoom.addEventListener("click", function (e) { e.stopPropagation(); toggleZoom(); });
    lbPlay.addEventListener("click", function (e) { e.stopPropagation(); toggleSlideshow(); });

    // Click on image to toggle zoom
    lbImg.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleZoom();
    });

    // Click backdrop to close
    lbStage.addEventListener("click", function (e) {
      if (e.target === lbStage || e.target === lbImgWrap) {
        closeLightbox();
      }
    });

    // Keyboard controls
    window.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("active")) return;
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowRight" || e.key === "KeyD" || e.key === "KeyL") {
        showNext();
      } else if (e.key === "ArrowLeft" || e.key === "KeyA" || e.key === "KeyH") {
        showPrev();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggleSlideshow();
      } else if (e.key === "z" || e.key === "Z") {
        toggleZoom();
      }
    });

    // Touch swipe gestures
    var touchStartX = 0;
    var touchStartY = 0;
    var touchEndX = 0;
    var touchEndY = 0;

    lbStage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    lbStage.addEventListener("touchend", function (e) {
      if (isZoomed) return;
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      var diffX = touchEndX - touchStartX;
      var diffY = touchEndY - touchStartY;

      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) showNext();
        else showPrev();
      } else if (diffY > 80 && Math.abs(diffY) > Math.abs(diffX)) {
        closeLightbox();
      }
    }, { passive: true });
  }
})();
