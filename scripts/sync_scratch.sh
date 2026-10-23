#!/usr/bin/env bash
# Developer helper (not used in production): copy the built demo into a working folder for local browser tests.
set -e
OUT=${1:?usage: scripts/sync_scratch.sh <folder>}
python3 "$(dirname "$0")/../app/build.py" >/dev/null
cp "$(dirname "$0")/../dist/performance-lab.html" "$OUT/performance-lab.html"
printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' > "$OUT/test.html"
cat "$OUT/performance-lab.html" >> "$OUT/test.html"; echo '</body></html>' >> "$OUT/test.html"
cp "$(dirname "$0")/../app/assets/"*.txt "$OUT/"
