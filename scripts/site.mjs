/**
 * Public GitHub Pages origin for 长镜 · AI.
 * Episode pages are hash routes on this origin.
 */
export const SITE_ORIGIN = "https://everclear077.github.io/ai-interview-watchlist";
export const SITE_URL = SITE_ORIGIN + "/";
export const FEED_URL = SITE_ORIGIN + "/feed.xml";
export const RSS_URL = SITE_ORIGIN + "/rss.xml";

export function episodePageUrl(id, origin = SITE_ORIGIN) {
  const base = String(origin || SITE_ORIGIN).replace(/\/+$/, "");
  return base + "/#/ep/" + encodeURIComponent(String(id));
}
