/**
 * Read-only access to the public 长镜 · AI catalog.
 * Data is fetched over HTTP. Episode page links always point at the site.
 */
import { createRequire } from "node:module";
import { SITE_ORIGIN, episodePageUrl } from "../scripts/site.mjs";
import { sortNewest } from "../scripts/build-feed.mjs";

const require = createRequire(import.meta.url);
const WL = require("../media.js");

export const USER_AGENT = "long-lens-ai-mcp/1.0 (+https://everclear077.github.io/ai-interview-watchlist/)";
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export class CatalogError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CatalogError";
    this.status = status;
  }
}

export function siteOrigin() {
  return String(process.env.LONG_LENS_SITE_ORIGIN || SITE_ORIGIN).replace(/\/+$/, "");
}

export function dataBase() {
  return String(process.env.LONG_LENS_BASE_URL || SITE_ORIGIN).replace(/\/+$/, "");
}

export function clearCatalogCache() {
  cache.clear();
}

async function fetchJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  let res;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CatalogError("Could not reach the catalog at " + url + ": " + message);
  }
  if (!res.ok) throw new CatalogError("HTTP " + res.status + " for " + url, res.status);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

async function loadIndex() {
  const url = dataBase() + "/data/index.json";
  const index = await fetchJson(url);
  if (!index || !Array.isArray(index.items)) {
    throw new CatalogError("Catalog index has no items array: " + url);
  }
  return index;
}

function queryMatch(item, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const blob = [item.title, item.guest, item.show, item.summary, item.id].join("\n").toLowerCase();
  return blob.indexOf(q) !== -1;
}

function showMatch(item, show) {
  const raw = String(show || "").trim();
  if (!raw) return true;
  if (WL.showSlug(item.show) === WL.showSlug(raw)) return true;
  const needle = raw.toLowerCase();
  return String(item.show || "").trim().toLowerCase() === needle
    || String(WL.showDisplay(item.show) || "").trim().toLowerCase() === needle;
}

function topicMatch(item, topic) {
  const raw = String(topic || "").trim();
  if (!raw) return true;
  if (WL.topicSlug(item.category) === WL.topicSlug(raw)) return true;
  return String(item.category || "").trim().toLowerCase() === raw.toLowerCase();
}

function flagMatch(item, key, expected) {
  if (expected == null) return true;
  const has = key === "essay" ? WL.hasEssay(item) : key === "analysis" ? WL.hasAnalysis(item) : WL.hasTranscript(item);
  return has === expected;
}

export function filterEpisodes(items, filters) {
  const f = filters || {};
  return sortNewest(items).filter((item) => {
    if (!queryMatch(item, f.query)) return false;
    if (!showMatch(item, f.show)) return false;
    if (!topicMatch(item, f.topic)) return false;
    if (!topicMatch(item, f.category)) return false;
    if (!flagMatch(item, "essay", f.hasEssay)) return false;
    if (!flagMatch(item, "analysis", f.hasAnalysis)) return false;
    if (!flagMatch(item, "transcript", f.hasTranscript)) return false;
    return true;
  });
}

function publicItem(item, origin) {
  const out = Object.assign({}, item);
  delete out.coverDataUri;
  out.pageUrl = episodePageUrl(item.id, origin);
  return out;
}

export async function listEpisodes(filters) {
  const index = await loadIndex();
  const matched = filterEpisodes(index.items, filters);
  const limit = filters && filters.limit != null ? filters.limit : 20;
  const slice = matched.slice(0, limit);
  const origin = siteOrigin();
  return {
    siteUrl: origin + "/",
    total: matched.length,
    returned: slice.length,
    limit,
    items: slice.map((item) => publicItem(item, origin))
  };
}

export async function getEpisode(id) {
  const safe = String(id || "");
  if (!/^[A-Za-z0-9._-]+$/.test(safe)) throw new CatalogError("Invalid episode id");
  const sourceUrl = dataBase() + "/data/episodes/" + encodeURIComponent(safe) + ".json";
  let episode;
  try {
    episode = await fetchJson(sourceUrl);
  } catch (err) {
    if (err instanceof CatalogError && err.status === 404) {
      throw new CatalogError('No published episode with id "' + safe + '".');
    }
    throw err;
  }
  if (episode && typeof episode === "object") delete episode.coverDataUri;
  return {
    id: safe,
    pageUrl: episodePageUrl(safe, siteOrigin()),
    sourceUrl,
    episode
  };
}

export async function siteInfo() {
  const index = await loadIndex();
  const items = index.items;
  const origin = siteOrigin();
  return {
    title: index.title || "",
    brand: { zh: "长镜 · AI", en: "Long Lens AI" },
    siteUrl: origin + "/",
    feedUrl: origin + "/feed.xml",
    rssUrl: origin + "/rss.xml",
    catalogUrl: dataBase() + "/data/index.json",
    lastUpdated: index.lastUpdated || "",
    counts: {
      episodes: items.length,
      hasEssay: items.filter((it) => WL.hasEssay(it)).length,
      hasAnalysis: items.filter((it) => WL.hasAnalysis(it)).length,
      hasTranscript: items.filter((it) => WL.hasTranscript(it)).length
    },
    categories: index.categories || [],
    readOnly: true
  };
}
