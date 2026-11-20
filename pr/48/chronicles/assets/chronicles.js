(function () {
  "use strict";

  var statusEl = document.querySelector(".chronicles-filter-status");
  var pills = Array.prototype.slice.call(document.querySelectorAll("[data-topic-filter]"));
  var cards = Array.prototype.slice.call(
    document.querySelectorAll("[data-filterable-cards] .chronicles-card, .chronicles-featured-hero .chronicles-card")
  );
  var searchInput = document.querySelector(".chronicles-search-input");
  var activeTopic = "all";
  var indexCache = null;

  function announce(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function cardMatches(card, topic, q) {
    var t = (card.getAttribute("data-topic") || "").toLowerCase();
    if (topic && topic !== "all" && t !== topic.toLowerCase()) return false;
    if (!q) return true;
    var hay = [
      card.getAttribute("data-title") || "",
      card.getAttribute("data-deck") || "",
      card.getAttribute("data-tags") || "",
      t
    ].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function applyFilters() {
    var q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var ok = cardMatches(card, activeTopic, q);
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    function hideSectionIfEmpty(section) {
      if (!section) return;
      var sectionCards = section.querySelectorAll(".chronicles-card");
      var any = false;
      sectionCards.forEach(function (card) {
        if (!card.hidden) any = true;
      });
      section.hidden = sectionCards.length > 0 && !any;
    }
    hideSectionIfEmpty(document.querySelector(".chronicles-featured-hero"));
    hideSectionIfEmpty(document.querySelector("[data-chronicles-latest]"));
    if (!cards.length) return;
    if (shown === 0) {
      announce("No stories match your filters. Try another topic or clear search.");
    } else {
      announce(shown + " stor" + (shown === 1 ? "y" : "ies") + " shown.");
    }
  }

  pills.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeTopic = btn.getAttribute("data-topic-filter") || "all";
      pills.forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      applyFilters();
    });
  });

  if (searchInput && cards.length) {
    searchInput.addEventListener("input", applyFilters);
  }

  /* —— Search results page —— */
  var resultsRoot = document.querySelector("[data-search-results]");
  function indexUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("chronicles.js") !== -1) {
        return src.replace(/chronicles\.js(?:\?.*)?$/, "search-index.json");
      }
    }
    return "../assets/search-index.json";
  }

  function scoreEntry(entry, tokens) {
    var title = (entry.title || "").toLowerCase();
    var deck = (entry.deck || "").toLowerCase();
    var topic = (entry.topic || "").toLowerCase();
    var tags = (entry.tags || []).join(" ").toLowerCase();
    var body = (entry.body || entry.excerpt || "").toLowerCase();
    var score = 0;
    tokens.forEach(function (tok) {
      if (!tok) return;
      if (title === tok) score += 50;
      if (title.indexOf(tok) !== -1) score += 20;
      if (topic.indexOf(tok) !== -1) score += 12;
      if (tags.indexOf(tok) !== -1) score += 10;
      if (deck.indexOf(tok) !== -1) score += 8;
      if (body.indexOf(tok) !== -1) score += 2;
    });
    return score;
  }

  function renderResults(entries, q) {
    if (!resultsRoot) return;
    resultsRoot.innerHTML = "";
    if (!q) {
      announce("Enter a search to find stories.");
      return;
    }
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    var ranked = entries
      .map(function (e) { return { e: e, s: scoreEntry(e, tokens) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
    if (!ranked.length) {
      announce("No results for “" + q + "”.");
      resultsRoot.innerHTML = '<p class="chronicles-empty">No matching stories. Try a broader topic or different wording.</p>';
      return;
    }
    announce(ranked.length + " result" + (ranked.length === 1 ? "" : "s") + " for “" + q + "”.");
    ranked.forEach(function (row) {
      var e = row.e;
      var a = document.createElement("article");
      a.className = "chronicles-card story-compact";
      a.innerHTML =
        '<a class="chronicles-card-link" href="' + (e.url || ("../" + e.slug + "/")) + '">' +
        '<div class="chronicles-card-body">' +
        '<p class="chronicles-card-meta">' + [e.content_type, e.topic, e.datePublished].filter(Boolean).join(" · ") + "</p>" +
        "<h3 class=\"chronicles-card-title\">" + escapeHtml(e.title || "") + "</h3>" +
        (e.deck ? "<p class=\"chronicles-card-deck\">" + escapeHtml(e.deck) + "</p>" : "") +
        "</div></a>";
      resultsRoot.appendChild(a);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadIndex(cb) {
    if (indexCache) return cb(indexCache);
    var req = new XMLHttpRequest();
    req.open("GET", indexUrl(), true);
    req.onload = function () {
      try {
        indexCache = JSON.parse(req.responseText);
      } catch (err) {
        indexCache = [];
      }
      cb(indexCache);
    };
    req.onerror = function () { cb([]); };
    req.send();
  }

  if (resultsRoot) {
    var params = new URLSearchParams(window.location.search);
    var q = params.get("q") || "";
    if (searchInput) searchInput.value = q;
    loadIndex(function (data) { renderResults(data, q); });
    var form = document.querySelector(".chronicles-search");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var next = (searchInput && searchInput.value) || "";
        var url = new URL(window.location.href);
        if (next) url.searchParams.set("q", next);
        else url.searchParams.delete("q");
        history.replaceState(null, "", url.toString());
        loadIndex(function (data) { renderResults(data, next.trim()); });
      });
    }
  }

  /* —— Share controls ——
     Keep click handlers minimal. Event Timing on this long article showed
     presentation delay (next paint), not handler cost, dominates INP — so
     avoid any synchronous DOM writes in the click turn (incl. aria-live status). */
  function afterNextPaint(fn) {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(fn, 0);
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(fn);
    });
  }

  function pushChroniclesEvent(name, params) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: name };
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] != null && params[k] !== "") payload[k] = params[k];
      });
    }
    window.dataLayer.push(payload);
  }

  document.querySelectorAll(".chronicles-share-controls").forEach(function (root) {
    var url = root.getAttribute("data-share-url") || window.location.href;
    var title = root.getAttribute("data-share-title") || document.title;
    var status = root.parentElement && root.parentElement.querySelector(".chronicles-share-status");
    var articlePage = document.querySelector("[data-chronicles-page='article']");
    var articleSlug = articlePage ? (articlePage.getAttribute("data-article-slug") || "") : "";

    function setStatus(msg) {
      if (!status) return;
      afterNextPaint(function () {
        status.textContent = msg || "";
      });
    }

    function trackShare(method) {
      if (!articlePage) return;
      pushChroniclesEvent("chronicles_share", {
        article_slug: articleSlug,
        content_group: "chronicles",
        share_method: method
      });
    }

    var nativeBtn = root.querySelector("[data-share-native]");
    if (nativeBtn) {
      if (!navigator.share) {
        nativeBtn.hidden = true;
      } else {
        nativeBtn.addEventListener("click", function () {
          trackShare(nativeBtn.getAttribute("data-share-method") || "native");
          // Invoke share as the only sync work (preserves user activation).
          navigator.share({ title: title, url: url }).catch(function () {});
        });
      }
    }
    function copyLink(successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          setStatus(successMsg || "Link copied.");
        }).catch(function () {
          setStatus("Could not copy link.");
        });
      } else {
        setStatus("Copy not available in this browser.");
      }
    }

    var copyBtn = root.querySelector("[data-share-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        trackShare(copyBtn.getAttribute("data-share-method") || "copy");
        copyLink("Link copied.");
      });
    }
    /* Instagram has no web share-URL intent; copy the article link for paste. */
    var igBtn = root.querySelector("[data-share-instagram]");
    if (igBtn) {
      igBtn.addEventListener("click", function () {
        trackShare(igBtn.getAttribute("data-share-method") || "instagram");
        copyLink("Link copied — paste it in Instagram.");
      });
    }
    root.querySelectorAll("a[data-share-method]").forEach(function (a) {
      a.addEventListener("click", function () {
        trackShare(a.getAttribute("data-share-method") || "unknown");
      });
    });
  });

  /* —— Chronicles measurement (article pages only) ——
     Shared GA4/dataLayer foundation — see docs/chronicles/lonko-chronicles-ga4-foundation.md */
  (function initChroniclesMeasure() {
    var page = document.querySelector("[data-chronicles-page='article']");
    if (!page) return;

    var slug = page.getAttribute("data-article-slug") || "";
    function measure(name, params) {
      var base = {
        article_slug: slug,
        content_group: "chronicles"
      };
      if (params) {
        Object.keys(params).forEach(function (k) {
          base[k] = params[k];
        });
      }
      pushChroniclesEvent(name, base);
    }

    var thresholds = [25, 50, 75, 90];
    var fired = {};
    function scrollPercent() {
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.pageYOffset || doc.scrollTop || (body && body.scrollTop) || 0;
      var height =
        Math.max(doc.scrollHeight, (body && body.scrollHeight) || 0) - window.innerHeight;
      if (height <= 0) return 100;
      return Math.min(100, Math.round((scrollTop / height) * 100));
    }
    function checkScroll() {
      var pct = scrollPercent();
      thresholds.forEach(function (t) {
        if (pct >= t && !fired[t]) {
          fired[t] = true;
          measure("chronicles_scroll_depth", { scroll_percent: t });
        }
      });
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();

    document.querySelectorAll('a[data-chronicles-outbound="source"]').forEach(function (a) {
      a.addEventListener("click", function () {
        measure("chronicles_outbound_source_click", {
          link_url: a.href,
          link_text: (a.textContent || "").trim().slice(0, 120)
        });
      });
    });

    function isSameOrigin(href) {
      try {
        return new URL(href, window.location.href).origin === window.location.origin;
      } catch (err) {
        return false;
      }
    }

    document
      .querySelectorAll(".chronicles-article-body a[href], .chronicles-related a[href]")
      .forEach(function (a) {
        a.addEventListener("click", function () {
          if (!isSameOrigin(a.href)) return;
          measure("chronicles_internal_link_click", {
            link_url: a.href,
            link_text: (a.textContent || "").trim().slice(0, 120)
          });
        });
      });

    document.querySelectorAll("#site-nav a[href], a.brand[href]").forEach(function (a) {
      a.addEventListener("click", function () {
        var label = (a.textContent || "").trim();
        if (a.classList.contains("brand")) label = "Home";
        measure("chronicles_to_site_nav", {
          nav_label: label.slice(0, 60),
          link_url: a.href
        });
      });
    });
  })();
})();
