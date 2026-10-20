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
assert("hashFor ep", WL.hashFor({ name: "ep", id: "a b" }) === "#/ep/a%20b");

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
assert("no transcript", !WL.hasTranscript(empty));
assert("no audio", !WL.hasAudio(empty));
assert("essay present", WL.hasEssay({ essay: { zh: "# hi" } }));
assert("empty essay hidden", !WL.hasEssay({ essay: { zh: "   " } }));
assert("audio present", WL.hasAudio({ media: { audioUrl: "https://x.mp3" } }));
assert("empty audio hidden", !WL.hasAudio({ media: { audioUrl: "" } }));

var md = WL.renderMarkdown("## 危机：诊断\n\n一段话。\n\n> 引用\n\n- a\n- b");
assert("md heading id", md.headings.length === 1 && md.headings[0].id.indexOf("危机") !== -1);
assert("md html h2", /<h2 id=/.test(md.html));
assert("md blockquote", /<blockquote>/.test(md.html));
assert("md list", /<ul>/.test(md.html));

console.log(fails ? "\n" + fails + " failed" : "\nall passed");
process.exit(fails ? 1 : 0);
