#!/usr/bin/env bash
# Re-export experiment reps, regenerate classification manifest, optionally seed prod DB.
#
# Usage:
#   ./scripts/publish-experiment-runs.sh rtl-control [rtl-cleanup ...]
#   ./scripts/publish-experiment-runs.sh --exp1-rtl          # both exp1 arms
#   ./scripts/publish-experiment-runs.sh --exp1-rtl --seed   # + POST to hackathon API
#   npm run publish:runs -- --exp1-rtl                       # same (export + DB, --seed default)
#
# Env:
#   AGENTCOFOUNDER_ROOT          harness root (default: repo root)
#   RUNS_APP_ROOT                GreenCastle frontend repo (seed script lives here)
#   HACKATHON_ACCESS_CODE        required for --seed
#   HACKATHON_AUTHOR             default paul
#   HACKATHON_API_BASE           default https://admin.coretechs.se/hackathon
#   FRONTEND_BASE                default https://agentcofounder-hackathon.vercel.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTCOFOUNDER_ROOT="${AGENTCOFOUNDER_ROOT:-$ROOT}"
RUNS_APP_ROOT="${RUNS_APP_ROOT:-/mnt/c/Users/gronb/Desktop/GreenCastle/react/agentcofounder-hackathon}"
SEED_SCRIPT="$RUNS_APP_ROOT/scripts/seed_runs_from_artifacts.py"
BACKFILL_SCRIPT="$RUNS_APP_ROOT/scripts/backfill_classification.py"

SEED=0
ARMS=()

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --exp1-rtl) ARMS+=(rtl-control rtl-cleanup) ;;
    --exp2-stop) ARMS+=(stop-control stop-treatment) ;;
    --*) echo "Unknown flag: $arg" >&2; exit 2 ;;
    *) ARMS+=("$arg") ;;
  esac
done

if [ "${#ARMS[@]}" -eq 0 ]; then
  echo "Usage: $0 [--exp1-rtl] [--seed] <arm> [arm ...]" >&2
  exit 2
fi

RUN_IDS=()

for arm in "${ARMS[@]}"; do
  manifest="$ROOT/artifacts/experiments/$arm/manifest.json"
  if [ ! -f "$manifest" ]; then
    echo "Missing manifest: $manifest" >&2
    exit 1
  fi

  echo "==> Re-exporting arm: $arm"
  mapfile -t rep_lines < <(python3 -c "
import json, sys
for rep in json.load(open(sys.argv[1]))['reps']:
    print(f\"{rep['run_id']}\t{rep['rep']}\")
" "$manifest")

  for line in "${rep_lines[@]}"; do
    run_id="${line%%$'\t'*}"
    rep="${line#*$'\t'}"
    if [ -z "$run_id" ] || [ "$run_id" = "unknown" ]; then
      echo "  skip rep $rep (no run_id)" >&2
      continue
    fi
    label="${arm}-${rep}"
    echo "  export $run_id ($label)"
    npm run export:run -- "$run_id" --approach "$label" >/dev/null
    RUN_IDS+=("$run_id")
  done
done

echo "==> Regenerating runs-classification.json"
python3 "$ROOT/scripts/generate-runs-classification.py"

if [ "$SEED" -eq 0 ]; then
  echo "Done (local export + manifest). Re-run with --seed to POST to hackathon API."
  exit 0
fi

if [ -z "${HACKATHON_ACCESS_CODE:-}" ]; then
  echo "Set HACKATHON_ACCESS_CODE to seed prod DB" >&2
  exit 1
fi

if [ ! -f "$SEED_SCRIPT" ]; then
  echo "Seed script not found: $SEED_SCRIPT (set RUNS_APP_ROOT)" >&2
  exit 1
fi

ONLY="$(IFS=,; echo "${RUN_IDS[*]}")"
export AGENTCOFOUNDER_ROOT
export HACKATHON_AUTHOR="${HACKATHON_AUTHOR:-paul}"

echo "==> Seeding ${#RUN_IDS[@]} run(s) to API"
python3 "$SEED_SCRIPT" --only "$ONLY"

if [ -f "$BACKFILL_SCRIPT" ]; then
  echo "==> Backfilling classification labels"
  python3 "$BACKFILL_SCRIPT"
fi

echo "==> Resolving frontend links"
python3 "$ROOT/scripts/print-run-frontend-links.py" "${RUN_IDS[@]}"

echo "Publish complete."
