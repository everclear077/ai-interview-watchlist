#!/usr/bin/env bash
# Push local site to everclear077/ai-interview-watchlist and ensure Pages.
# Prerequisite: public repo must already exist (API token cannot create it).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="everclear077/ai-interview-watchlist"
cd "$ROOT"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repo $REPO does not exist yet." >&2
  echo "Create it at: https://github.com/new?name=ai-interview-watchlist" >&2
  echo "Visibility: Public. Description: AI/tech interview watchlist" >&2
  echo "Then re-run: $0" >&2
  exit 1
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${REPO}.git"
git push -u origin main

# Try enable Pages from main/root (needs Administration/Pages write on token)
if gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  echo "Pages already configured."
else
  if gh api -X POST "repos/${REPO}/pages" -f build_type=legacy -f source[branch]=main -f source[path]=/ >/dev/null 2>&1 \
     || gh api -X POST "repos/${REPO}/pages" -f build_type=workflow >/dev/null 2>&1; then
    echo "Pages enabled."
  else
    echo "Could not enable Pages via API (token lacks Pages:write)." >&2
    echo "Enable manually: Settings → Pages → Deploy from branch main / (root)" >&2
    echo "  OR: Settings → Pages → Source: GitHub Actions (uses .github/workflows/pages.yml)" >&2
  fi
fi

URL="https://everclear077.github.io/ai-interview-watchlist/"
echo "Waiting for $URL ..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)
  echo "  try $i: HTTP $code"
  if [[ "$code" == "200" ]]; then
    echo "Live: $URL"
    exit 0
  fi
  sleep 15
done
echo "Not live yet; Pages can take 1–2 minutes. Check $URL later." >&2
exit 2
