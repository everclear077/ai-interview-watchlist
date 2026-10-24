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
assert("sectioned evidence skips 出处", woven.indexOf("出处") === -1);

var leftover = WL.weaveEvidence("<p>body</p>", [], [{ src: "thumbs/frames/x-01.jpg", caption: "尾注" }]);
assert("unsectioned evidence at 出处", leftover.indexOf("出处") !== -1 && leftover.indexOf("尾注") !== -1);
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
} else {
  console.log("skip  data/index.json layout checks (not split yet)");
}

console.log(fails ? "\n" + fails + " failed" : "\nall passed");
process.exit(fails ? 1 : 0);
