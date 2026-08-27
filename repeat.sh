#!/usr/bin/env bash
# Run the same configuration N times so variance is visible.
# Usage: ./repeat.sh [n]   (default 3)
set -euo pipefail
N="${1:-3}"
docker build -q -t agentcofounder:base . >/dev/null
for i in $(seq 1 "$N"); do
  echo "═══ repeat $i/$N ═══"
  ./run.sh >/dev/null 2>&1 || true
done
node compare.js
