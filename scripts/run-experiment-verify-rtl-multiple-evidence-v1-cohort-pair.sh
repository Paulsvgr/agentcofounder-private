#!/usr/bin/env bash
# Sequential control → treatment cohort for verify-rtl-multiple-evidence-v1.
# Prereg: docs/v2/control-floor/experiment-verify-rtl-multiple-evidence-v1-preregistration.md
# Do not change system prompt / skill during this cohort.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

REPS="${1:-5}"
LOG_DIR="$REPO_ROOT/artifacts/experiments"
mkdir -p "$LOG_DIR"
PAIR_LOG="$LOG_DIR/verify-rtl-multiple-evidence-v1-cohort-pair.log"

{
  echo "=== verify-rtl-multiple-evidence-v1 cohort pair start $(date -u +%Y-%m-%dT%H:%M:%SZ) reps=$REPS ==="
  echo "Arms: MULTIPLE_EVIDENCE=0 (control) then =1 (treatment); RTL_EVIDENCE=1 KEEP both; no Error Memory; no prompt edits"
  echo ""
  npm run experiment:verify-rtl-multiple-evidence-v1-control -- "$REPS"
  echo ""
  echo "=== control complete; starting treatment $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo ""
  npm run experiment:verify-rtl-multiple-evidence-v1-treatment -- "$REPS"
  echo ""
  echo "=== verify-rtl-multiple-evidence-v1 cohort pair complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} 2>&1 | tee "$PAIR_LOG"
