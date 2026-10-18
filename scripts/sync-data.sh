#!/usr/bin/env bash
# Refresh data.json and thumbs/ from the canonical watchlist store, then optionally commit+push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORE="/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists"
SRC_DATA="$STORE/data.json"
SRC_THUMBS="$STORE/thumbs"
DST_DATA="$ROOT/data.json"
DST_THUMBS="$ROOT/thumbs"

if [[ ! -f "$SRC_DATA" ]]; then
  echo "Source not found: $SRC_DATA" >&2
  echo "Run this where the store is mounted." >&2
  exit 1
fi

cp "$SRC_DATA" "$DST_DATA"
echo "Copied -> $DST_DATA"

if [[ -d "$SRC_THUMBS" ]]; then
  mkdir -p "$DST_THUMBS"
  # Replace thumbs contents to match store
  rm -rf "${DST_THUMBS:?}/"*
  cp -a "$SRC_THUMBS"/. "$DST_THUMBS/"
  echo "Copied thumbs/ -> $DST_THUMBS ($(ls -1 "$DST_THUMBS" | wc -l) files)"
else
  echo "Warning: thumbs source missing: $SRC_THUMBS" >&2
fi

if [[ "${1:-}" == "--push" ]]; then
  cd "$ROOT"
  git add data.json thumbs/
  if git diff --cached --quiet; then
    echo "No data/thumbs changes."
  else
    git commit -m "chore: refresh watchlist data and thumbs"
    git push origin main
    echo "Pushed. Pages usually updates in 1–2 minutes."
  fi
fi
