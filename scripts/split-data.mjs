#!/usr/bin/env node
/**
 * Split R's monolithic watchlist data.json into the published modular tree:
 *
 *   data/index.json              slim catalog for the list page
 *   data/episodes/<id>.json      one detail file per episode
 *   data.json                    tiny stub (does not ship the monolith)
 *   feed.xml, rss.xml           RSS 2.0 feed (identical files)
 *
 * Usage:
 *   node scripts/split-data.mjs [monolith.json] [--out <repo-root>]
 *
 * Defaults: input is argv, $DATA_JSON, the R store monolith if mounted,
 * or ./data.json when that file still has items[]. Idempotent for the
 * same monolith: episode files are rewritten from scratch.
 *
 * Strips coverDataUri. Does not invent essay/analysis/transcript text.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFeedFiles } from "./build-feed.mjs";

const require = createRequire(import.meta.url);
const WL = require("../media.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const STORE_MONOLITH =
  "/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/data.json";

const INDEX_KEYS = [
  "id",
  "title",
  "guest",
  "show",
  "date",
  "duration",
  "category",
  "priority",
  "summary",
  "advice",
  "urls",
  "addedAt",
  "cover",
  "media"
];

export function flagsOf(it) {
  return {
    hasEssay: WL.hasEssay(it),
    hasAnalysis: WL.hasAnalysis(it),
    hasTranscript: WL.hasTranscript(it)
  };
}

export function slimItem(it) {
  const flags = flagsOf(it);
  const out = {};
  for (const key of INDEX_KEYS) {
    if (it[key] !== undefined) out[key] = it[key];
  }
  out.hasEssay = flags.hasEssay;
  out.hasAnalysis = flags.hasAnalysis;
  out.hasTranscript = flags.hasTranscript;
  return out;
}

export function episodeRecord(it) {
  const flags = flagsOf(it);
  const out = slimItem(it);
  if (flags.hasEssay && it.essay) out.essay = it.essay;
  if (flags.hasAnalysis && it.analysis) out.analysis = it.analysis;
  if (flags.hasTranscript && it.transcript) out.transcript = it.transcript;
  if (Array.isArray(it.evidence) && it.evidence.length) out.evidence = it.evidence;
  return out;
}

export function safeEpisodeId(id) {
  const s = String(id || "");
  if (!/^[A-Za-z0-9._-]+$/.test(s)) {
    throw new Error("unsafe episode id (refusing path-like name): " + id);
  }
  return s;
}

export function isMonolith(data) {
  return !!(data && Array.isArray(data.items) && data.items.length > 0 && !data.deprecated);
}

export function buildIndex(data, items) {
  const out = {
    version: data.version != null ? data.version : 1,
    dataLayout: "index+episodes",
    title: data.title || "",
    lastUpdated: data.lastUpdated || "",
    categories: data.categories || [],
    priorities: data.priorities || [],
    items
  };
  if (data.maintainer) out.maintainer = data.maintainer;
  if (data.notes) out.notes = data.notes;
  return out;
}

export function buildStub(data) {
  return {
    version: data.version != null ? data.version : 1,
    deprecated: true,
    dataLayout: "index+episodes",
    title: data.title || "",
    lastUpdated: data.lastUpdated || "",
    message:
      "Root data.json is no longer the published catalog (the monolith is not served on Pages). List: data/index.json. Episode: data/episodes/<id>.json. Rebuild with: node scripts/split-data.mjs <R-monolith.json>",
    index: "./data/index.json",
    episodePattern: "./data/episodes/<id>.json",
    items: []
  };
}

function parseArgs(argv) {
  const args = { input: "", out: DEFAULT_ROOT, stubFromIndex: "" };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out") {
      args.out = path.resolve(rest[++i] || "");
      continue;
    }
    if (rest[i] === "--stub-from-index") {
      args.stubFromIndex = path.resolve(rest[++i] || "");
      continue;
    }
    if (rest[i] === "--help" || rest[i] === "-h") {
      args.help = true;
      continue;
    }
    if (!args.input && !rest[i].startsWith("-")) args.input = rest[i];
  }
  return args;
}

function resolveInput(explicit) {
  const candidates = [
    explicit,
    process.env.DATA_JSON,
    STORE_MONOLITH,
    path.join(DEFAULT_ROOT, "data.json")
  ].filter(Boolean);
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (isMonolith(data)) return { path: p, data };
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

function kb(n) {
  return (n / 1024).toFixed(1) + " KB";
}

export function splitMonolith(data, outRoot) {
  if (!isMonolith(data)) {
    throw new Error("input is not a watchlist monolith (missing items[])");
  }
  const dataDir = path.join(outRoot, "data");
  const episodesDir = path.join(dataDir, "episodes");
  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(episodesDir)) {
    for (const name of fs.readdirSync(episodesDir)) {
      if (name.endsWith(".json")) fs.unlinkSync(path.join(episodesDir, name));
    }
  } else {
    fs.mkdirSync(episodesDir, { recursive: true });
  }

  const slimItems = [];
  let strippedUri = 0;
  let largest = { id: "", bytes: 0 };
  for (const it of data.items) {
    if (!it || !it.id) {
      console.warn("skip item without id");
      continue;
    }
    const id = safeEpisodeId(it.id);
    if (it.coverDataUri) strippedUri += 1;
    const slim = slimItem(it);
    const detail = episodeRecord(it);
    const body = JSON.stringify(detail) + "\n";
    const bytes = Buffer.byteLength(body);
    fs.writeFileSync(path.join(episodesDir, id + ".json"), body);
    slimItems.push(slim);
    if (bytes > largest.bytes) largest = { id, bytes };
  }

  const index = buildIndex(data, slimItems);
  const stub = buildStub(data);
  const indexBody = JSON.stringify(index, null, 2) + "\n";
  const stubBody = JSON.stringify(stub, null, 2) + "\n";
  fs.writeFileSync(path.join(dataDir, "index.json"), indexBody);
  fs.writeFileSync(path.join(outRoot, "data.json"), stubBody);
  const feed = writeFeedFiles(outRoot, index);

  return {
    items: slimItems.length,
    indexBytes: Buffer.byteLength(indexBody),
    stubBytes: Buffer.byteLength(stubBody),
    strippedUri,
    largest,
    essays: slimItems.filter((x) => x.hasEssay).length,
    analyses: slimItems.filter((x) => x.hasAnalysis).length,
    transcripts: slimItems.filter((x) => x.hasTranscript).length,
    feed
  };
}

function writeStubFromIndex(indexPath, outRoot) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const stub = buildStub(index);
  fs.writeFileSync(path.join(outRoot, "data.json"), JSON.stringify(stub, null, 2) + "\n");
  const feed = writeFeedFiles(outRoot, index);
  console.log("Wrote feed.xml / rss.xml       " + feed.items + " items");
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/split-data.mjs [monolith.json] [--out <repo-root>]");
    console.log("       node scripts/split-data.mjs --stub-from-index data/index.json [--out <repo-root>]");
    process.exit(0);
  }
  if (args.stubFromIndex) {
    writeStubFromIndex(args.stubFromIndex, args.out);
    console.log("Wrote data.json stub from " + args.stubFromIndex);
    return;
  }
  const resolved = resolveInput(args.input ? path.resolve(args.input) : "");
  if (!resolved) {
    console.error(
      "No monolith found. Pass R's data.json:\n  node scripts/split-data.mjs /path/to/data.json"
    );
    process.exit(1);
  }
  const stats = splitMonolith(resolved.data, args.out);
  console.log("Read  " + resolved.path);
  console.log("Wrote data/index.json           " + kb(stats.indexBytes));
  console.log("Wrote data.json (stub)          " + kb(stats.stubBytes));
  console.log(
    "Wrote data/episodes/*.json     " +
      stats.items +
      " files (largest " +
      stats.largest.id +
      " " +
      kb(stats.largest.bytes) +
      ")"
  );
  console.log(
    "Flags  essay=" +
      stats.essays +
      " analysis=" +
      stats.analyses +
      " transcript=" +
      stats.transcripts
  );
  console.log("Stripped coverDataUri from " + stats.strippedUri + " items");
  if (stats.feed) {
    console.log(
      "Wrote feed.xml / rss.xml       " +
        stats.feed.items +
        " items" +
        (stats.feed.capped ? " (capped)" : "")
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
