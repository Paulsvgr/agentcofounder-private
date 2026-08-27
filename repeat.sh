#!/usr/bin/env bash
# Run the same configuration N times so variance is visible.
# Usage: ./repeat.sh [n]   (default 3)
set -euo pipefail
N="${1:-3}"

# A stopped daemon otherwise looks like N instant no-op runs.
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable -- start Docker Desktop first." >&2
  exit 1
fi
docker build -q -t agentcofounder:base . >/dev/null

before=$(ls runs 2>/dev/null | wc -l)
for i in $(seq 1 "$N"); do
  echo "═══ repeat $i/$N ═══"
  ./run.sh >/dev/null 2>&1 || true
done
after=$(ls runs 2>/dev/null | wc -l)
if [ "$after" -eq "$before" ]; then
  echo "No run produced a result -- check provider quota and the daemon." >&2
  exit 1
fi
node compare.js
