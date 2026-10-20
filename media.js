/* Shared helpers: routing, embeds, markdown, Phase 2/3 field detection.
   Works in the browser (window.WL) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WL = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textOf(s) {
    return String(s == null ? "" : s).trim();
  }

  function hasEssay(it) {
    return !!(it && it.essay && textOf(it.essay.zh));
  }

  function hasTranscript(it) {
    if (!it || !it.transcript) return false;
    var en = it.transcript.en;
    if (typeof en === "string") return !!textOf(en);
    if (Array.isArray(en)) return en.length > 0;
    return false;
  }

  function audioUrlOf(it) {
    if (!it || !it.media) return "";
    return textOf(it.media.audioUrl);
  }

  function hasAudio(it) {
    return !!audioUrlOf(it);
  }

  function parseRoute(hash) {
    var h = String(hash == null ? "" : hash).replace(/^#/, "").replace(/^\//, "");
    var parts = h.split("/").filter(Boolean);
    if (parts[0] === "ep" && parts[1]) {
      try {
        return { name: "ep", id: decodeURIComponent(parts[1]) };
      } catch (e) {
        return { name: "ep", id: parts[1] };
      }
    }
    return { name: "list" };
  }

  function hashFor(route) {
    if (route && route.name === "ep" && route.id) {
      return "#/ep/" + encodeURIComponent(route.id);
    }
    return "#/";
  }

  function parseYouTubeId(href) {
    try {
      var u = new URL(href);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") {
        return u.pathname.replace(/^\//, "").split("/")[0] || null;
      }
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        var v = u.searchParams.get("v");
        if (v) return v;
        var m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/);
        if (m) return m[1];
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function parseBilibili(href) {
    try {
      var u = new URL(href);
      var host = u.hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();
      if (host === "bilibili.com" || host === "b23.tv") {
        var m = u.pathname.match(/\/video\/(BV[\w]+)/i) || u.pathname.match(/\/video\/(av\d+)/i);
        if (m) {
          return { id: m[1], page: u.searchParams.get("p") || "1" };
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function classifyUrl(u) {
    var href = u && u.href ? String(u.href) : "";
    var label = u && u.label ? String(u.label) : "链接";
    var yt = parseYouTubeId(href);
    if (yt) {
      return {
        kind: "youtube",
        label: label,
        href: href,
        embed: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt)
      };
    }
    var bili = parseBilibili(href);
    if (bili) {
      var q = bili.id.toLowerCase().indexOf("av") === 0
        ? "aid=" + encodeURIComponent(bili.id.replace(/^av/i, ""))
        : "bvid=" + encodeURIComponent(bili.id);
      return {
        kind: "bilibili",
        label: label,
        href: href,
        embed: "https://player.bilibili.com/player.html?" + q +
          "&page=" + encodeURIComponent(bili.page) +
          "&high_quality=1&danmaku=0&autoplay=0"
      };
    }
    return { kind: "external", label: label, href: href, embed: "" };
  }

  function detectMedia(it) {
    var urls = (it && it.urls) ? it.urls : [];
    var classified = urls.map(classifyUrl);
    var embeds = classified.filter(function (c) { return c.embed; });
    return {
      classified: classified,
      embeds: embeds,
      externals: classified.filter(function (c) { return !c.embed; }),
      primary: embeds[0] || null
    };
  }

  function looksLikeHtml(s) {
    var t = textOf(s);
    return t.charAt(0) === "<" && /<\/?[a-z][\s\S]*>/i.test(t);
  }

  function slugify(text, used) {
    var s = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
    var id = s;
    var n = 2;
    while (used.has(id)) {
      id = s + "-" + n;
      n += 1;
    }
    used.add(id);
    return id;
  }

  function inlineMd(s) {
    var out = escapeHtml(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, href) {
      return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    return out;
  }

  function renderMarkdown(src) {
    var used = new Set();
    var headings = [];
    var lines = String(src == null ? "" : src).replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var i = 0;
    var para = [];
    var list = null;

    function flushPara() {
      if (!para.length) return;
      html.push("<p>" + inlineMd(para.join(" ")) + "</p>");
      para = [];
    }
    function flushList() {
      if (!list) return;
      html.push("<" + list.tag + ">" + list.items.join("") + "</" + list.tag + ">");
      list = null;
    }
    function flush() {
      flushPara();
      flushList();
    }

    while (i < lines.length) {
      var line = lines[i];
      var heading = /^(#{1,4})\s+(.+)$/.exec(line);
      var quote = /^>\s?(.*)$/.exec(line);
      var ul = /^\s*[-*+]\s+(.+)$/.exec(line);
      var ol = /^\s*\d+\.\s+(.+)$/.exec(line);
      if (!textOf(line)) {
        flush();
        i += 1;
        continue;
      }
      if (heading) {
        flush();
        var level = heading[1].length;
        var text = heading[2].trim();
        var id = slugify(text, used);
        headings.push({ id: id, text: text, level: level });
        html.push("<h" + level + " id=\"" + escapeHtml(id) + "\">" + inlineMd(text) + "</h" + level + ">");
        i += 1;
        continue;
      }
      if (line.trim() === "---" || line.trim() === "***") {
        flush();
        html.push("<hr />");
        i += 1;
        continue;
      }
      if (quote) {
        flush();
        var qlines = [];
        while (i < lines.length) {
          var q = /^>\s?(.*)$/.exec(lines[i]);
          if (!q) break;
          qlines.push(q[1]);
          i += 1;
        }
        html.push("<blockquote><p>" + inlineMd(qlines.join(" ")) + "</p></blockquote>");
        continue;
      }
      if (ul || ol) {
        flushPara();
        var tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) {
          flushList();
          list = { tag: tag, items: [] };
        }
        list.items.push("<li>" + inlineMd((ul || ol)[1]) + "</li>");
        i += 1;
        continue;
      }
      flushList();
      para.push(line.trim());
      i += 1;
    }
    flush();
    return { html: html.join("\n"), headings: headings };
  }

  var ALLOWED_TAGS = {
    P: 1, H1: 1, H2: 1, H3: 1, H4: 1, UL: 1, OL: 1, LI: 1,
    BLOCKQUOTE: 1, A: 1, EM: 1, STRONG: 1, B: 1, I: 1,
    CODE: 1, PRE: 1, HR: 1, BR: 1, SPAN: 1, DIV: 1
  };

  function sanitizeNode(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return "";
    var tag = node.tagName;
    if (!ALLOWED_TAGS[tag]) {
      var acc = "";
      for (var i = 0; i < node.childNodes.length; i++) acc += sanitizeNode(node.childNodes[i]);
      return acc;
    }
    var attrs = "";
    if (tag === "A") {
      var href = node.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        attrs = ' href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer"';
      }
    }
    if (/^H[1-4]$/.test(tag) && node.id) {
      attrs += ' id="' + escapeHtml(node.id) + '"';
    }
    var inner = "";
    for (var j = 0; j < node.childNodes.length; j++) inner += sanitizeNode(node.childNodes[j]);
    if (tag === "BR" || tag === "HR") return "<" + tag.toLowerCase() + " />";
    return "<" + tag.toLowerCase() + attrs + ">" + inner + "</" + tag.toLowerCase() + ">";
  }

  function renderHtmlEssay(src) {
    var headings = [];
    var used = new Set();
    if (typeof DOMParser === "undefined") {
      return { html: String(src), headings: headings };
    }
    var doc = new DOMParser().parseFromString("<div id='root'>" + src + "</div>", "text/html");
    var root = doc.getElementById("root");
    if (!root) return { html: "", headings: headings };
    var hs = root.querySelectorAll("h1,h2,h3,h4");
    for (var i = 0; i < hs.length; i++) {
      var el = hs[i];
      var text = (el.textContent || "").trim();
      if (!text) continue;
      var id = el.id ? el.id : slugify(text, used);
      if (el.id) used.add(el.id);
      el.id = id;
      headings.push({ id: id, text: text, level: Number(el.tagName.charAt(1)) });
    }
    var html = "";
    for (var k = 0; k < root.childNodes.length; k++) html += sanitizeNode(root.childNodes[k]);
    return { html: html, headings: headings };
  }

  function renderEssay(zh) {
    if (!textOf(zh)) return { html: "", headings: [] };
    if (looksLikeHtml(zh)) return renderHtmlEssay(zh);
    return renderMarkdown(zh);
  }

  function renderTranscript(en) {
    if (typeof en === "string") {
      if (!textOf(en)) return "";
      if (looksLikeHtml(en)) return renderHtmlEssay(en).html;
      return renderMarkdown(en).html;
    }
    if (Array.isArray(en)) {
      return en.map(function (seg) {
        if (!seg) return "";
        if (typeof seg === "string") return "<p>" + inlineMd(seg) + "</p>";
        var who = textOf(seg.speaker || seg.name);
        var body = textOf(seg.text || seg.body || "");
        var t = textOf(seg.t || seg.time || "");
        var head = who
          ? "<span class='who'>" + escapeHtml(who) + (t ? " <span class='t'>" + escapeHtml(t) + "</span>" : "") + "</span>"
          : "";
        return "<p class='cue'>" + head + inlineMd(body) + "</p>";
      }).join("\n");
    }
    return "";
  }

  return {
    escapeHtml: escapeHtml,
    textOf: textOf,
    hasEssay: hasEssay,
    hasTranscript: hasTranscript,
    hasAudio: hasAudio,
    audioUrlOf: audioUrlOf,
    parseRoute: parseRoute,
    hashFor: hashFor,
    parseYouTubeId: parseYouTubeId,
    parseBilibili: parseBilibili,
    classifyUrl: classifyUrl,
    detectMedia: detectMedia,
    looksLikeHtml: looksLikeHtml,
    renderMarkdown: renderMarkdown,
    renderEssay: renderEssay,
    renderTranscript: renderTranscript,
    slugify: slugify
  };
});
