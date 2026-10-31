#!/usr/bin/env node
"use strict";

var path = require("path");
var WL = require(path.join(__dirname, "..", "media.js"));
var fails = 0;

function assert(name, cond) {
  if (cond) {
    console.log("ok  " + name);
  } else {
    fails += 1;
    console.log("FAIL  " + name);
  }
}

assert("parseRoute list empty", WL.parseRoute("").name === "list");
assert("parseRoute list hash", WL.parseRoute("#/").name === "list");
assert("parseRoute ep", WL.parseRoute("#/ep/lex-dhh-501-2026-08-26").id === "lex-dhh-501-2026-08-26");
assert("parseRoute ep keeps id with h query", WL.parseRoute("#/ep/lex-dhh-501-2026-08-26?h=%E5%BC%80%E7%AF%87").id === "lex-dhh-501-2026-08-26");
assert("parseRoute heading from query", WL.parseRoute("#/ep/foo?h=背景与分歧").heading === "背景与分歧");
assert("hashFor ep", WL.hashFor({ name: "ep", id: "a b" }) === "#/ep/a%20b");
assert("parseRoute show", WL.parseRoute("#/show/a16z").name === "show" && WL.parseRoute("#/show/a16z").slug === "a16z");
assert("parseRoute topic", WL.parseRoute("#/topic/china").name === "topic" && WL.parseRoute("#/topic/china").slug === "china");
assert("parseRoute list query", WL.parseRoute("#/?q=jensen&form=essay").q === "jensen" && WL.parseRoute("#/?q=jensen&form=essay").form.join(",") === "essay");
assert("parseRoute show keeps topic", WL.parseRoute("#/show/sv101?topic=china&form=essay,transcript").topic === "china");
assert("hashFor show", WL.hashFor({ name: "show", slug: "a16z" }) === "#/show/a16z");
assert("hashFor list filters", WL.hashFor({ name: "list", q: "x", form: ["essay"] }) === "#/?q=x&form=essay");
assert("parseRoute period", WL.parseRoute("#/?period=week").period === "week");
assert("parseRoute bad period", WL.parseRoute("#/?period=nope").period === "");
assert("hashFor period", WL.hashFor({ name: "list", period: "month" }) === "#/?period=month");
assert("parseRoute show period", WL.parseRoute("#/show/a16z?period=earlier").period === "earlier");
assert("hashFor show period", WL.hashFor({ name: "show", slug: "sv101", period: "week" }) === "#/show/sv101?period=week");
assert("periodOf week", WL.periodOf("week") === "week");
assert("periodOf junk", WL.periodOf("nope") === "");
assert("hashFor topic with show", WL.hashFor({ name: "topic", slug: "china", show: "sv101" }) === "#/topic/china?show=sv101");
assert("showSlug all-in", WL.showSlug("All-In Podcast #293") === "all-in");
assert("showSlug a16z alias", WL.showSlug("The a16z Show") === "a16z");
assert("showSlug sv101", WL.showSlug("硅谷101播客") === "sv101");
assert("showDisplay all-in", WL.showDisplay("All-In Podcast #293") === "All-In Podcast");
assert("topicSlug known", WL.topicSlug("中国·科技媒体") === "china");
assert("topicDisplay slug", WL.topicDisplay("lab") === "实验室·安全·研究");
assert("slugify without used Set", WL.slugify("Eye on AI") === "eye-on-ai");
assert("slugify uniqueness still works", (function () {
  var used = new Set();
  return WL.slugify("危机", used) === "危机" && WL.slugify("危机", used) === "危机-2";
})());
var newShows = [
  ["Eye on AI", "eye-on-ai"],
  ["Practical AI", "practical-ai"],
  ["Hard Fork", "hard-fork"],
  ["声东击西", "声东击西"],
  ["捕蛇者说", "捕蛇者说"],
  ["Teahour", "teahour"],
  ["Uncapped", "uncapped"],
  ["Google DeepMind Podcast", "google-deepmind-podcast"],
  ["Acquired", "acquired"],
  ["智者访谈", "智者访谈"]
];
newShows.forEach(function (pair) {
  var threw = false;
  var slug = "";
  try { slug = WL.showSlug(pair[0]); } catch (e) { threw = true; }
  assert("showSlug new show " + pair[0], !threw && slug === pair[1] && slug.length > 0);
});
assert("topicSlug unknown category", (function () {
  try { return WL.topicSlug("新主题·测试") === "新主题-测试"; }
  catch (e) { return false; }
})());
var tocLink = WL.tocHref("sv101-astra-agent-robot-pharma-2026-10-19", "开篇");
assert("toc href stays on episode", tocLink.indexOf("#/ep/sv101-astra-agent-robot-pharma-2026-10-19") === 0);
assert("toc href not bare slug", tocLink.indexOf("#开篇") === -1 && !/^#[^/]/.test(tocLink));
assert("toc href has h query", tocLink.indexOf("?h=") !== -1);

assert("youtube watch", WL.parseYouTubeId("https://www.youtube.com/watch?v=2Zj6uMv3kTA") === "2Zj6uMv3kTA");
assert("youtube short", WL.parseYouTubeId("https://youtu.be/FGCP2F_7rQk") === "FGCP2F_7rQk");
assert("youtube extra params", WL.parseYouTubeId("https://www.youtube.com/watch?v=abc123&t=12s") === "abc123");
assert("not youtube", WL.parseYouTubeId("https://podcasts.apple.com/us/podcast/x") === null);

var bili = WL.parseBilibili("https://www.bilibili.com/video/BV1dxJZ6uE3N/");
assert("bilibili bvid", bili && bili.id === "BV1dxJZ6uE3N");

var apple = WL.classifyUrl({
  label: "Apple Podcasts",
  href: "https://podcasts.apple.com/us/podcast/x/id1?i=2"
});
assert("apple is external", apple.kind === "external" && !apple.embed);

var yt = WL.classifyUrl({ label: "YouTube", href: "https://www.youtube.com/watch?v=2Zj6uMv3kTA" });
assert("youtube embed nocookie", yt.kind === "youtube" && /youtube-nocookie\.com\/embed\/2Zj6uMv3kTA/.test(yt.embed));

var empty = { id: "x", title: "t" };
assert("no essay", !WL.hasEssay(empty));
assert("no analysis", !WL.hasAnalysis(empty));
assert("no transcript", !WL.hasTranscript(empty));
assert("no audio", !WL.hasAudio(empty));
assert("essay present", WL.hasEssay({ essay: { zh: "# hi" } }));
assert("empty essay hidden", !WL.hasEssay({ essay: { zh: "   " } }));
assert("slim hasEssay flag", WL.hasEssay({ hasEssay: true }));
assert("slim hasEssay false", !WL.hasEssay({ hasEssay: false }));
assert("body wins over stale flag", !WL.hasEssay({ hasEssay: true, essay: { zh: "  " } }));
assert("essay en-only still counts", WL.hasEssay({ essay: { en: "# hello" } }));
assert("analysis present", WL.hasAnalysis({ analysis: { zh: "# 解" } }));
assert("empty analysis hidden", !WL.hasAnalysis({ analysis: { zh: "  " } }));
assert("analysis en-only still counts", WL.hasAnalysis({ analysis: { en: "# take" } }));
assert("slim hasAnalysis flag", WL.hasAnalysis({ hasAnalysis: true }));
assert("audio present", WL.hasAudio({ media: { audioUrl: "https://x.mp3" } }));
assert("empty audio hidden", !WL.hasAudio({ media: { audioUrl: "" } }));

assert("transcript md official", WL.hasTranscript({ transcript: { source: "official", md: "**A：** hi" } }));
assert("transcript turns asr", WL.hasTranscript({ transcript: { source: "asr", turns: [{ speaker: "A", text: "hi" }] } }));
assert("transcript legacy en official", WL.hasTranscript({ transcript: { source: "official", en: "hello" } }));
assert("empty md hidden", !WL.hasTranscript({ transcript: { source: "official", md: "   " } }));
assert("empty turns hidden", !WL.hasTranscript({ transcript: { source: "asr", turns: [{ speaker: "", text: "  " }] } }));
assert("empty en hidden", !WL.hasTranscript({ transcript: { source: "official", en: "  " } }));
assert("source missing hidden", !WL.hasTranscript({ transcript: { md: "**A：** hi" } }));
assert("source none hidden", !WL.hasTranscript({ transcript: { source: "none", md: "**A：** hi" } }));
assert("source other hidden", !WL.hasTranscript({ transcript: { source: "draft", turns: [{ speaker: "A", text: "hi" }] } }));
assert("source case-sensitive", !WL.hasTranscript({ transcript: { source: "Official", md: "hi" } }));
assert("slim hasTranscript flag", WL.hasTranscript({ hasTranscript: true }));
assert("source none wins over flag", !WL.hasTranscript({ hasTranscript: true, transcript: { source: "none", md: "x" } }));

assert("default tab essay first", WL.defaultTab({
  essay: { zh: "a" }, analysis: { zh: "b" }, transcript: { source: "official", md: "c" }
}) === "essay");
assert("default tab analysis if no essay", WL.defaultTab({ analysis: { zh: "b" } }) === "analysis");
assert("default tab transcript last", WL.defaultTab({ transcript: { source: "asr", md: "x" } }) === "transcript");
assert("available hide empty", WL.availableTabs({ essay: { zh: "x" } }).join(",") === "essay");
assert("available hide source none", WL.availableTabs({
  essay: { zh: "x" }, transcript: { source: "none", md: "stub" }
}).join(",") === "essay");
assert("available all three", WL.availableTabs({
  essay: { zh: "a" }, analysis: { zh: "b" }, transcript: { source: "official", md: "c" }
}).join(",") === "essay,analysis,transcript");
assert("available none", WL.availableTabs(empty).length === 0);

var fromTurns = WL.transcriptMarkdown({
  transcript: { turns: [{ speaker: "主持人", text: "你好" }, { speaker: "嘉宾", text: "嗨" }] }
});
assert("turns markdown speakers", fromTurns.indexOf("**主持人：** 你好") !== -1 && fromTurns.indexOf("**嘉宾：** 嗨") !== -1);

var preferMd = WL.transcriptMarkdown({
  transcript: { md: "**优先：** md", turns: [{ speaker: "X", text: "from-turns" }] }
});
assert("prefer md over turns", preferMd.indexOf("优先") !== -1 && preferMd.indexOf("from-turns") === -1);

var preferTurnsOverEn = WL.transcriptMarkdown({
  transcript: { turns: [{ speaker: "A", text: "turn" }], en: "legacy-en" }
});
assert("prefer turns over en", preferTurnsOverEn.indexOf("**A：** turn") !== -1 && preferTurnsOverEn.indexOf("legacy-en") === -1);

var htmlTurns = WL.renderTranscript({
  transcript: { turns: [{ speaker: "Lex", text: "Hello" }] }
});
assert("turns render strong speaker", /<strong>Lex：<\/strong>/.test(htmlTurns));

var htmlMd = WL.renderTranscript({ transcript: { md: "**Host：** line" } });
assert("md render strong speaker", /<strong>Host：<\/strong>/.test(htmlMd));

var htmlEn = WL.renderTranscript({ transcript: { en: "legacy body" } });
assert("legacy en body", htmlEn.indexOf("legacy body") !== -1);

assert("longform zh uses zh", WL.longformText({ zh: "中文精读" }, "zh") === "中文精读");
assert("longform en empty without en", WL.longformText({ zh: "中文精读" }, "en") === "");
assert("longform en uses en", WL.longformText({ zh: "中文", en: "English close read" }, "en") === "English close read");
assert("longform en nested md", WL.longformText({ en: { md: "Nested EN" } }, "en") === "Nested EN");
assert("bodyForLang essay zh", WL.bodyForLang({ essay: { zh: "精读" } }, "essay", "zh") === "精读");
assert("bodyForLang essay en missing", WL.bodyForLang({ essay: { zh: "精读" } }, "essay", "en") === "");
assert("bodyForLang analysis en", WL.bodyForLang({ analysis: { zh: "解", en: "Take" } }, "analysis", "en") === "Take");

var enAsr = { transcript: { source: "asr", language: "en", md: "**Host:** Hello from ASR." } };
var zhOfficial = { transcript: { source: "official", language: "zh", md: "**主持：** 你好。" } };
var legacyEn = { transcript: { source: "official", language: "zh", en: "Official English body" } };
assert("transcript EN uses language=en md", WL.bodyForLang(enAsr, "transcript", "en").indexOf("Hello from ASR") !== -1);
assert("transcript ZH keeps language=en md as today", WL.bodyForLang(enAsr, "transcript", "zh").indexOf("Hello from ASR") !== -1);
assert("transcript EN hides zh-only body", WL.bodyForLang(zhOfficial, "transcript", "en") === "");
assert("transcript ZH keeps zh official", WL.bodyForLang(zhOfficial, "transcript", "zh").indexOf("你好") !== -1);
assert("transcript EN prefers en field", WL.bodyForLang(legacyEn, "transcript", "en") === "Official English body");
assert("transcript ZH still prefers md over en", WL.bodyForLang({
  transcript: { source: "official", language: "zh", md: "中文稿", en: "English leftover" }
}, "transcript", "zh").indexOf("中文稿") !== -1);

assert("episodeTitle authored fallback", WL.episodeTitle({ title: "Entering the AGI Era" }, "en") === "Entering the AGI Era");
assert("episodeTitle title_en", WL.episodeTitle({ title: "中文标题", title_en: "English Title" }, "en") === "English Title");
assert("episodeTitle zh keeps authored", WL.episodeTitle({ title: "中文标题", title_en: "English Title" }, "zh") === "中文标题");
assert("disclaimer en ignores zh field", WL.localizedDisclaimer({ disclaimer: "中文声明" }, "disclaimerEssay", "en") === WL.t("disclaimerEssay", null, "en"));
assert("disclaimer zh uses authored", WL.localizedDisclaimer({ disclaimer: "中文声明" }, "disclaimerEssay", "zh") === "中文声明");

var md = WL.renderMarkdown("## 危机：诊断\n\n一段话。\n\n> 引用\n\n- a\n- b");
assert("md heading id", md.headings.length === 1 && md.headings[0].id.indexOf("危机") !== -1);
assert("md html h2", /<h2 id=/.test(md.html));
assert("md blockquote", /<blockquote>/.test(md.html));
assert("md list", /<ul>/.test(md.html));

assert("no evidence", !WL.hasEvidence(empty));
assert("empty evidence hidden", !WL.hasEvidence({ evidence: [] }));
assert("evidence missing src hidden", !WL.hasEvidence({ evidence: [{ caption: "x" }] }));
assert("evidence present", WL.hasEvidence({ evidence: [{ src: "thumbs/frames/x-01.jpg", caption: "c" }] }));

var woven = WL.weaveEvidence(
  md.html,
  md.headings,
  [{ src: "thumbs/frames/x-01.jpg", caption: "画面说明", t: "12:34", section: "危机：诊断" }]
);
assert("evidence after heading", woven.indexOf("</h2>") < woven.indexOf("class=\"evidence\"") && woven.indexOf("12:34") !== -1);
assert("sectioned evidence skips chrome heading", woven.indexOf(WL.t("evidence")) === -1);

var leftover = WL.weaveEvidence("<p>body</p>", [], [{ src: "thumbs/frames/x-01.jpg", caption: "尾注" }]);
assert("unsectioned evidence at sources", leftover.indexOf(WL.t("evidence")) !== -1 && leftover.indexOf("尾注") !== -1);
assert("empty weave hidden", WL.weaveEvidence("<p>x</p>", [], []) === "<p>x</p>");

var fs = require("fs");
var indexPath = path.join(__dirname, "..", "data", "index.json");
if (fs.existsSync(indexPath)) {
  var index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  assert("index has items", Array.isArray(index.items) && index.items.length > 0);
  assert("index under 200KB", fs.statSync(indexPath).size < 200 * 1024);
  assert("index layout marker", index.dataLayout === "index+episodes");
  var first = index.items[0];
  assert("slim item has id", !!(first && first.id));
  assert("slim item has cover path", !!(first && first.cover) && String(first.cover).indexOf("thumbs/") === 0);
  assert("slim items strip coverDataUri", index.items.every(function (it) { return !it.coverDataUri; }));
  assert("slim items omit essay body", index.items.every(function (it) { return !it.essay; }));
  assert("slim items omit analysis body", index.items.every(function (it) { return !it.analysis; }));
  assert("slim items omit transcript body", index.items.every(function (it) { return !it.transcript; }));
  var flagged = index.items.filter(function (it) { return it.hasEssay; })[0];
  if (flagged) {
    var epPath = path.join(__dirname, "..", "data", "episodes", flagged.id + ".json");
    assert("episode file exists for hasEssay", fs.existsSync(epPath));
    var ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
    assert("episode has essay.zh", WL.hasEssay(ep));
    assert("episode strips coverDataUri", !ep.coverDataUri);
  }
  var epDir = path.join(__dirname, "..", "data", "episodes");
  var epFiles = fs.readdirSync(epDir).filter(function (f) { return /\.json$/.test(f); });
  var essayEnCount = 0;
  var analysisEnCount = 0;
  var titleEnCount = 0;
  var transEnLang = 0;
  var transZhLang = 0;
  epFiles.forEach(function (f) {
    var ep = JSON.parse(fs.readFileSync(path.join(epDir, f), "utf8"));
    if (WL.longformText(ep.essay, "en")) essayEnCount += 1;
    if (WL.longformText(ep.analysis, "en")) analysisEnCount += 1;
    if (WL.episodeTitle(ep, "en") && ep.title_en) titleEnCount += 1;
    if (ep.transcript && WL.transcriptLangOf(ep.transcript) === "en") transEnLang += 1;
    if (ep.transcript && WL.transcriptLangOf(ep.transcript) === "zh") transZhLang += 1;
  });
  assert("shipped essay.en count is 0", essayEnCount === 0);
  assert("shipped analysis.en count is 0", analysisEnCount === 0);
  assert("shipped title_en count is 0", titleEnCount === 0);
  assert("shipped english transcripts exist", transEnLang > 0);
  assert("shipped chinese transcripts exist", transZhLang > 0);
  var stub = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data.json"), "utf8"));
  assert("root data.json is stub", stub.deprecated === true && Array.isArray(stub.items) && stub.items.length === 0);
  var slugDisplays = {};
  var slugOk = true;
  index.items.forEach(function (it) {
    var slug = WL.showSlug(it.show);
    var display = WL.showDisplay(it.show);
    if (!slugDisplays[slug]) slugDisplays[slug] = display;
    if (slugDisplays[slug] !== display) slugOk = false;
  });
  assert("show slugs map to one display", slugOk && Object.keys(slugDisplays).length > 0);
  var collectThrew = false;
  var collected = {};
  try {
    index.items.forEach(function (it) {
      var slug = WL.showSlug(it.show);
      var topic = WL.topicSlug(it.category);
      if (!slug || !topic) throw new Error("empty slug");
      if (!collected[slug]) collected[slug] = { slug: slug, name: WL.showDisplay(it.show), count: 0 };
      collected[slug].count += 1;
    });
    newShows.forEach(function (pair) {
      var slug = WL.showSlug(pair[0]);
      if (!collected[slug]) collected[slug] = { slug: slug, name: pair[0], count: 0 };
      collected[slug].count += 1;
    });
  } catch (e) {
    collectThrew = true;
  }
  assert("collectShows path slugs all items", !collectThrew && Object.keys(collected).length > 0);
  assert("collectShows includes Eye on AI", !!(collected["eye-on-ai"] && collected["eye-on-ai"].count >= 1));
  assert("collectShows includes 智者访谈", !!(collected["智者访谈"] && collected["智者访谈"].count >= 1));
} else {
  console.log("skip  data/index.json layout checks (not split yet)");
}

var appSrc = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
var htmlSrc = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert("app.js drops watched storage key", appSrc.indexOf("ai-interviews-watched-v1") === -1);
assert("app.js drops watched UI", appSrc.indexOf("已看") === -1 && appSrc.indexOf("待看") === -1);
assert("app.js uses cover tiles not ledger", appSrc.indexOf("tile-hit") !== -1 && appSrc.indexOf("shelf-track") !== -1 && appSrc.indexOf("class=\"ledger\"") === -1);
assert("index title is 长镜 · AI", htmlSrc.indexOf("长镜 · AI") !== -1 && htmlSrc.indexOf("访谈文库") === -1 && htmlSrc.indexOf("观看列表") === -1);
assert("index has Long Lens AI", htmlSrc.indexOf("Long Lens AI") !== -1);
assert("app.js brand via t()", appSrc.indexOf('t("brand")') !== -1 && appSrc.indexOf("访谈文库") === -1 && appSrc.indexOf("SITE_TITLE") === -1);
assert("footer rss line", appSrc.indexOf('t("footer4")') !== -1);
assert("footer rss zh", WL.t("footer4", null, "zh").indexOf("订阅") !== -1 && WL.t("footer4", null, "zh").indexOf("feed.xml") !== -1);
assert("footer rss en", WL.t("footer4", null, "en").indexOf("Subscribe") !== -1 && WL.t("footer4", null, "en").indexOf("feed.xml") !== -1);
assert("app.js uses bodyForLang", appSrc.indexOf("bodyForLang") !== -1 && appSrc.indexOf("unavailableEssay") !== -1);
assert("index cache-bust bumped", htmlSrc.indexOf("?v=20261031a") !== -1);
assert("index cache-bust on three assets", (htmlSrc.match(/\?v=20261031a/g) || []).length === 3);
assert("index cache-bust not stale", htmlSrc.indexOf("?v=20261024h") === -1 && htmlSrc.indexOf("?v=20261024g") === -1 && htmlSrc.indexOf("?v=20261024f") === -1 && htmlSrc.indexOf("?v=20261024e") === -1 && htmlSrc.indexOf("?v=20261024d") === -1);
assert("rss alternate link", htmlSrc.indexOf('rel="alternate"') !== -1 && htmlSrc.indexOf("application/rss+xml") !== -1 && htmlSrc.indexOf("https://everclear077.github.io/ai-interview-watchlist/feed.xml") !== -1);
var notFoundSrc = fs.readFileSync(path.join(__dirname, "..", "404.html"), "utf8");
assert("404 rss alternate", notFoundSrc.indexOf("application/rss+xml") !== -1 && notFoundSrc.indexOf("https://everclear077.github.io/ai-interview-watchlist/feed.xml") !== -1);
assert("index FOUC theme script", htmlSrc.indexOf("wl-theme") !== -1 && htmlSrc.indexOf("data-theme") !== -1);
assert("index FOUC lang script", htmlSrc.indexOf("wl-lang") !== -1 && htmlSrc.indexOf("data-lang") !== -1 && htmlSrc.indexOf("zh-CN") !== -1);
assert("index FOUC before stylesheet", htmlSrc.indexOf("localStorage.getItem") < htmlSrc.indexOf("styles.css"));

var cssSrc = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
assert("css dark theme tokens", cssSrc.indexOf('[data-theme="dark"]') !== -1);
assert("css light theme tokens", cssSrc.indexOf('[data-theme="light"]') !== -1);
assert("css drops paper body mode", cssSrc.indexOf("body.paper") === -1);
assert("css drops terracotta leftover", cssSrc.indexOf("#8A5A12") === -1);
assert("css reduced-motion theme", cssSrc.indexOf("prefers-reduced-motion") !== -1);
assert("css lang toggle", cssSrc.indexOf(".lang-toggle") !== -1 && cssSrc.indexOf(".lang-btn") !== -1);

assert("theme key", WL.THEME_KEY === "wl-theme");
assert("normalizeTheme light", WL.normalizeTheme("light") === "light");
assert("normalizeTheme dark", WL.normalizeTheme("dark") === "dark");
assert("normalizeTheme junk", WL.normalizeTheme("sepia") === "");
assert("resolveTheme stored light wins", WL.resolveTheme("light", false) === "light");
assert("resolveTheme stored dark wins", WL.resolveTheme("dark", true) === "dark");
assert("resolveTheme system dark", WL.resolveTheme("", false) === "dark");
assert("resolveTheme system light", WL.resolveTheme("", true) === "light");
assert("nextTheme light", WL.nextTheme("light") === "dark");
assert("nextTheme dark", WL.nextTheme("dark") === "light");
assert("themeColor dark", WL.themeColor("dark") === "#090C11");
assert("themeColor light", WL.themeColor("light") === "#F3F5F8");

assert("app theme toggle", appSrc.indexOf("theme-toggle") !== -1 && appSrc.indexOf("data-theme-toggle") !== -1);
assert("app lang toggle", appSrc.indexOf("lang-toggle") !== -1 && appSrc.indexOf("data-lang-set") !== -1);
assert("app chrome uses t()", appSrc.indexOf("W.t(") !== -1 && appSrc.indexOf("本周") === -1 && appSrc.indexOf("找一集") === -1);
assert("app drops paper body mode", appSrc.indexOf("setBodyMode") === -1 && appSrc.indexOf("classList.toggle(\"paper\"") === -1);

assert("lang key", WL.LANG_KEY === "wl-lang");
assert("normalizeLang zh", WL.normalizeLang("zh") === "zh");
assert("normalizeLang en", WL.normalizeLang("en") === "en");
assert("normalizeLang junk", WL.normalizeLang("fr") === "");
assert("resolveLang shanghai → zh", WL.resolveLang("", "Asia/Shanghai") === "zh");
assert("resolveLang chongqing → zh", WL.resolveLang("", "Asia/Chongqing") === "zh");
assert("resolveLang urumqi → zh", WL.resolveLang("", "Asia/Urumqi") === "zh");
assert("resolveLang harbin → zh", WL.resolveLang("", "Asia/Harbin") === "zh");
assert("resolveLang nyc → en", WL.resolveLang("", "America/New_York") === "en");
assert("resolveLang singapore IANA → en", WL.resolveLang("", "Asia/Singapore") === "en");
assert("resolveLang stored en wins shanghai", WL.resolveLang("en", "Asia/Shanghai") === "en");
assert("resolveLang stored zh wins nyc", WL.resolveLang("zh", "America/New_York") === "zh");
assert("resolveLang CST offset no IANA → zh", WL.resolveLang("", "", -480) === "zh");
assert("resolveLang other offset no IANA → en", WL.resolveLang("", "", 300) === "en");
assert("resolveLang IANA wins over offset", WL.resolveLang("", "Europe/London", -480) === "en");
assert("htmlLang zh", WL.htmlLang("zh") === "zh-CN");
assert("htmlLang en", WL.htmlLang("en") === "en");
assert("nextLang zh", WL.nextLang("zh") === "en");
assert("t zh shelf", WL.t("periodWeek", null, "zh") === "本周");
assert("t en shelf", WL.t("periodWeek", null, "en") === "This week");
assert("t interpolate", WL.t("updated", { date: "2026-10-24" }, "en") === "Updated 2026-10-24");
assert("t theme zh", WL.t("themeToggle", null, "zh").indexOf("浅色") !== -1);
assert("t theme en", /theme/i.test(WL.t("themeToggle", null, "en")));
var zhKeys = WL.i18nKeys().slice().sort();
var enKeys = Object.keys(WL.I18N.en).sort();
assert("i18n key coverage", zhKeys.join(",") === enKeys.join(",") && zhKeys.length > 40);
assert("brand zh is 长镜 · AI", WL.t("brand", null, "zh") === "长镜 · AI");
assert("brand en is Long Lens AI", WL.t("brand", null, "en") === "Long Lens AI");
assert("unavailable essay en", WL.t("unavailableEssay", null, "en") === "English close read not available yet");
assert("unavailable analysis en", WL.t("unavailableAnalysis", null, "en") === "English analysis not available yet");
assert("unavailable transcript en", WL.t("unavailableTranscript", null, "en") === "English transcript not available yet");

function runNode(args, timeoutMs) {
  return require("child_process").spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    timeout: timeoutMs || 60000,
    maxBuffer: 20 * 1024 * 1024
  });
}

var feedCheck = runNode(["scripts/build-feed.mjs", "--self-check"], 30000);
if (feedCheck.status !== 0) console.log(feedCheck.stdout || "", feedCheck.stderr || "");
assert("feed generator self-check", feedCheck.status === 0);

var feedMatch = runNode(["scripts/build-feed.mjs", "--check"], 30000);
if (feedMatch.status !== 0) console.log(feedMatch.stdout || "", feedMatch.stderr || "");
assert("feed.xml matches catalog", feedMatch.status === 0);

function expectedRssDate(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return "";
  var y = +m[1], mo = +m[2], d = +m[3];
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).toUTCString();
}

function loadFeed(file) {
  var script = [
    "import json, sys, xml.etree.ElementTree as ET",
    "root = ET.parse(sys.argv[1]).getroot()",
    "if root.tag != 'rss': raise SystemExit('root is ' + root.tag)",
    "channel = root.find('channel')",
    "atom = '{http://www.w3.org/2005/Atom}link'",
    "self_link = channel.find(atom)",
    "items = []",
    "for item in channel.findall('item'):",
    "    items.append({",
    "        'title': item.findtext('title') or '',",
    "        'link': item.findtext('link') or '',",
    "        'guid': item.findtext('guid') or '',",
    "        'pubDate': item.findtext('pubDate') or '',",
    "        'description': item.findtext('description') or '',",
    "        'categories': [c.text or '' for c in item.findall('category')]",
    "    })",
    "out = {",
    "    'version': root.get('version'),",
    "    'title': channel.findtext('title') or '',",
    "    'link': channel.findtext('link') or '',",
    "    'description': channel.findtext('description') or '',",
    "    'lastBuildDate': channel.findtext('lastBuildDate') or '',",
    "    'self': self_link.get('href') if self_link is not None else '',",
    "    'items': items",
    "}",
    "json.dump(out, sys.stdout, ensure_ascii=False)"
  ].join("\n");
  var parsed = require("child_process").spawnSync("python3", ["-c", script, file], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (parsed.status !== 0) throw new Error(parsed.stderr || "feed xml parse failed");
  return JSON.parse(parsed.stdout);
}

if (fs.existsSync(indexPath)) {
  var feedPath = path.join(__dirname, "..", "feed.xml");
  var rssPath = path.join(__dirname, "..", "rss.xml");
  var feedXml = "";
  var feed = null;
  var feedErr = "";
  try {
    feedXml = fs.readFileSync(feedPath, "utf8");
    feed = loadFeed(feedPath);
  } catch (e) {
    feedErr = e.message;
  }
  assert("feed.xml parses as rss", !!feed && !feedErr);
  if (feedErr) console.log(feedErr);
  if (feed) {
    var catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    var rssXml = fs.readFileSync(rssPath, "utf8");
    assert("rss.xml is a copy of feed.xml", rssXml === feedXml);
    assert("feed version", feed.version === "2.0");
    assert("feed channel title", feed.title === "长镜 · AI");
    assert("feed description names Long Lens AI", feed.description.indexOf("Long Lens AI") !== -1 && feed.description.length < 240);
    assert("feed site link", feed.link === "https://everclear077.github.io/ai-interview-watchlist/");
    assert("feed self link", feed.self === "https://everclear077.github.io/ai-interview-watchlist/feed.xml");
    assert("feed lastBuildDate from lastUpdated", feed.lastBuildDate === expectedRssDate(catalog.lastUpdated) && !!feed.lastBuildDate);
    assert("feed includes every episode", feed.items.length === catalog.items.length && catalog.items.length > 0 && catalog.items.length <= 500);
    assert("feed has no coverDataUri", feedXml.indexOf("coverDataUri") === -1 && feedXml.indexOf("data:image") === -1);
    assert("feed does not dump essay padding", feedXml.indexOf("门禁续写") === -1);
    var byGuid = {};
    feed.items.forEach(function (item) { byGuid[item.guid] = item; });
    var sortedIds = catalog.items.map(function (it, i) {
      return { id: it.id, date: /^\d{4}-\d{2}-\d{2}$/.test(it.date || "") ? it.date : "", i: i };
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.i - b.i;
    });
    assert("feed newest id first", feed.items[0] && feed.items[0].guid === sortedIds[0].id);
    var datesOk = true;
    var prevDate = "9999-99-99";
    var linksOk = true;
    var summaryOk = true;
    var pubOk = true;
    catalog.items.forEach(function (it) {
      var entry = byGuid[it.id];
      if (!entry) {
        linksOk = false;
        summaryOk = false;
        return;
      }
      var expectLink = "https://everclear077.github.io/ai-interview-watchlist/#/ep/" + encodeURIComponent(it.id);
      if (entry.link !== expectLink || entry.guid !== it.id) linksOk = false;
      if (String(it.summary || "").trim()) {
        if (entry.description !== String(it.summary).trim()) summaryOk = false;
      } else if (entry.description.length > 361) {
        summaryOk = false;
      }
      if (expectedRssDate(it.date) && entry.pubDate !== expectedRssDate(it.date)) pubOk = false;
    });
    feed.items.forEach(function (entry) {
      var src = catalog.items.filter(function (it) { return it.id === entry.guid; })[0];
      var d = src && /^\d{4}-\d{2}-\d{2}$/.test(src.date || "") ? src.date : "";
      if (d > prevDate) datesOk = false;
      if (!d && prevDate) prevDate = "";
      else prevDate = d;
    });
    assert("feed links are absolute episode urls", linksOk);
    assert("feed descriptions are summaries", summaryOk);
    assert("feed pubDates follow item dates", pubOk);
    assert("feed sorted newest first", datesOk);
  }
}

var mcpServer = path.join(__dirname, "..", "mcp", "node_modules", "@modelcontextprotocol", "server");
var mcpSmoke = runNode(["mcp/smoke.mjs"], 60000);
if (!fs.existsSync(mcpServer) || mcpSmoke.status !== 0) {
  console.log(mcpSmoke.stdout || "");
  console.log(mcpSmoke.stderr || "");
}
assert("mcp read-only smoke", fs.existsSync(mcpServer) && mcpSmoke.status === 0);

console.log(fails ? "\n" + fails + " failed" : "\nall passed");
process.exit(fails ? 1 : 0);
