(function () {
  "use strict";

  var LS_KEY = "ai-interviews-watched-v1";
  var LS_AUDIO = "ai-interviews-audio-pos-v1";
  var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  var DEFAULT_DISCLAIMER = "中文精读由 AI 基于原始访谈改写，非官方翻译，可能存在偏差或错误；表述以原音视频为准。";
  var DEFAULT_ANALYSIS_DISCLAIMER = "AI 详细解读，非官方；请以原音视频为准";
  var DEFAULT_TRANSCRIPT_DISCLAIMER = "完整文稿可能含 ASR/整理误差；说话人标注以可辨认发言为准";

  var W = window.WL;
  if (!W) {
    document.getElementById("view").innerHTML = '<div class="empty">未能加载 media.js</div>';
    return;
  }

  var state = {
    data: null,
    watched: {},
    audioPos: {},
    category: "全部",
    priority: "all",
    onlyUnwatched: false,
    query: "",
    route: { name: "list" },
    tab: "essay",
    videoOpen: false,
    tocOpen: false,
    detailStatus: {},
    detailInflight: {}
  };
  var routeGen = 0;

  var audioUi = { root: null, hintTimer: 0 };

  function todayISO() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function loadWatched() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      state.watched = raw ? JSON.parse(raw) : {};
    } catch (e) {
      state.watched = {};
    }
  }

  function saveWatched() {
    localStorage.setItem(LS_KEY, JSON.stringify(state.watched));
    if (state.data && state.data.items) {
      state.data.items.forEach(function (it) {
        it.watched = !!state.watched[it.id];
      });
    }
  }

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

  function isWatched(id) {
    return !!state.watched[id];
  }

  function setWatched(id, val) {
    if (val) state.watched[id] = true;
    else delete state.watched[id];
    saveWatched();
    render();
  }

  function coverSrc(it) {
    if (it && it.cover) return it.cover;
    return "";
  }

  function episodeDataUrl(id) {
    return "./data/episodes/" + encodeURIComponent(id) + ".json";
  }

  function applyWatched(it) {
    if (!it || !it.id) return;
    if (state.watched[it.id]) it.watched = true;
    else if (it.watched) state.watched[it.id] = true;
    else it.watched = false;
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

  function matches(it) {
    if (state.category !== "全部" && it.category !== state.category) return false;
    if (state.priority !== "all" && it.priority !== state.priority) return false;
    if (state.onlyUnwatched && isWatched(it.id)) return false;
    var q = state.query.trim().toLowerCase();
    if (q) {
      var blob = [it.title, it.guest, it.show, it.summary, it.advice, it.category]
        .join(" ").toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }

  function sortItems(list) {
    var pri = { P0: 0, P1: 1, P2: 2 };
    return list.slice().sort(function (a, b) {
      var pa = pri[a.priority] != null ? pri[a.priority] : 9;
      var pb = pri[b.priority] != null ? pri[b.priority] : 9;
      if (pa !== pb) return pa - pb;
      return (b.date || "").localeCompare(a.date || "");
    });
  }

  function todayPicks() {
    return sortItems(items()).filter(function (it) {
      return it.priority === "P0" && !isWatched(it.id);
    }).slice(0, 2);
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

  function renderTopbar() {
    var el = document.getElementById("topbar");
    var updated = (state.data && state.data.lastUpdated) || "—";
    if (state.route.name === "ep") {
      var it = findItem(state.route.id);
      var watched = it ? isWatched(it.id) : false;
      el.innerHTML =
        '<div class="topbar-inner">' +
          '<a class="back" href="#/">← 全部访谈</a>' +
          '<div class="brand-block">' +
            '<a class="brand-link" href="#/">AI / 科技访谈</a>' +
          "</div>" +
          (it
            ? '<div class="topbar-right"><label class="watch-toggle">' +
              '<input type="checkbox" data-check="' + W.escapeHtml(it.id) + '"' +
              (watched ? " checked" : "") + " /> 已看</label></div>"
            : "") +
        "</div>";
      return;
    }
    var all = items();
    var watchedN = all.filter(function (x) { return isWatched(x.id); }).length;
    var addedToday = all.filter(function (x) { return x.addedAt === todayISO(); }).length;
    el.innerHTML =
      '<div class="topbar-inner">' +
        '<div class="brand-block">' +
          '<p class="kicker">Midnight · 多源队列</p>' +
          '<div class="brand-title">AI / 科技访谈</div>' +
          '<div class="sub">上次更新 · <span id="last-updated">' + W.escapeHtml(updated) + "</span> · America/Chicago</div>" +
        "</div>" +
        '<div class="topbar-right stats" id="stats">' +
          '<div class="stat">待看 <strong>' + (all.length - watchedN) + "</strong></div>" +
          '<div class="stat">已看 <strong>' + watchedN + "</strong></div>" +
          '<div class="stat today">今日新增 <strong>' + addedToday + "</strong></div>" +
        "</div>" +
      "</div>";
  }

  function renderFooter() {
    var el = document.getElementById("footer");
    el.innerHTML =
      "<div>多源观看列表（a16z / Latent Space / All-In / 硅谷101 / B站访谈等），不是单一栏目档案。</div>" +
      "<div>打勾仅保存在本浏览器（<code>" + LS_KEY + "</code>）。中文精读如存在，为 AI 改写，请以原音视频为准。</div>" +
      "<div>列表读 <code>data/index.json</code>，单集读 <code>data/episodes/&lt;id&gt;.json</code>；封面在 <code>thumbs/</code>。路由为 hash：<code>#/</code> 列表，<code>#/ep/&lt;id&gt;</code> 单集。</div>" +
      '<div class="actions">' +
        '<button type="button" id="btn-export">导出进度 JSON</button>' +
        '<button type="button" id="btn-reset">清除本机打勾</button>' +
      "</div>";
  }

  function cardHtml(it) {
    var watched = isWatched(it.id);
    var src = coverSrc(it);
    var href = W.hashFor({ name: "ep", id: it.id });
    var cover = src
      ? '<a class="cover" href="' + href + '" tabindex="-1"><img src="' + src + '" alt="" loading="lazy" width="148" height="83" /></a>'
      : '<a class="cover cover-empty" href="' + href + '" aria-hidden="true"></a>';
    var essay = W.hasEssay(it) ? '<span class="badge essay">有精读</span>' : "";
    return (
      '<article class="card' + (watched ? " watched" : "") + '" data-id="' + W.escapeHtml(it.id) + '">' +
        '<div class="check"><input type="checkbox" ' + (watched ? "checked " : "") +
          'aria-label="标记已看：' + W.escapeHtml(it.title) + '" data-check="' + W.escapeHtml(it.id) + '" /></div>' +
        cover +
        '<div class="body">' +
          '<h3 class="title"><a href="' + href + '">' + W.escapeHtml(it.title) + "</a></h3>" +
          '<div class="meta-line">' +
            '<span class="guest">' + W.escapeHtml(it.guest) + "</span>" +
            '<span class="dot">·</span><span>' + W.escapeHtml(it.show) + "</span>" +
            '<span class="dot">·</span><span>' + W.escapeHtml(it.date) + "</span>" +
            '<span class="dot">·</span><span>' + W.escapeHtml(it.duration || "—") + "</span>" +
            '<span class="badge ' + W.escapeHtml(it.priority) + '">' + W.escapeHtml(it.priority) + "</span>" +
            '<span>' + W.escapeHtml(it.category) + "</span>" +
            essay +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderList() {
    var view = document.getElementById("view");
    view.className = "view";
    var cats = ["全部"].concat((state.data && state.data.categories) || []);
    var tabs = cats.map(function (c) {
      return '<button type="button" class="tab' + (c === state.category ? " active" : "") +
        '" data-cat="' + W.escapeHtml(c) + '" role="tab">' + W.escapeHtml(c) + "</button>";
    }).join("");
    var picks = todayPicks();
    var suggest = picks.length
      ? '<section class="today-rail" id="suggest-section" aria-label="今日建议">' +
          '<span class="today-badge">今日</span>' +
          '<div id="suggest" class="today-chips">' +
            picks.map(function (it) {
              return '<a class="today-chip" href="' + W.hashFor({ name: "ep", id: it.id }) + '" title="' +
                W.escapeHtml(it.title) + " · " + W.escapeHtml(it.guest) + '">' +
                '<span class="pri">P0</span>' +
                '<span class="t">' + W.escapeHtml(it.title) + "</span>" +
                '<span class="g">' + W.escapeHtml(it.guest) + "</span></a>";
            }).join("") +
          "</div>" +
          '<span class="hint">未看 P0 · 进入单集</span>' +
        "</section>"
      : '<section class="today-rail" hidden></section>';

    var filtered = sortItems(items().filter(matches));
    var cards = filtered.length
      ? filtered.map(cardHtml).join("")
      : '<div class="empty">没有匹配的访谈。试试清除筛选或搜索词。</div>';

    view.innerHTML =
      '<section class="toolbar" aria-label="筛选">' +
        '<div class="seg" id="cat-tabs" role="tablist">' + tabs + "</div>" +
        '<div class="row2">' +
          '<div class="pri-group">' +
            '<span class="label-mini">优先级</span>' +
            '<button type="button" class="chip' + (state.priority === "all" ? " active" : "") + '" data-p="all">全部</button>' +
            '<button type="button" class="chip' + (state.priority === "P0" ? " active" : "") + '" data-p="P0">P0</button>' +
            '<button type="button" class="chip' + (state.priority === "P1" ? " active" : "") + '" data-p="P1">P1</button>' +
            '<button type="button" class="chip' + (state.priority === "P2" ? " active" : "") + '" data-p="P2">P2</button>' +
          "</div>" +
          '<div class="search">' +
            '<span class="icon" aria-hidden="true">⌕</span>' +
            '<input id="q" type="search" placeholder="搜索嘉宾 / 主题 / 节目…" autocomplete="off" value="' +
              W.escapeHtml(state.query) + '" />' +
          "</div>" +
          '<div class="extra">' +
            '<button type="button" class="toggle' + (state.onlyUnwatched ? " active" : "") + '" id="only-unwatched">只看未看</button>' +
          "</div>" +
        "</div>" +
      "</section>" +
      suggest +
      '<div class="list-head"><h2>全部访谈</h2><div class="count">显示 ' +
        filtered.length + " / " + items().length + "</div></div>" +
      '<div class="cards" id="cards">' + cards + "</div>";

    var q = document.getElementById("q");
    if (q && state.query) {
      try { q.setSelectionRange(state.query.length, state.query.length); } catch (e) { /* ignore */ }
    }
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
    var canCopy = !!(currentTabMarkdown(it));
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
            (canCopy ? '<button type="button" data-copy-md>复制 Markdown</button>' : "") +
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
    if (tabRow && panes.tabs) {
      tabRow.outerHTML = panes.tabs;
    }
    if (layout) layout.outerHTML = panes.layout;
  }

  function renderEpisode(it) {
    var view = document.getElementById("view");
    view.className = "view episode" + ((W.detectMedia(it).primary || W.hasAudio(it)) ? "" : " no-media");
    if (!it) {
      view.innerHTML = '<div class="empty">找不到这一集。<a href="#/">返回列表</a></div>';
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

    var poster = "";
    if (hasEmbed) {
      poster =
        '<button type="button" class="watch-poster' + (state.videoOpen ? " open" : "") +
          '" id="btn-video" aria-expanded="' + (state.videoOpen ? "true" : "false") +
          '" aria-label="播放视频">' +
          (cover ? '<img src="' + cover + '" alt="" />' : "") +
          '<span class="poster-ui"><span class="play" aria-hidden="true">▶</span>' +
          '<span class="lbl">看视频</span></span></button>';
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
                ? " · " + W.escapeHtml(it.media.audioSource)
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
          '" target="_blank" rel="noopener noreferrer">外链打开 · ' +
          W.escapeHtml(u.label) + " ↗</a>";
      }).join("") + "</div>";
    } else if (media.classified.length) {
      ext = '<div class="ext-links">' + media.classified.map(function (u) {
        return '<a class="btn" href="' + W.escapeHtml(u.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          W.escapeHtml(u.label) + " ↗</a>";
      }).join("") + "</div>";
    }

    var mediaRow = "";
    if (hasEmbed || audioOn) {
      var side = audioOn ? audio : (ext || "");
      mediaRow =
        '<div class="media-row" id="media-row">' +
          poster + side +
        "</div>";
    }

    var video = "";
    if (hasEmbed && state.videoOpen) {
      var src = media.primary.embed;
      video = '<div class="video-frame" id="video-frame"><iframe src="' + W.escapeHtml(src) +
        '" title="' + W.escapeHtml(it.title) +
        '" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
    }

    var tabs = panes.tabs;
    var layout = panes.layout;

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
          ? '<a href="' + W.hashFor({ name: "ep", id: nav.prev.id }) + '"><span class="dir">← 上一则</span>' +
            W.escapeHtml(nav.prev.title) + "</a>"
          : "<span></span>") +
        (nav.next
          ? '<a href="' + W.hashFor({ name: "ep", id: nav.next.id }) + '" style="text-align:right"><span class="dir">下一则 →</span>' +
            W.escapeHtml(nav.next.title) + "</a>"
          : "<span></span>") +
      "</nav>";

    var facts = [
      '<span class="badge ' + W.escapeHtml(it.priority) + '">' + W.escapeHtml(it.priority) + "</span>",
      W.escapeHtml(it.show),
      W.escapeHtml(it.date),
      W.escapeHtml(it.duration || "—"),
      W.escapeHtml(it.category)
    ];
    if (word) facts.push(W.escapeHtml(word));
    if (essayOn) facts.push("中文精读");
    if (analysisOn) facts.push("详细解读");
    if (transOn) facts.push("完整文稿");

    view.innerHTML =
      '<article class="ep">' +
        '<header class="ep-head">' +
          '<div class="ep-kicker">' + facts.join('<span class="dot">·</span>') + "</div>" +
          "<h1>" + W.escapeHtml(it.title) + "</h1>" +
          '<p class="ep-guest">' + W.escapeHtml(it.guest) + "</p>" +
          (it.summary ? '<p class="ep-summary">' + W.escapeHtml(it.summary) + "</p>" : "") +
        "</header>" +
        mediaRow +
        video +
        tabs +
        layout +
        more +
        (hasEmbed ? "" : (ext && !mediaRow ? '<div style="margin-top:16px">' + ext + "</div>" : "")) +
        navHtml +
      "</article>";

    document.title = it.title + " · AI / 科技访谈";
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
      document.getElementById("view").innerHTML = '<div class="empty">正在读取这一集…</div>';
      document.title = (it && it.title ? it.title + " · " : "") + "AI / 科技访谈";
    } else {
      document.title = state.data.title || "AI / 科技访谈 · 观看列表";
      renderList();
    }
  }

  function syncRoute() {
    var next = W.parseRoute(location.hash);
    var changed = next.name !== state.route.name || next.id !== state.route.id;
    var gen = ++routeGen;
    state.route = next;
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
    render();
  }

  function bindGlobal() {
    document.body.addEventListener("error", function (e) {
      var img = e.target;
      if (img && img.tagName === "IMG" && img.closest && img.closest("figure.evidence")) {
        img.closest("figure.evidence").classList.add("broken");
      }
    }, true);

    document.body.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.matches("input[data-check]")) {
        setWatched(t.getAttribute("data-check"), t.checked);
      }
    });

    document.body.addEventListener("click", function (e) {
      var cat = e.target.closest("[data-cat]");
      if (cat) {
        state.category = cat.getAttribute("data-cat");
        render();
        return;
      }
      var pri = e.target.closest("[data-p]");
      if (pri) {
        state.priority = pri.getAttribute("data-p");
        render();
        return;
      }
      if (e.target.closest("#only-unwatched")) {
        state.onlyUnwatched = !state.onlyUnwatched;
        render();
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
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(function () {
            e.target.closest("[data-copy-md]").textContent = "已复制";
          }).catch(function () { /* ignore */ });
        }
        return;
      }
      if (e.target.closest("#btn-export")) {
        saveWatched();
        var payload = {
          exportedAt: new Date().toISOString(),
          lastUpdated: state.data && state.data.lastUpdated,
          items: items().map(function (it) {
            return { id: it.id, title: it.title, watched: isWatched(it.id), priority: it.priority, date: it.date };
          })
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "ai-interviews-progress.json";
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      if (e.target.closest("#btn-reset")) {
        if (!confirm("清除本浏览器中的所有打勾进度？")) return;
        state.watched = {};
        saveWatched();
        render();
      }
    });

    document.body.addEventListener("input", function (e) {
      if (e.target && e.target.id === "q") {
        state.query = e.target.value;
        var cards = document.getElementById("cards");
        if (!cards || state.route.name !== "list") return;
        var filtered = sortItems(items().filter(matches));
        var count = document.querySelector(".list-head .count");
        if (count) count.textContent = "显示 " + filtered.length + " / " + items().length;
        cards.innerHTML = filtered.length
          ? filtered.map(cardHtml).join("")
          : '<div class="empty">没有匹配的访谈。试试清除筛选或搜索词。</div>';
      }
    });

    window.addEventListener("hashchange", syncRoute);
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && state.route.name === "list" && document.activeElement.tagName !== "INPUT") {
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
      applyWatched(merged);
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
    data.items.forEach(applyWatched);
    saveWatched();
  }

  async function boot() {
    loadWatched();
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
