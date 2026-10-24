(function () {
  "use strict";

  var LS_AUDIO = "ai-interviews-audio-pos-v1";
  var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  var SITE_TITLE = "长镜 · AI";
  var SITE_LEDE = "精选 AI / 科技长视频访谈，带精读、解读与文稿。";
  var DEFAULT_DISCLAIMER = "中文精读由 AI 基于原始访谈改写，非官方翻译，可能存在偏差或错误；表述以原音视频为准。";
  var DEFAULT_ANALYSIS_DISCLAIMER = "AI 详细解读，非官方；请以原音视频为准";
  var DEFAULT_TRANSCRIPT_DISCLAIMER = "完整文稿可能含 ASR/整理误差；说话人标注以可辨认发言为准";
  var FORM_KEYS = [
    { id: "essay", label: "有精读" },
    { id: "analysis", label: "有解读" },
    { id: "transcript", label: "有文稿" }
  ];

  var W = window.WL;
  if (!W) {
    document.getElementById("view").innerHTML = '<div class="empty">未能加载 media.js</div>';
    return;
  }

  var state = {
    data: null,
    audioPos: {},
    query: "",
    show: "",
    topic: "",
    form: [],
    period: "",
    sort: "newest",
    route: { name: "list" },
    tab: "essay",
    videoOpen: false,
    tocOpen: false,
    detailStatus: {},
    detailInflight: {}
  };
  var routeGen = 0;
  var hashTimer = 0;
  var audioUi = { root: null, hintTimer: 0 };

  function loadAudioPos() {
    try {
      var raw = localStorage.getItem(LS_AUDIO);
      state.audioPos = raw ? JSON.parse(raw) : {};
    } catch (e) {
      state.audioPos = {};
    }
  }

  function saveAudioPos() {
    localStorage.setItem(LS_AUDIO, JSON.stringify(state.audioPos));
  }

  function coverSrc(it) {
    return it && it.cover ? it.cover : "";
  }

  function episodeDataUrl(id) {
    return "./data/episodes/" + encodeURIComponent(id) + ".json";
  }

  function isDetailReady(it) {
    return !!(it && it._detailLoaded);
  }

  function items() {
    return (state.data && state.data.items) || [];
  }

  function findItem(id) {
    for (var i = 0, arr = items(); i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function applyRoute(route) {
    state.route = route;
    if (route.name === "ep") return;
    state.query = route.q || "";
    state.sort = route.sort || "newest";
    state.form = (route.form || []).slice();
    state.period = route.period || "";
    if (route.name === "show") {
      state.show = route.slug || "";
      state.topic = route.topic || "";
    } else if (route.name === "topic") {
      state.topic = route.slug || "";
      state.show = route.show || "";
    } else {
      state.show = route.show || "";
      state.topic = route.topic || "";
    }
  }

  function catalogRoute(overrides) {
    var next = {
      name: state.route.name === "ep" ? "list" : state.route.name,
      slug: state.route.slug,
      q: state.query,
      show: state.show,
      topic: state.topic,
      form: state.form,
      period: state.period,
      sort: state.sort
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (k) { next[k] = overrides[k]; });
    }
    if (next.name === "show") {
      next.slug = next.show || next.slug;
      next.show = "";
    } else if (next.name === "topic") {
      next.slug = next.topic || next.slug;
      next.topic = "";
    }
    return next;
  }

  function writeHash(overrides) {
    var next = W.hashFor(catalogRoute(overrides));
    if (location.hash !== next) location.hash = next;
  }

  function scheduleHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () { writeHash(); }, 220);
  }

  function hasActiveFilters() {
    var extraShow = state.route.name === "show" ? false : !!state.show;
    var extraTopic = state.route.name === "topic" ? false : !!state.topic;
    return !!(state.query.trim() || extraShow || extraTopic || state.form.length || state.period || state.sort === "oldest");
  }

  function hasHeavyFilters() {
    var extraShow = state.route.name === "show" ? false : !!state.show;
    var extraTopic = state.route.name === "topic" ? false : !!state.topic;
    return !!(state.query.trim() || extraShow || extraTopic || state.form.length || state.period);
  }

  function wantsShelves() {
    return state.route.name === "list" && !hasHeavyFilters();
  }

  function clearHref() {
    if (state.route.name === "show") return W.hashFor({ name: "show", slug: state.route.slug });
    if (state.route.name === "topic") return W.hashFor({ name: "topic", slug: state.route.slug });
    return "#/";
  }

  function formSet() {
    var set = {};
    state.form.forEach(function (f) { set[f] = true; });
    return set;
  }

  function itemHasForm(it, key) {
    if (key === "essay") return W.hasEssay(it);
    if (key === "analysis") return W.hasAnalysis(it);
    if (key === "transcript") return W.hasTranscript(it);
    return false;
  }

  function matches(it) {
    if (state.show && W.showSlug(it.show) !== state.show) return false;
    if (state.topic && W.topicSlug(it.category) !== state.topic) return false;
    if (state.form.length) {
      var ok = false;
      for (var i = 0; i < state.form.length; i++) {
        if (itemHasForm(it, state.form[i])) { ok = true; break; }
      }
      if (!ok) return false;
    }
    if (state.period && periodOfItem(it.date) !== state.period) return false;
    var q = state.query.trim().toLowerCase();
    if (q) {
      var blob = [it.title, it.guest, it.show, it.summary].join(" ").toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }

  function todayISO() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function shiftISO(iso, days) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return "";
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function periodOfItem(date) {
    var today = todayISO();
    var day = String(date || "");
    if (!day) return "earlier";
    if (day >= shiftISO(today, -6)) return "week";
    if (day >= today.slice(0, 7) + "-01") return "month";
    return "earlier";
  }

  function periodLabel(period) {
    if (period === "week") return "本周";
    if (period === "month") return "本月";
    if (period === "earlier") return "更早";
    return "";
  }

  function collectPeriods() {
    var counts = { week: 0, month: 0, earlier: 0 };
    items().forEach(function (it) {
      var p = periodOfItem(it.date);
      counts[p] += 1;
    });
    return [
      { id: "week", name: "本周", count: counts.week },
      { id: "month", name: "本月", count: counts.month },
      { id: "earlier", name: "更早", count: counts.earlier }
    ];
  }

  function fmtDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "—";
    var today = todayISO();
    if (p[0] === today.slice(0, 4)) return Number(p[1]) + "月" + Number(p[2]) + "日";
    return p[0] + "年" + Number(p[1]) + "月" + Number(p[2]) + "日";
  }

  function sortItems(list) {
    var dir = state.sort === "oldest" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      var da = a.date || "";
      var db = b.date || "";
      if (da !== db) return da < db ? -dir : dir;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

  function filteredItems() {
    return sortItems(items().filter(matches));
  }

  function collectShows() {
    var map = {};
    items().forEach(function (it) {
      var slug = W.showSlug(it.show);
      if (!slug) return;
      if (!map[slug]) {
        map[slug] = { slug: slug, name: W.showDisplay(it.show), count: 0 };
      }
      map[slug].count += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name, "zh");
    });
  }

  function collectTopics() {
    var known = W.topics();
    var counts = {};
    items().forEach(function (it) {
      var slug = W.topicSlug(it.category);
      counts[slug] = (counts[slug] || 0) + 1;
    });
    var list = known.map(function (t) {
      return { slug: t.slug, name: t.name, count: counts[t.slug] || 0 };
    });
    items().forEach(function (it) {
      var slug = W.topicSlug(it.category);
      if (known.some(function (t) { return t.slug === slug; })) return;
      if (list.some(function (t) { return t.slug === slug; })) return;
      list.push({ slug: slug, name: it.category, count: counts[slug] || 0 });
    });
    return list.filter(function (t) { return t.count > 0; });
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    var h = Math.floor(m / 60);
    if (h) return h + ":" + String(m % 60).padStart(2, "0") + ":" + String(r).padStart(2, "0");
    return m + ":" + String(r).padStart(2, "0");
  }

  function neighbors(id) {
    var list = sortItems(items());
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null
    };
  }

  function setBodyMode(mode) {
    document.body.classList.toggle("paper", mode === "paper");
    document.documentElement.style.colorScheme = mode === "paper" ? "light" : "dark";
  }

  function renderTopbar() {
    var el = document.getElementById("topbar");
    var updated = (state.data && state.data.lastUpdated) || "—";
    if (state.route.name === "ep") {
      el.innerHTML =
        '<div class="topbar-inner">' +
          '<a class="back" href="#/">返回首页</a>' +
          '<a class="brand" href="#/">' + SITE_TITLE + "</a>" +
        "</div>";
      return;
    }
    el.innerHTML =
      '<div class="topbar-inner">' +
        '<a class="brand" href="#/">' + SITE_TITLE + "</a>" +
        '<nav class="nav" aria-label="主导航">' +
          '<a href="#/"' + (state.route.name === "list" && !state.show && !state.topic ? ' aria-current="page"' : "") + ">全部</a>" +
          '<a href="#q" data-focus-search>找一集</a>' +
        "</nav>" +
        '<p class="updated">更新于 ' + W.escapeHtml(updated) + "</p>" +
      "</div>";
  }

  function renderFooter() {
    var el = document.getElementById("footer");
    el.innerHTML =
      "<div>" + SITE_TITLE + "，" + SITE_LEDE + "不是私人观看列表。</div>" +
      "<div>精读与解读如存在，为 AI 改写，请以原音视频为准。列表读 <code>data/index.json</code>，单集读 <code>data/episodes/&lt;id&gt;.json</code>。</div>" +
      "<div>分享筛选：<code>#/?form=essay</code>、<code>#/show/sv101</code>、<code>#/topic/china</code>。</div>";
  }

  function formMarks(it) {
    var marks = [];
    if (W.hasEssay(it)) marks.push('<span class="mark essay">精读</span>');
    if (W.hasAnalysis(it)) marks.push('<span class="mark analysis">解读</span>');
    if (W.hasTranscript(it)) marks.push('<span class="mark transcript">文稿</span>');
    return marks.join("");
  }

  function tileHtml(it) {
    var src = coverSrc(it);
    var href = W.hashFor({ name: "ep", id: it.id });
    var showName = W.showDisplay(it.show);
    var cover = src
      ? '<img src="' + src + '" alt="" loading="lazy" width="640" height="360" />'
      : '<span class="thumb-empty" aria-hidden="true"></span>';
    var forms = formMarks(it);
    return (
      '<article class="tile" data-id="' + W.escapeHtml(it.id) + '">' +
        '<a class="tile-hit" href="' + href + '">' +
          '<div class="tile-cover">' +
            cover +
            '<div class="tile-overlay" aria-hidden="true">' +
              '<span class="tile-cta"><span class="play">▶</span>打开</span>' +
              (forms ? '<div class="tile-forms">' + forms + "</div>" : "") +
            "</div>" +
          "</div>" +
          '<h3 class="tile-title">' + W.escapeHtml(it.title) + "</h3>" +
          (it.guest ? '<p class="tile-guest">' + W.escapeHtml(it.guest) + "</p>" : "") +
          '<p class="tile-meta">' +
            '<span>' + W.escapeHtml(showName) + "</span>" +
            '<time datetime="' + W.escapeHtml(it.date || "") + '">' + W.escapeHtml(fmtDate(it.date)) + "</time>" +
          "</p>" +
        "</a>" +
      "</article>"
    );
  }

  function shelfHtml(opts) {
    var list = opts.items || [];
    if (!list.length) return "";
    var limit = opts.limit || 8;
    var preview = list.slice(0, limit);
    var more = opts.moreHref && list.length > preview.length
      ? '<a class="shelf-more" href="' + opts.moreHref + '">查看更多</a>'
      : "";
    return (
      '<section class="shelf">' +
        '<header class="shelf-head">' +
          '<div class="shelf-title">' +
            "<h2>" + W.escapeHtml(opts.title) + "</h2>" +
            '<span class="shelf-count">' + list.length + "</span>" +
          "</div>" +
          more +
        "</header>" +
        '<div class="shelf-track">' + preview.map(tileHtml).join("") + "</div>" +
      "</section>"
    );
  }

  function shelvesHtml() {
    var list = filteredItems();
    var buckets = { week: [], month: [], earlier: [] };
    list.forEach(function (it) {
      buckets[periodOfItem(it.date)].push(it);
    });
    var time = [
      { id: "week", title: "本周", items: buckets.week },
      { id: "month", title: "本月", items: buckets.month },
      { id: "earlier", title: "更早", items: buckets.earlier }
    ].map(function (b) {
      return shelfHtml({
        title: b.title,
        items: b.items,
        moreHref: W.hashFor({ name: "list", period: b.id, sort: state.sort })
      });
    }).join("");
    var showRows = collectShows().filter(function (s) { return s.count >= 2; }).map(function (s) {
      var showItems = list.filter(function (it) { return W.showSlug(it.show) === s.slug; });
      return shelfHtml({
        title: s.name,
        items: showItems,
        moreHref: W.hashFor({ name: "show", slug: s.slug })
      });
    }).join("");
    return (
      '<div class="browse" id="browse">' +
        '<div class="shelf-block">' +
          '<p class="block-kicker">按时间</p>' +
          time +
        "</div>" +
        '<div class="shelf-block">' +
          '<p class="block-kicker">按栏目</p>' +
          showRows +
        "</div>" +
      "</div>"
    );
  }

  function gridHtml(list) {
    return (
      '<div class="browse" id="browse">' +
        resultsHead(list.length, items().length) +
        '<div class="tile-grid" id="results">' + list.map(tileHtml).join("") + "</div>" +
      "</div>"
    );
  }

  function browseHtml(list, kind) {
    if (kind) return '<div class="browse" id="browse">' + emptyHtml(kind) + "</div>";
    if (wantsShelves()) return shelvesHtml();
    if (!list.length) return '<div class="browse" id="browse">' + emptyHtml() + "</div>";
    return gridHtml(list);
  }

  function emptyHtml(kind) {
    if (kind === "missing-show") {
      return '<div class="empty" role="status">没有这个栏目。<a href="#/">返回首页</a>，或清除筛选后再找。</div>';
    }
    if (kind === "missing-topic") {
      return '<div class="empty" role="status">没有这个主题。<a href="#/">返回首页</a>，或清除筛选后再找。</div>';
    }
    if (hasActiveFilters()) {
      return '<div class="empty" role="status">没有找到匹配的访谈。可以<a href="' + clearHref() + '">清除筛选</a>，回到当前范围的全部条目。</div>';
    }
    return '<div class="empty" role="status">还没有条目。</div>';
  }

  function facetBtn(kind, value, label, count, active) {
    var extra = count != null ? '<span class="n">' + count + "</span>" : "";
    return '<button type="button" class="facet' + (active ? " active" : "") +
      '" data-facet="' + W.escapeHtml(kind) + '" data-value="' + W.escapeHtml(value) + '"' +
      (active ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" +
      W.escapeHtml(label) + extra + "</button>";
  }

  function deskHtml(opts) {
    opts = opts || {};
    var shows = collectShows();
    var topics = collectTopics();
    var forms = formSet();
    var showBtns = shows.map(function (s) {
      return facetBtn("show", s.slug, s.name, s.count, state.show === s.slug);
    }).join("");
    var topicBtns = topics.map(function (t) {
      return facetBtn("topic", t.slug, t.name, t.count, state.topic === t.slug);
    }).join("");
    var formBtns = FORM_KEYS.map(function (f) {
      return facetBtn("form", f.id, f.label, null, !!forms[f.id]);
    }).join("");
    var heading = opts.heading || SITE_TITLE;
    var blurb = opts.blurb || SITE_LEDE;
    var lockNote = "";
    if (opts.lock === "show") {
      lockNote = '<p class="lock-note">正在看栏目页。点其他栏目会换页；<a href="' +
        W.hashFor({ name: "list", q: state.query, topic: state.topic, form: state.form, period: state.period, sort: state.sort }) +
        '">回到全部</a>可同时筛多个栏目。</p>';
    } else if (opts.lock === "topic") {
      lockNote = '<p class="lock-note">正在看主题页。点其他主题会换页；<a href="' +
        W.hashFor({ name: "list", q: state.query, show: state.show, form: state.form, period: state.period, sort: state.sort }) +
        '">回到全部</a>可同时筛多个主题。</p>';
    }
    return (
      '<section class="desk" aria-label="查找">' +
        '<div class="desk-copy">' +
          '<h1>' + W.escapeHtml(heading) + "</h1>" +
          '<p class="lede">' + W.escapeHtml(blurb) + "</p>" +
          lockNote +
        "</div>" +
        '<div class="search">' +
          '<label class="sr" for="q">搜索标题、嘉宾、节目或摘要</label>' +
          '<input id="q" type="search" placeholder="搜索标题、嘉宾、节目或摘要" autocomplete="off" value="' +
            W.escapeHtml(state.query) + '" />' +
        "</div>" +
        '<div class="facets">' +
          '<div class="facet-row">' +
            '<span class="facet-label" id="lbl-show">栏目</span>' +
            '<div class="facet-set names" role="group" aria-labelledby="lbl-show">' + showBtns + "</div>" +
          "</div>" +
          '<div class="facet-row">' +
            '<span class="facet-label" id="lbl-topic">主题</span>' +
            '<div class="facet-set" role="group" aria-labelledby="lbl-topic">' + topicBtns + "</div>" +
          "</div>" +
          '<div class="facet-row">' +
            '<span class="facet-label" id="lbl-form">形态</span>' +
            '<div class="facet-set" role="group" aria-labelledby="lbl-form">' + formBtns + "</div>" +
          "</div>" +
          '<div class="facet-row">' +
            '<span class="facet-label" id="lbl-period">时间</span>' +
            '<div class="facet-set" role="group" aria-labelledby="lbl-period">' +
              collectPeriods().map(function (p) {
                return facetBtn("period", p.id, p.name, p.count, state.period === p.id);
              }).join("") +
            "</div>" +
          "</div>" +
          '<div class="facet-row">' +
            '<span class="facet-label" id="lbl-sort">排序</span>' +
            '<div class="facet-set" role="group" aria-labelledby="lbl-sort">' +
              facetBtn("sort", "newest", "最近优先", null, state.sort !== "oldest") +
              facetBtn("sort", "oldest", "较早在前", null, state.sort === "oldest") +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function resultsTitle() {
    if (state.period && !state.query.trim() && !state.form.length) {
      var extraShow = state.route.name === "show" ? false : !!state.show;
      var extraTopic = state.route.name === "topic" ? false : !!state.topic;
      if (!extraShow && !extraTopic) return periodLabel(state.period);
    }
    if (state.query.trim()) return "搜索结果";
    if (hasHeavyFilters()) return "筛选结果";
    if (state.route.name === "show" || state.route.name === "topic") return "";
    return "全部访谈";
  }

  function resultsHead(filtered, total) {
    var clear = hasActiveFilters()
      ? '<a class="clear" href="' + clearHref() + '">清除筛选</a>'
      : "";
    var title = resultsTitle();
    return (
      '<div class="results-head">' +
        '<div class="results-copy">' +
          (title ? '<h2 class="results-title">' + W.escapeHtml(title) + "</h2>" : "") +
          '<p class="count">显示 <strong>' + filtered + "</strong> / " + total + " 则</p>" +
        "</div>" +
        clear +
      "</div>"
    );
  }

  function restoreSearchCaret() {
    var q = document.getElementById("q");
    if (q && state.query && document.activeElement === q) {
      try { q.setSelectionRange(state.query.length, state.query.length); } catch (e) { /* ignore */ }
    }
  }

  function patchResults() {
    var browse = document.getElementById("browse");
    if (!browse) {
      renderCatalog();
      return;
    }
    browse.outerHTML = browseHtml(filteredItems());
  }

  function renderCatalog() {
    var view = document.getElementById("view");
    view.className = "view catalog";
    setBodyMode("catalog");
    var list = filteredItems();
    var shows = collectShows();
    var topics = collectTopics();
    var opts = {};
    var missing = "";
    if (state.route.name === "show") {
      var showMeta = shows.filter(function (s) { return s.slug === state.show; })[0];
      opts.heading = showMeta ? showMeta.name : state.show;
      opts.blurb = showMeta
        ? "这一栏目下的访谈。可以再叠主题、形态或搜索。"
        : "没有匹配到这个栏目名。";
      opts.lock = "show";
      if (!showMeta) missing = "missing-show";
    } else if (state.route.name === "topic") {
      var topicMeta = topics.filter(function (t) { return t.slug === state.topic; })[0];
      opts.heading = topicMeta ? topicMeta.name : W.topicDisplay(state.topic);
      opts.blurb = topicMeta
        ? "这一主题下的访谈。可以再叠栏目、形态或搜索。"
        : "没有匹配到这个主题。";
      opts.lock = "topic";
      if (!topicMeta) missing = "missing-topic";
    }
    var pageTitle = SITE_TITLE;
    if (state.route.name === "show") pageTitle = (opts.heading || "栏目") + " · " + SITE_TITLE;
    if (state.route.name === "topic") pageTitle = (opts.heading || "主题") + " · " + SITE_TITLE;
    document.title = pageTitle;

    view.innerHTML = deskHtml(opts) + browseHtml(missing ? [] : list, missing);

    restoreSearchCaret();
  }

  function tocHtml(headings, cls, epId) {
    if (!headings || !headings.length) return "";
    var itemsHtml = headings.map(function (h) {
      return '<li data-level="' + h.level + '"><a href="' + W.escapeHtml(W.tocHref(epId, h.id)) +
        '" data-toc-target="' + W.escapeHtml(h.id) + '">' + W.escapeHtml(h.text) + "</a></li>";
    }).join("");
    return '<nav class="toc ' + (cls || "") + '" aria-label="目录"><h2>目录</h2><ol>' + itemsHtml + "</ol></nav>";
  }

  function scrollToHeading(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function paneTabBtn(id, label) {
    return '<button type="button" class="pane-tab' + (state.tab === id ? " active" : "") +
      '" data-tab="' + id + '">' + label + "</button>";
  }

  function normalizeTab(it) {
    var avail = W.availableTabs(it);
    if (avail.indexOf(state.tab) === -1) state.tab = W.defaultTab(it);
  }

  function paneWordLabel(it) {
    if (state.tab === "essay" && it.essay && it.essay.wordCount) {
      return "精读约 " + it.essay.wordCount + " 字";
    }
    if (state.tab === "analysis" && it.analysis && it.analysis.wordCount) {
      return "解读约 " + it.analysis.wordCount + " 字";
    }
    if (W.hasEssay(it) && it.essay.wordCount) return "精读约 " + it.essay.wordCount + " 字";
    if (W.hasAnalysis(it) && it.analysis.wordCount) return "解读约 " + it.analysis.wordCount + " 字";
    return "";
  }

  function currentTabMarkdown(it) {
    if (state.tab === "essay" && W.hasEssay(it)) return it.essay.zh;
    if (state.tab === "analysis" && W.hasAnalysis(it)) return it.analysis.zh;
    if (state.tab === "transcript" && W.hasTranscript(it)) return W.transcriptMarkdown(it);
    return "";
  }

  function episodePanes(it) {
    var essayOn = W.hasEssay(it);
    var analysisOn = W.hasAnalysis(it);
    var transOn = W.hasTranscript(it);
    var media = W.detectMedia(it);
    var hasMedia = !!(media.primary || W.hasAudio(it));
    var essayRendered = essayOn ? W.renderEssay(it.essay.zh) : { html: "", headings: [] };
    var analysisRendered = analysisOn ? W.renderEssay(it.analysis.zh) : { html: "", headings: [] };
    var transHtml = transOn ? W.renderTranscript(it) : "";
    var essayHtml = essayOn
      ? W.weaveEvidence(essayRendered.html, essayRendered.headings, it.evidence)
      : "";
    var analysisHtml = analysisOn
      ? W.weaveEvidence(analysisRendered.html, analysisRendered.headings, it.evidence)
      : "";
    var activeHeadings = [];
    if (state.tab === "essay") activeHeadings = essayRendered.headings;
    else if (state.tab === "analysis") activeHeadings = analysisRendered.headings;
    var showToc = (state.tab === "essay" || state.tab === "analysis") && activeHeadings.length > 0;
    var canCopy = !!currentTabMarkdown(it);
    var showTabs = essayOn || analysisOn || transOn;
    var tabs = "";
    if (showTabs) {
      tabs =
        '<div class="tab-row' + (hasMedia ? "" : " no-media") + '" id="tab-row">' +
          (essayOn ? paneTabBtn("essay", "中文精读") : "") +
          (analysisOn ? paneTabBtn("analysis", "详细解读") : "") +
          (transOn ? paneTabBtn("transcript", "完整文稿") : "") +
          '<div class="tools">' +
            (showToc ? '<button type="button" class="toc-toggle" data-toc-toggle>目录</button>' : "") +
            (canCopy ? '<button type="button" data-copy-md>复制正文</button>' : "") +
          "</div></div>";
    }
    var body = "";
    if (state.tab === "essay" && essayOn) {
      var disc = W.textOf(it.essay.disclaimer) || DEFAULT_DISCLAIMER;
      body =
        (disc ? '<div class="disclaimer">' + W.escapeHtml(disc) + "</div>" : "") +
        (it.advice ? '<p class="advice">' + W.escapeHtml(it.advice) + "</p>" : "") +
        essayHtml;
    } else if (state.tab === "analysis" && analysisOn) {
      var adisc = W.textOf(it.analysis.disclaimer) || DEFAULT_ANALYSIS_DISCLAIMER;
      body =
        (adisc ? '<div class="disclaimer">' + W.escapeHtml(adisc) + "</div>" : "") +
        analysisHtml;
    } else if (state.tab === "transcript" && transOn) {
      var tdisc = W.textOf(it.transcript.disclaimer) || DEFAULT_TRANSCRIPT_DISCLAIMER;
      var src = it.transcript.source && it.transcript.source !== "none"
        ? "文稿来源：" + it.transcript.source
        : "";
      body =
        '<div class="disclaimer">' + W.escapeHtml(tdisc) +
          (src ? "<br />" + W.escapeHtml(src) : "") +
        "</div>" +
        '<div class="transcript">' + transHtml + "</div>";
    } else {
      body = it.advice ? '<p class="advice">' + W.escapeHtml(it.advice) + "</p>" : "";
    }
    var serif = state.tab === "essay" || state.tab === "analysis";
    var layout =
      '<div class="ep-layout" id="ep-layout">' +
        '<div class="reading' + (serif ? " serif" : "") + '" id="reading">' +
          (showToc ? '<div class="toc-panel' + (state.tocOpen ? " open" : "") + '" id="toc-panel">' +
            tocHtml(activeHeadings, "", it.id) + "</div>" : "") +
          body +
        "</div>" +
        (showToc ? tocHtml(activeHeadings, "desktop", it.id) : "") +
      "</div>";
    return { tabs: tabs, layout: layout, word: paneWordLabel(it) };
  }

  function updateEpisodeBody() {
    var it = findItem(state.route.id);
    if (!it) return;
    normalizeTab(it);
    var panes = episodePanes(it);
    var tabRow = document.getElementById("tab-row");
    var layout = document.getElementById("ep-layout");
    if (tabRow && panes.tabs) tabRow.outerHTML = panes.tabs;
    if (layout) layout.outerHTML = panes.layout;
  }

  function renderEpisode(it) {
    var view = document.getElementById("view");
    view.className = "view episode" + ((it && (W.detectMedia(it).primary || W.hasAudio(it))) ? "" : " no-media");
    setBodyMode("paper");
    if (!it) {
      view.innerHTML = '<div class="empty">找不到这一集。<a href="#/">返回首页</a></div>';
      document.title = SITE_TITLE;
      return;
    }

    var media = W.detectMedia(it);
    var essayOn = W.hasEssay(it);
    var analysisOn = W.hasAnalysis(it);
    var transOn = W.hasTranscript(it);
    var audioOn = W.hasAudio(it);
    var cover = coverSrc(it);
    var hasEmbed = !!media.primary;
    normalizeTab(it);
    var panes = episodePanes(it);
    var word = panes.word;
    var showHref = W.hashFor({ name: "show", slug: W.showSlug(it.show) });
    var topicHref = W.hashFor({ name: "topic", slug: W.topicSlug(it.category) });

    var poster = "";
    if (hasEmbed) {
      poster =
        '<button type="button" class="watch-poster' + (state.videoOpen ? " open" : "") +
          '" id="btn-video" aria-expanded="' + (state.videoOpen ? "true" : "false") +
          '" aria-label="打开视频">' +
          (cover ? '<img src="' + cover + '" alt="" />' : "") +
          '<span class="poster-ui"><span class="play" aria-hidden="true">▶</span>' +
          '<span class="lbl">打开视频</span></span></button>';
    }

    var audio = "";
    if (audioOn) {
      var saved = state.audioPos[it.id] || {};
      var rate = saved.rate || 1;
      audio =
        '<div class="audio" id="audio-player" data-id="' + W.escapeHtml(it.id) + '">' +
          '<audio preload="metadata" src="' + W.escapeHtml(W.audioUrlOf(it)) + '"></audio>' +
          '<button type="button" class="audio-play" data-audio="toggle" aria-label="播放">▶</button>' +
          '<div class="audio-meta">' +
            '<div class="audio-label">音频' +
              (it.media && it.media.audioSource && it.media.audioSource !== "none"
                ? " " + W.escapeHtml(it.media.audioSource)
                : "") +
            "</div>" +
            '<div class="audio-times">' +
              '<span data-audio="cur">0:00</span>' +
              '<input type="range" min="0" max="1000" value="0" data-audio="seek" aria-label="播放进度" />' +
              '<span data-audio="dur">--:--</span>' +
            "</div>" +
          "</div>" +
          '<div class="audio-btns">' +
            '<button type="button" data-audio="skip" data-delta="-15">−15s</button>' +
            '<button type="button" data-audio="skip" data-delta="15">+15s</button>' +
            '<button type="button" data-audio="speed">' + rate + "×</button>" +
          "</div>" +
          '<span class="audio-hint" data-audio="hint" hidden>已从上次位置继续</span>' +
        "</div>";
    }

    var ext = "";
    if (!hasEmbed && media.classified.length) {
      ext = '<div class="ext-links">' + media.classified.map(function (u) {
        return '<a class="btn primary" href="' + W.escapeHtml(u.href) +
          '" target="_blank" rel="noopener noreferrer">打开 ' +
          W.escapeHtml(u.label) + "</a>";
      }).join("") + "</div>";
    } else if (media.classified.length) {
      ext = '<div class="ext-links">' + media.classified.map(function (u) {
        return '<a class="btn" href="' + W.escapeHtml(u.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          W.escapeHtml(u.label) + "</a>";
      }).join("") + "</div>";
    }

    var mediaRow = "";
    if (hasEmbed || audioOn) {
      var side = audioOn ? audio : (ext || "");
      mediaRow = '<div class="media-row" id="media-row">' + poster + side + "</div>";
    }

    var video = "";
    if (hasEmbed && state.videoOpen) {
      video = '<div class="video-frame" id="video-frame"><iframe src="' + W.escapeHtml(media.primary.embed) +
        '" title="' + W.escapeHtml(it.title) +
        '" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
    }

    var more = media.classified.length
      ? '<section class="resources"><h2>本集资源</h2><ul>' +
        media.classified.map(function (u) {
          return "<li><span class='k'>" + W.escapeHtml(u.kind === "youtube" ? "视频" : u.kind === "bilibili" ? "B站" : "外链") +
            "</span><a href='" + W.escapeHtml(u.href) + "' target='_blank' rel='noopener noreferrer'>" +
            W.escapeHtml(u.label) + "</a></li>";
        }).join("") +
        "</ul></section>"
      : "";

    var nav = neighbors(it.id);
    var navHtml =
      '<nav class="ep-nav" aria-label="相邻访谈">' +
        (nav.prev
          ? '<a href="' + W.hashFor({ name: "ep", id: nav.prev.id }) + '"><span class="dir">上一则</span>' +
            W.escapeHtml(nav.prev.title) + "</a>"
          : "<span></span>") +
        (nav.next
          ? '<a class="next" href="' + W.hashFor({ name: "ep", id: nav.next.id }) + '"><span class="dir">下一则</span>' +
            W.escapeHtml(nav.next.title) + "</a>"
          : "<span></span>") +
      "</nav>";

    var crumbs = [
      '<a href="' + showHref + '">' + W.escapeHtml(W.showDisplay(it.show)) + "</a>",
      '<a href="' + topicHref + '">' + W.escapeHtml(it.category || "") + "</a>",
      "<span>" + W.escapeHtml(it.date || "") + "</span>",
      "<span>" + W.escapeHtml(it.duration || "—") + "</span>"
    ];
    if (word) crumbs.push("<span>" + W.escapeHtml(word) + "</span>");
    if (essayOn) crumbs.push("<span>精读</span>");
    if (analysisOn) crumbs.push("<span>解读</span>");
    if (transOn) crumbs.push("<span>文稿</span>");

    view.innerHTML =
      '<article class="ep">' +
        '<header class="ep-head">' +
          '<p class="ep-kicker">' + crumbs.join("") + "</p>" +
          "<h1>" + W.escapeHtml(it.title) + "</h1>" +
          '<p class="ep-guest">' + W.escapeHtml(it.guest) + "</p>" +
          (it.summary ? '<p class="ep-summary">' + W.escapeHtml(it.summary) + "</p>" : "") +
        "</header>" +
        mediaRow +
        video +
        panes.tabs +
        panes.layout +
        more +
        (hasEmbed ? "" : (ext && !mediaRow ? '<div class="ext-wrap">' + ext + "</div>" : "")) +
        navHtml +
      "</article>";

    document.title = it.title + " · " + SITE_TITLE;
    bindAudio(it);
  }

  function toggleVideo() {
    var it = findItem(state.route.id);
    if (!it) return;
    var media = W.detectMedia(it);
    if (!media.primary) return;
    state.videoOpen = !state.videoOpen;
    var poster = document.getElementById("btn-video");
    if (poster) {
      poster.classList.toggle("open", state.videoOpen);
      poster.setAttribute("aria-expanded", state.videoOpen ? "true" : "false");
    }
    var existing = document.getElementById("video-frame");
    if (!state.videoOpen) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var frame = document.createElement("div");
    frame.className = "video-frame";
    frame.id = "video-frame";
    frame.innerHTML = '<iframe src="' + W.escapeHtml(media.primary.embed) +
      '" title="' + W.escapeHtml(it.title) +
      '" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    var row = document.getElementById("media-row");
    if (row && row.parentNode) row.insertAdjacentElement("afterend", frame);
  }

  function bindAudio(it) {
    var root = document.getElementById("audio-player");
    audioUi.root = root;
    if (!root) return;
    var audio = root.querySelector("audio");
    var playBtn = root.querySelector('[data-audio="toggle"]');
    var curEl = root.querySelector('[data-audio="cur"]');
    var durEl = root.querySelector('[data-audio="dur"]');
    var seek = root.querySelector('[data-audio="seek"]');
    var hint = root.querySelector('[data-audio="hint"]');
    var speedBtn = root.querySelector('[data-audio="speed"]');
    var saved = state.audioPos[it.id] || {};
    var resumed = false;
    var lastSave = 0;

    if (saved.rate) {
      audio.playbackRate = saved.rate;
      if (speedBtn) speedBtn.textContent = saved.rate + "×";
    }

    function persist(force) {
      var now = Date.now();
      if (!force && now - lastSave < 1200) return;
      lastSave = now;
      state.audioPos[it.id] = {
        t: audio.currentTime || 0,
        rate: audio.playbackRate || 1
      };
      saveAudioPos();
    }

    function sync() {
      curEl.textContent = fmtTime(audio.currentTime || 0);
      if (isFinite(audio.duration)) {
        durEl.textContent = fmtTime(audio.duration);
        if (!seek._dragging) {
          seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
        }
      }
    }

    audio.addEventListener("loadedmetadata", function () {
      if (!resumed && saved.t && saved.t > 3 && saved.t < (audio.duration || 0) - 5) {
        audio.currentTime = saved.t;
        resumed = true;
        if (hint) {
          hint.hidden = false;
          clearTimeout(audioUi.hintTimer);
          audioUi.hintTimer = setTimeout(function () { hint.hidden = true; }, 3200);
        }
      }
      sync();
    });
    audio.addEventListener("timeupdate", function () { sync(); persist(false); });
    audio.addEventListener("pause", function () { persist(true); playBtn.textContent = "▶"; playBtn.setAttribute("aria-label", "播放"); });
    audio.addEventListener("play", function () { playBtn.textContent = "❚❚"; playBtn.setAttribute("aria-label", "暂停"); });
    audio.addEventListener("ended", function () {
      state.audioPos[it.id] = { t: 0, rate: audio.playbackRate || 1 };
      saveAudioPos();
    });

    playBtn.addEventListener("click", function () {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    root.querySelectorAll('[data-audio="skip"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        audio.currentTime = Math.max(0, (audio.currentTime || 0) + Number(btn.getAttribute("data-delta")));
        persist(true);
        sync();
      });
    });
    if (speedBtn) {
      speedBtn.addEventListener("click", function () {
        var cur = audio.playbackRate || 1;
        var idx = SPEEDS.indexOf(cur);
        var next = SPEEDS[(idx + 1) % SPEEDS.length];
        audio.playbackRate = next;
        speedBtn.textContent = next + "×";
        persist(true);
      });
    }
    seek.addEventListener("input", function () {
      seek._dragging = true;
      if (isFinite(audio.duration)) {
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
        sync();
      }
    });
    seek.addEventListener("change", function () {
      seek._dragging = false;
      persist(true);
    });
    window.addEventListener("pagehide", function () { persist(true); }, { once: true });
  }

  function render() {
    renderTopbar();
    renderFooter();
    if (!state.data) {
      setBodyMode("catalog");
      document.getElementById("view").innerHTML = '<div class="empty">正在读取列表…</div>';
      return;
    }
    if (state.route.name === "ep") {
      var it = findItem(state.route.id);
      var status = state.detailStatus[state.route.id];
      if (isDetailReady(it)) {
        renderEpisode(it);
        if (state.route.heading) {
          requestAnimationFrame(function () { scrollToHeading(state.route.heading); });
        }
        return;
      }
      if (status === "error") {
        renderEpisode(null);
        return;
      }
      setBodyMode("paper");
      document.getElementById("view").innerHTML = '<div class="empty">正在读取这一集…</div>';
      document.title = (it && it.title ? it.title + " · " : "") + SITE_TITLE;
      return;
    }
    renderCatalog();
  }

  function syncRoute() {
    var next = W.parseRoute(location.hash);
    var changed = next.name !== state.route.name || next.id !== state.route.id || next.slug !== state.route.slug;
    var gen = ++routeGen;
    var searchFocused = document.activeElement && document.activeElement.id === "q";
    applyRoute(next);
    if (changed) {
      state.videoOpen = false;
      state.tocOpen = false;
      state.tab = "essay";
      window.scrollTo(0, 0);
    }
    if (next.name === "ep" && next.id) {
      var cached = findItem(next.id);
      if (isDetailReady(cached)) {
        state.detailStatus[next.id] = "ready";
        if (changed) state.tab = W.defaultTab(cached);
        render();
        return;
      }
      state.detailStatus[next.id] = "loading";
      render();
      ensureEpisode(next.id).then(function (it) {
        if (gen !== routeGen) return;
        state.detailStatus[next.id] = "ready";
        if (changed || !it || W.availableTabs(it).indexOf(state.tab) === -1) {
          state.tab = W.defaultTab(it);
        }
        render();
      }).catch(function () {
        if (gen !== routeGen) return;
        state.detailStatus[next.id] = "error";
        render();
      });
      return;
    }
    if (!changed && searchFocused && next.name !== "ep") {
      renderTopbar();
      renderFooter();
      patchResults();
      return;
    }
    render();
  }

  function applyFacet(kind, value) {
    if (kind === "show") {
      if (state.route.name === "show") {
        location.hash = W.hashFor({
          name: "show",
          slug: value,
          q: state.query,
          topic: state.topic,
          form: state.form,
          period: state.period,
          sort: state.sort
        });
        return;
      }
      state.show = state.show === value ? "" : value;
      writeHash();
      return;
    }
    if (kind === "topic") {
      if (state.route.name === "topic") {
        location.hash = W.hashFor({
          name: "topic",
          slug: value,
          q: state.query,
          show: state.show,
          form: state.form,
          period: state.period,
          sort: state.sort
        });
        return;
      }
      state.topic = state.topic === value ? "" : value;
      writeHash();
      return;
    }
    if (kind === "form") {
      var set = formSet();
      if (set[value]) delete set[value];
      else set[value] = true;
      state.form = FORM_KEYS.map(function (f) { return f.id; }).filter(function (id) { return set[id]; });
      writeHash();
      return;
    }
    if (kind === "period") {
      state.period = state.period === value ? "" : (W.periodOf(value) || "");
      writeHash();
      return;
    }
    if (kind === "sort") {
      state.sort = value === "oldest" ? "oldest" : "newest";
      writeHash();
    }
  }

  function bindGlobal() {
    document.body.addEventListener("error", function (e) {
      var img = e.target;
      if (img && img.tagName === "IMG" && img.closest && img.closest("figure.evidence")) {
        img.closest("figure.evidence").classList.add("broken");
      }
    }, true);

    document.body.addEventListener("click", function (e) {
      var focusSearch = e.target.closest("[data-focus-search]");
      if (focusSearch) {
        e.preventDefault();
        var box = document.getElementById("q");
        if (box) box.focus();
        return;
      }
      var facet = e.target.closest("[data-facet]");
      if (facet) {
        applyFacet(facet.getAttribute("data-facet"), facet.getAttribute("data-value"));
        return;
      }
      if (e.target.closest("#btn-video")) {
        toggleVideo();
        return;
      }
      var tab = e.target.closest("[data-tab]");
      if (tab) {
        state.tab = tab.getAttribute("data-tab");
        state.tocOpen = false;
        updateEpisodeBody();
        return;
      }
      var tocLink = e.target.closest("[data-toc-target]");
      if (tocLink) {
        e.preventDefault();
        e.stopPropagation();
        scrollToHeading(tocLink.getAttribute("data-toc-target"));
        return;
      }
      if (e.target.closest("[data-toc-toggle]")) {
        state.tocOpen = !state.tocOpen;
        var panel = document.getElementById("toc-panel");
        if (panel) panel.classList.toggle("open", state.tocOpen);
        return;
      }
      if (e.target.closest("[data-copy-md]")) {
        var it = findItem(state.route.id);
        if (!it) return;
        var md = currentTabMarkdown(it);
        if (!md) return;
        var btn = e.target.closest("[data-copy-md]");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(function () {
            btn.textContent = "已复制";
          }).catch(function () { /* ignore */ });
        }
      }
    });

    document.body.addEventListener("input", function (e) {
      if (e.target && e.target.id === "q") {
        state.query = e.target.value;
        if (state.route.name === "ep") return;
        patchResults();
        scheduleHash();
      }
    });

    window.addEventListener("hashchange", syncRoute);
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && state.route.name !== "ep" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        var q = document.getElementById("q");
        if (q) q.focus();
      }
      if (e.key === "Escape" && state.route.name === "ep") {
        location.hash = "#/";
      }
    });
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
    return res.json();
  }

  function replaceItem(next) {
    if (!state.data) state.data = { items: [] };
    if (!Array.isArray(state.data.items)) state.data.items = [];
    var i;
    for (i = 0; i < state.data.items.length; i++) {
      if (state.data.items[i].id === next.id) {
        state.data.items[i] = next;
        return next;
      }
    }
    state.data.items.push(next);
    return next;
  }

  async function ensureEpisode(id) {
    var existing = findItem(id);
    if (isDetailReady(existing)) return existing;
    if (state.detailInflight[id]) return state.detailInflight[id];
    state.detailInflight[id] = fetchJson(episodeDataUrl(id)).then(function (detail) {
      if (!detail || typeof detail !== "object") throw new Error("bad episode");
      delete detail.coverDataUri;
      var merged = existing ? Object.assign({}, existing, detail) : detail;
      merged._detailLoaded = true;
      return replaceItem(merged);
    });
    try {
      return await state.detailInflight[id];
    } finally {
      delete state.detailInflight[id];
    }
  }

  async function loadData() {
    var data = null;
    try {
      data = await fetchJson("./data/index.json");
    } catch (e) { /* file:// or missing split tree */ }
    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      state.data = { version: 1, title: "", lastUpdated: "", items: [], categories: [] };
      document.getElementById("view").innerHTML =
        '<div class="empty">数据未加载：请用 <code>data/index.json</code> 与 <code>data/episodes/</code>，并用本地静态服务器打开。</div>';
      return;
    }
    state.data = data;
  }

  async function boot() {
    loadAudioPos();
    bindGlobal();
    await loadData();
    syncRoute();
  }

  window.__wl = {
    patchItem: function (id, patch) {
      var it = findItem(id);
      if (!it) return false;
      Object.keys(patch || {}).forEach(function (k) { it[k] = patch[k]; });
      render();
      return true;
    }
  };

  boot();
})();
