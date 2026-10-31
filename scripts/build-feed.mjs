#!/usr/bin/env node
/**
 * Build the public RSS 2.0 feed from the published catalog.
 *
 *   feed.xml   canonical feed (committed; GitHub Pages serves it)
 *   rss.xml    identical copy
 *
 * Description text is item.summary. If that is empty, a short slice of
 * essay.zh is used. Nothing else is written into the body.
 *
 * Usage:
 *   node scripts/build-feed.mjs [--out <repo-root>]
 *   node scripts/build-feed.mjs --check
 *   node scripts/build-feed.mjs --self-check
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEED_URL, SITE_URL, episodePageUrl } from "./site.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");

export const FEED_ITEM_CAP = 500;
export const SUMMARY_CHARS = 360;

const CHANNEL_TITLE = "长镜 · AI";
const CHANNEL_DESCRIPTION =
  "长镜 · AI（Long Lens AI）。精选 AI / 科技长视频访谈，带精读、解读与文稿。";

const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function xmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(ILLEGAL_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function dateKey(item) {
  const s = String((item && item.date) || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function rssDate(value) {
  const s = String(value || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
    return dt.toUTCString();
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return "";
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toUTCString();
}

export function sortNewest(items) {
  return (items || [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it && it.id)
    .sort((a, b) => {
      const da = dateKey(a.it);
      const db = dateKey(b.it);
      if (da !== db) return da < db ? 1 : -1;
      return a.i - b.i;
    })
    .map(({ it }) => it);
}

export function truncatePlain(text, max = SUMMARY_CHARS) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max).join("").trimEnd() + "…";
}

export function summaryOf(item, essayZh) {
  const summary = String(item && item.summary != null ? item.summary : "").trim();
  if (summary) return summary;
  return truncatePlain(essayZh, SUMMARY_CHARS);
}

function tag(name, text, attrs) {
  const attr = attrs
    ? Object.entries(attrs)
        .map(([key, val]) => " " + key + '="' + xmlEscape(val) + '"')
        .join("")
    : "";
  return "<" + name + attr + ">" + xmlEscape(text) + "</" + name + ">";
}

export function renderFeedXml(index, essayLookup) {
  const items = sortNewest(index && index.items).slice(0, FEED_ITEM_CAP);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    " + tag("title", CHANNEL_TITLE),
    "    " + tag("link", SITE_URL),
    "    " + tag("description", CHANNEL_DESCRIPTION),
    "    " + tag("language", "zh-CN")
  ];
  const built = rssDate(index && index.lastUpdated);
  if (built) lines.push("    " + tag("lastBuildDate", built));
  lines.push(
    '    <atom:link href="' + xmlEscape(FEED_URL) + '" rel="self" type="application/rss+xml"/>'
  );
  lines.push("    " + tag("generator", "long-lens-ai scripts/build-feed.mjs"));
  for (const item of items) {
    const essay = essayLookup ? essayLookup(item) : "";
    lines.push("    <item>");
    lines.push("      " + tag("title", item.title || item.id));
    lines.push("      " + tag("link", episodePageUrl(item.id)));
    lines.push("      " + tag("guid", String(item.id), { isPermaLink: "false" }));
    const pub = rssDate(item.date);
    if (pub) lines.push("      " + tag("pubDate", pub));
    if (item.category) lines.push("      " + tag("category", item.category));
    if (item.show) lines.push("      " + tag("category", item.show));
    lines.push("      " + tag("description", summaryOf(item, essay)));
    lines.push("    </item>");
  }
  lines.push("  </channel>");
  lines.push("</rss>");
  lines.push("");
  return lines.join("\n");
}

function essayZhFromDisk(outRoot, item) {
  if (String(item && item.summary != null ? item.summary : "").trim()) return "";
  const id = String((item && item.id) || "");
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return "";
  const file = path.join(outRoot, "data", "episodes", id + ".json");
  try {
    const ep = JSON.parse(fs.readFileSync(file, "utf8"));
    const zh = ep && ep.essay && typeof ep.essay.zh === "string" ? ep.essay.zh : "";
    return zh;
  } catch {
    return "";
  }
}

export function writeFeedFiles(outRoot, index) {
  const xml = renderFeedXml(index, (item) => essayZhFromDisk(outRoot, item));
  fs.writeFileSync(path.join(outRoot, "feed.xml"), xml);
  fs.writeFileSync(path.join(outRoot, "rss.xml"), xml);
  const count = Math.min(sortNewest(index && index.items).length, FEED_ITEM_CAP);
  return {
    items: count,
    bytes: Buffer.byteLength(xml),
    capped: sortNewest(index && index.items).length > FEED_ITEM_CAP
  };
}

function readIndex(outRoot) {
  const file = path.join(outRoot, "data", "index.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArgs(argv) {
  const args = { out: DEFAULT_ROOT, check: false, selfCheck: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out") {
      args.out = path.resolve(rest[++i] || "");
      continue;
    }
    if (rest[i] === "--check") {
      args.check = true;
      continue;
    }
    if (rest[i] === "--self-check") {
      args.selfCheck = true;
      continue;
    }
    if (rest[i] === "--help" || rest[i] === "-h") args.help = true;
  }
  return args;
}

function kb(n) {
  return (n / 1024).toFixed(1) + " KB";
}

function assertCheck(name, cond) {
  if (!cond) throw new Error("self-check failed: " + name);
}

function selfCheck() {
  assertCheck(
    "known lastBuildDate",
    rssDate("2026-10-30") === "Fri, 30 Oct 2026 12:00:00 GMT"
  );
  assertCheck("bad calendar date dropped", rssDate("2026-02-31") === "");
  assertCheck("summary wins over essay", summaryOf({ summary: "  目录摘要  " }, "不应出现") === "目录摘要");
  assertCheck("blank summary uses essay", summaryOf({ summary: "  " }, "甲".repeat(10)) === "甲".repeat(10));
  const longEssay = "# 标题\n\n正文" + "甲".repeat(500);
  const sliced = summaryOf({ summary: "" }, longEssay);
  assertCheck("essay slice starts with source text", sliced.startsWith("# 标题 正文"));
  assertCheck("essay slice is capped", Array.from(sliced).length === SUMMARY_CHARS + 1 && sliced.endsWith("…"));
  assertCheck("essay slice does not invent", sliced.slice(0, -1) === truncatePlain(longEssay, SUMMARY_CHARS).slice(0, -1));
  assertCheck("empty stays empty", summaryOf({ summary: "" }, "  \n") === "");

  const index = {
    title: "ignored",
    lastUpdated: "2026-10-30",
    items: [
      { id: "older", title: "Old & <new>", date: "2026-01-02", summary: "has & ampersand", category: "VC·基建·市场", show: "Hard Fork" },
      { id: "newer", title: "A <tag>", date: "2026-10-30", summary: "", category: "实验室·安全·研究" },
      { id: "same-day", title: "Same day later in index", date: "2026-10-30", summary: "second" },
      { id: "nodate", title: "No date", summary: "plain" }
    ]
  };
  const essays = { newer: longEssay };
  const xml = renderFeedXml(index, (item) => essays[item.id] || "");
  assertCheck("xml declaration", xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assertCheck("channel title", xml.includes("<title>长镜 · AI</title>"));
  assertCheck("long lens in description", xml.includes("Long Lens AI"));
  assertCheck("lastBuildDate", xml.includes("<lastBuildDate>Fri, 30 Oct 2026 12:00:00 GMT</lastBuildDate>"));
  assertCheck("self link", xml.includes('href="https://everclear077.github.io/ai-interview-watchlist/feed.xml"'));
  assertCheck("escaped ampersand", xml.includes("<description>has &amp; ampersand</description>"));
  assertCheck("escaped title", xml.includes("<title>A &lt;tag&gt;</title>"));
  assertCheck("absolute newer link", xml.includes("https://everclear077.github.io/ai-interview-watchlist/#/ep/newer"));
  assertCheck("guid is episode id", xml.includes('<guid isPermaLink="false">older</guid>'));
  const nodate = xml.slice(xml.indexOf("<title>No date</title>"), xml.indexOf("</item>", xml.indexOf("<title>No date</title>")));
  assertCheck("nodate omits pubDate", nodate.indexOf("<pubDate>") === -1);
  const order = [...xml.matchAll(/<guid isPermaLink="false">([^<]+)<\/guid>/g)].map((m) => m[1]);
  assertCheck("newest first and stable same-day order", order.join(",") === "newer,same-day,older,nodate");
  assertCheck("truncated essay in feed", xml.includes(xmlEscape(sliced)));
  assertCheck("full essay not dumped", !xml.includes("甲".repeat(500)));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wl-feed-"));
  try {
    const monolith = {
      version: 1,
      title: "t",
      lastUpdated: "2026-10-30",
      categories: ["VC·基建·市场"],
      items: [
        {
          id: "b-item",
          title: "B",
          date: "2026-10-01",
          summary: "has & ampersand",
          show: "Hard Fork",
          category: "VC·基建·市场",
          essay: { zh: "不应该进入有 summary 的条目" }
        },
        {
          id: "a-item",
          title: "A <tag>",
          date: "2026-10-30",
          summary: "",
          show: "硅谷101",
          category: "实验室·安全·研究",
          essay: { zh: longEssay }
        }
      ]
    };
    const input = path.join(tmp, "in.json");
    fs.writeFileSync(input, JSON.stringify(monolith));
    const split = spawnSync(process.execPath, [path.join(__dirname, "split-data.mjs"), input, "--out", tmp], {
      encoding: "utf8"
    });
    if (split.status !== 0) {
      throw new Error("split failed\n" + split.stdout + "\n" + split.stderr);
    }
    const feed = fs.readFileSync(path.join(tmp, "feed.xml"), "utf8");
    const rss = fs.readFileSync(path.join(tmp, "rss.xml"), "utf8");
    assertCheck("split writes identical rss.xml", feed === rss);
    assertCheck("split feed escapes summary", feed.includes("<description>has &amp; ampersand</description>"));
    assertCheck("split feed does not use essay when summary exists", !feed.includes("不应该进入有 summary 的条目"));
    assertCheck("split feed absolute link", feed.includes("https://everclear077.github.io/ai-interview-watchlist/#/ep/a-item"));
    assertCheck("split feed newest id first", feed.indexOf("<guid isPermaLink=\"false\">a-item</guid>") < feed.indexOf("<guid isPermaLink=\"false\">b-item</guid>"));
    assertCheck("split feed lastUpdated", feed.includes("<lastBuildDate>Fri, 30 Oct 2026 12:00:00 GMT</lastBuildDate>"));
    const episode = JSON.parse(fs.readFileSync(path.join(tmp, "data", "episodes", "a-item.json"), "utf8"));
    assertCheck("split keeps essay.zh", episode.essay && episode.essay.zh === longEssay);
    fs.unlinkSync(path.join(tmp, "feed.xml"));
    fs.unlinkSync(path.join(tmp, "rss.xml"));
    const stub = spawnSync(
      process.execPath,
      [path.join(__dirname, "split-data.mjs"), "--stub-from-index", path.join(tmp, "data", "index.json"), "--out", tmp],
      { encoding: "utf8" }
    );
    if (stub.status !== 0) throw new Error("stub-from-index failed\n" + stub.stdout + "\n" + stub.stderr);
    const again = fs.readFileSync(path.join(tmp, "feed.xml"), "utf8");
    assertCheck("stub path rewrites feed from episode essay", again === feed);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log("feed self-check passed");
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/build-feed.mjs [--out <repo-root>] [--check] [--self-check]");
    process.exit(0);
  }
  if (args.selfCheck) selfCheck();
  if (!args.check && process.argv.includes("--self-check") && !process.argv.includes("--out")) return;

  const index = readIndex(args.out);
  const xml = renderFeedXml(index, (item) => essayZhFromDisk(args.out, item));
  const feedPath = path.join(args.out, "feed.xml");
  const rssPath = path.join(args.out, "rss.xml");
  if (args.check) {
    const feed = fs.existsSync(feedPath) ? fs.readFileSync(feedPath, "utf8") : "";
    const rss = fs.existsSync(rssPath) ? fs.readFileSync(rssPath, "utf8") : "";
    if (feed !== xml || rss !== xml) {
      console.error("feed.xml / rss.xml do not match data/index.json. Run: node scripts/build-feed.mjs");
      process.exit(1);
    }
    console.log("feed.xml matches data/index.json (" + sortNewest(index.items).length + " items)");
    return;
  }
  const stats = writeFeedFiles(args.out, index);
  console.log(
    "Wrote feed.xml / rss.xml       " +
      stats.items +
      " items, " +
      kb(stats.bytes) +
      (stats.capped ? " (capped at " + FEED_ITEM_CAP + ")" : "")
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
