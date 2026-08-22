#!/usr/bin/env bash
# Export one run to JSON and publish to the hackathon runs DB.
#
# Usage:
#   ./scripts/publish-single-run.sh <run-id> [--approach rtl-control-1]
#   npm run publish:run -- 2026-08-22T11-17-34-089Z --approach rtl-control-1
#
# Env: HACKATHON_ACCESS_CODE, HACKATHON_AUTHOR, RUNS_APP_ROOT, FRONTEND_BASE (see publish-experiment-runs.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTCOFOUNDER_ROOT="${AGENTCOFOUNDER_ROOT:-$ROOT}"
RUNS_APP_ROOT="${RUNS_APP_ROOT:-/mnt/c/Users/gronb/Desktop/GreenCastle/react/agentcofounder-hackathon}"
SEED_SCRIPT="$RUNS_APP_ROOT/scripts/seed_runs_from_artifacts.py"
BACKFILL_SCRIPT="$RUNS_APP_ROOT/scripts/backfill_classification.py"

RUN_ID=""
APPROACH=""
NO_SEED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --approach)
      APPROACH="${2:-}"
      shift 2
      ;;
    --no-seed)
      NO_SEED=1
      shift
      ;;
    --*)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
    *)
      if [ -z "$RUN_ID" ]; then
        RUN_ID="$1"
      else
        echo "Unexpected argument: $1" >&2
        exit 2
      fi
      shift
      ;;
  esac
done

if [ -z "$RUN_ID" ]; then
  echo "Usage: $0 <run-id> [--approach <label>] [--no-seed]" >&2
  exit 2
fi

EXPORT_ARGS=(npm run export:run -- "$RUN_ID")
if [ -n "$APPROACH" ]; then
  EXPORT_ARGS+=(--approach "$APPROACH")
fi

echo "==> Export JSON for $RUN_ID${APPROACH:+ ($APPROACH)}"
(cd "$ROOT" && "${EXPORT_ARGS[@]}")

echo "==> Regenerating runs-classification.json"
python3 "$ROOT/scripts/generate-runs-classification.py"

if [ "$NO_SEED" -eq 1 ]; then
  echo "Done (export only). JSON: artifacts/exports/${RUN_ID}.json"
  exit 0
fi

if [ -z "${HACKATHON_ACCESS_CODE:-}" ]; then
  echo "Set HACKATHON_ACCESS_CODE to publish to prod DB (or pass --no-seed)" >&2
  exit 1
fi

if [ ! -f "$SEED_SCRIPT" ]; then
  echo "Seed script not found: $SEED_SCRIPT (set RUNS_APP_ROOT)" >&2
  exit 1
fi

export AGENTCOFOUNDER_ROOT
export HACKATHON_AUTHOR="${HACKATHON_AUTHOR:-paul}"

SEED_OK=1
echo "==> Seeding $RUN_ID to API"
if ! python3 "$SEED_SCRIPT" --only "$RUN_ID"; then
  SEED_OK=0
  echo "WARNING: seed failed — check HACKATHON_ACCESS_CODE (link below may still work if run is already on prod)" >&2
fi

if [ "$SEED_OK" -eq 1 ] && [ -f "$BACKFILL_SCRIPT" ]; then
  echo "==> Backfilling classification"
  python3 "$BACKFILL_SCRIPT"
fi

echo "==> Resolving frontend link"
python3 "$ROOT/scripts/print-run-frontend-links.py" "$RUN_ID" || true

if [ "$SEED_OK" -eq 0 ]; then
  exit 1
fi

echo "Published $RUN_ID → artifacts/exports/${RUN_ID}.json + DB"
