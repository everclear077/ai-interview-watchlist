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
assert("analysis present", WL.hasAnalysis({ analysis: { zh: "# 解" } }));
assert("empty analysis hidden", !WL.hasAnalysis({ analysis: { zh: "  " } }));
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
assert("app.js brand is 长镜 · AI", appSrc.indexOf("长镜 · AI") !== -1 && appSrc.indexOf("访谈文库") === -1);
assert("index cache-bust bumped", htmlSrc.indexOf("?v=20261024g") !== -1);
assert("index cache-bust not stale", htmlSrc.indexOf("?v=20261024f") === -1 && htmlSrc.indexOf("?v=20261024e") === -1 && htmlSrc.indexOf("?v=20261024d") === -1);
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
assert("brand stays 长镜 · AI", WL.t("brand", null, "zh") === "长镜 · AI" && WL.t("brand", null, "en") === "长镜 · AI");

console.log(fails ? "\n" + fails + " failed" : "\nall passed");
process.exit(fails ? 1 : 0);
