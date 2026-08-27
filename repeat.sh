#!/usr/bin/env bash
# Run the same configuration N times so variance is visible.
# Usage: ./repeat.sh [n]   (default 3)
set -euo pipefail
N="${1:-3}"

if ! wsl -d Ubuntu -e true 2>/dev/null; then
  echo "WSL Ubuntu is not reachable." >&2
  exit 1
fi

before=$(ls runs 2>/dev/null | wc -l)
for i in $(seq 1 "$N"); do
  echo "═══ repeat $i/$N ═══"
  ./wrun.sh >/dev/null 2>&1 || true
done
after=$(ls runs 2>/dev/null | wc -l)
if [ "$after" -eq "$before" ]; then
  echo "No run produced a result -- check provider quota and WSL." >&2
  exit 1
fi

node compare.js
