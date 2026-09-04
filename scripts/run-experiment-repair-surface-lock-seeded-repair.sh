#!/usr/bin/env bash
# Repair-surface-lock v1 seeded 1+1: fail-first fixture; flag OFF vs ON.
# See docs/v2/control-floor/experiment-repair-surface-lock-v1-preregistration.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f "$HOME/.pi/agent/challenge-env-zai.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.pi/agent/challenge-env-zai.sh"
elif [ -f "$HOME/.pi/agent/challenge-env.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.pi/agent/challenge-env.sh"
elif [ -f "$REPO_ROOT/pi-agent/challenge-env.sh" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/pi-agent/challenge-env.sh"
fi

ARM="${1:-both}"
REPS="${2:-1}"

export HARNESS_OWNED_VERIFY=1
export HARNESS_ROOT_ERROR_FIRST_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_TAILWIND=1
export TEMPLATE_CSS_VOCABULARY=0
export HARNESS_VERIFY_RTL_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=1
export HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1=1
export HARNESS_HARD_STOP_AFTER_GREEN_V1=0
export HARNESS_FULL_GREEN_GATE_V1=0
export HARNESS_PRODUCT_QUALITY_CONTRACT_V1=0
export HARNESS_ERROR_MEMORY_V1=0
export HARNESS_VERIFY_REPAIR_V1=0
export HARNESS_TAIL_SWEEP_V1=0
export HARNESS_TEST_AUTHORING_GUARD_V1=0
export HARNESS_EARLY_VERIFY_V1=0
export HARNESS_OWNED_TEST_STRUCTURE_V1=0
export HARNESS_CONVERGENCE_INTERVENTION_V1=0
export HARNESS_SCOPE_SEQUENCE_V1=0
export HARNESS_SCOPE_SEQUENCE_V2=0
export HARNESS_SCOPE_SEQUENCE_V2B=0
export TEMPLATE_TEST_ISOLATION=0

export HARNESS_SEEDED_FIXTURE_DIR="fixtures/repair-surface-lock-143k-postfail"
IDEA_FILE="$REPO_ROOT/fixtures/repair-surface-lock-143k-postfail/repair-idea.txt"

LOG_DIR="$REPO_ROOT/artifacts/experiments/repair-surface-lock-v1"
mkdir -p "$LOG_DIR"
PAIR_LOG="$LOG_DIR/seeded-repair-pair.log"

free_app_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
      # shellcheck disable=SC2086
      kill $PIDS >/dev/null 2>&1 || true
      sleep 0.3
      # shellcheck disable=SC2086
      kill -9 $PIDS >/dev/null 2>&1 || true
    fi
  fi
}

run_arm() {
  local flag="$1"
  local exp_id="$2"
  local arm_name="$3"
  export HARNESS_REPAIR_SURFACE_LOCK_V1="$flag"
  export RUN_EXPERIMENT="$exp_id"
  export RUN_ARM="$arm_name"
  export RUN_INTERVENTION="repair-surface-lock-v1"
  for rep in $(seq 1 "$REPS"); do
    export RUN_REP="$rep"
    free_app_port
    echo "=== repair-surface-lock $arm_name LOCK=$flag rep $rep / $REPS $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    npm run challenge -- --idea-file "$IDEA_FILE" || {
      echo "WARNING: repair-surface-lock $arm_name rep $rep exited non-zero (continuing)"
    }
    free_app_port
  done
}

{
  echo "=== repair-surface-lock-v1 seeded start $(date -u +%Y-%m-%dT%H:%M:%SZ) arm=$ARM reps=$REPS ==="
  echo "Fixture: 143k post-FAIL bait (pre-FAIL snapshot from 2026-09-04T12-51-52-540Z)"
  echo "Historical expansion: mv src/lib/books.ts → src/books.ts after FAIL"
  echo "FULL_GREEN=0 HARD_STOP=0. KEEP stack ON. Measure FAIL→PASS; watch block-thrash."
  if [ "$ARM" = "control" ] || [ "$ARM" = "both" ]; then
    run_arm 0 "repair-surface-lock-v1-control" "control"
  fi
  if [ "$ARM" = "treatment" ] || [ "$ARM" = "both" ]; then
    run_arm 1 "repair-surface-lock-v1-treatment" "treatment"
  fi
  echo "=== repair-surface-lock-v1 seeded complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} 2>&1 | tee -a "$PAIR_LOG"
