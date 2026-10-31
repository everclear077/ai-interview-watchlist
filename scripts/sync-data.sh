#!/usr/bin/env bash
# Daily sync for the lean GitHub Pages site:
#   1. copy thumbs/ (+ bilibili-monitors.json) from the R store
#   2. run the splitter on R's monolith, or copy a pre-split data/ tree
# Never copy R's fat embedded index.html / index-midnight.html.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORE="/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists"
SRC_DATA="$STORE/data.json"
SRC_THUMBS="$STORE/thumbs"
SRC_MONITORS="$STORE/bilibili-monitors.json"
SRC_SPLIT_INDEX="$STORE/data/index.json"
SRC_SPLIT_EPS="$STORE/data/episodes"
DST_THUMBS="$ROOT/thumbs"

if [[ ! -d "$STORE" ]]; then
  echo "Source store not found: $STORE" >&2
  echo "Run this where the store is mounted." >&2
  exit 1
fi

if [[ -d "$SRC_THUMBS" ]]; then
  mkdir -p "$DST_THUMBS"
  rm -rf "${DST_THUMBS:?}/"*
  cp -a "$SRC_THUMBS"/. "$DST_THUMBS/"
  echo "Copied thumbs/ -> $DST_THUMBS ($(ls -1 "$DST_THUMBS" | wc -l) files)"
else
  echo "Warning: thumbs source missing: $SRC_THUMBS" >&2
fi

if [[ -f "$SRC_MONITORS" ]]; then
  cp "$SRC_MONITORS" "$ROOT/bilibili-monitors.json"
  echo "Copied -> $ROOT/bilibili-monitors.json"
fi

if [[ -f "$SRC_DATA" ]]; then
  node "$ROOT/scripts/split-data.mjs" "$SRC_DATA" --out "$ROOT"
elif [[ -f "$SRC_SPLIT_INDEX" && -d "$SRC_SPLIT_EPS" ]]; then
  rm -rf "$ROOT/data"
  mkdir -p "$ROOT/data/episodes"
  cp -a "$SRC_SPLIT_INDEX" "$ROOT/data/index.json"
  cp -a "$SRC_SPLIT_EPS"/. "$ROOT/data/episodes/"
  node "$ROOT/scripts/split-data.mjs" --stub-from-index "$ROOT/data/index.json" --out "$ROOT"
  echo "Copied pre-split tree -> $ROOT/data/"
else
  echo "Neither monolith data.json nor pre-split data/ in $STORE" >&2
  exit 1
fi

if [[ "${1:-}" == "--push" ]]; then
  cd "$ROOT"
  git add data.json data/ thumbs/ bilibili-monitors.json feed.xml rss.xml
  if git diff --cached --quiet; then
    echo "No data/thumbs changes."
  else
    git commit -m "chore: refresh watchlist data and thumbs"
    git push origin main
    echo "Pushed. Pages usually updates in 1–2 minutes."
  fi
fi
