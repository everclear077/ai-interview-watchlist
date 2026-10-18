#!/usr/bin/env bash
# Refresh data.json from the canonical watchlist store, then optionally commit+push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/data.json"
DST="$ROOT/data.json"

if [[ ! -f "$SRC" ]]; then
  echo "Source not found: $SRC" >&2
  echo "Run this where the store is mounted." >&2
  exit 1
fi

cp "$SRC" "$DST"
echo "Copied -> $DST"

if [[ "${1:-}" == "--push" ]]; then
  cd "$ROOT"
  git add data.json
  if git diff --cached --quiet; then
    echo "No data changes."
  else
    git commit -m "chore: refresh watchlist data"
    git push origin main
    echo "Pushed. Pages usually updates in 1–2 minutes."
  fi
fi
