#!/usr/bin/env bash
# Hard-stop-after-green seeded 1+1: already-green app; flag OFF vs ON.
# See docs/v2/control-floor/experiment-hard-stop-after-green-v1-preregistration.md
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
export HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1=1
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

export HARNESS_SEEDED_FIXTURE_DIR="fixtures/hard-stop-after-green-seeded"
IDEA_FILE="$REPO_ROOT/fixtures/hard-stop-after-green-seeded/repair-idea.txt"

LOG_DIR="$REPO_ROOT/artifacts/experiments/hard-stop-after-green-seeded"
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
  local hardstop="$1"
  local exp_id="$2"
  local arm_name="$3"
  export HARNESS_HARD_STOP_AFTER_GREEN_V1="$hardstop"
  export RUN_EXPERIMENT="$exp_id"
  export RUN_ARM="$arm_name"
  export RUN_INTERVENTION="hard-stop-after-green-v1"
  for rep in $(seq 1 "$REPS"); do
    export RUN_REP="$rep"
    free_app_port
    echo "=== hard-stop $arm_name HARD_STOP=$hardstop rep $rep / $REPS $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    npm run challenge -- --idea-file "$IDEA_FILE" || {
      echo "WARNING: hard-stop $arm_name rep $rep exited non-zero (continuing)"
    }
    free_app_port
  done
}

{
  echo "=== hard-stop-after-green seeded start $(date -u +%Y-%m-%dT%H:%M:%SZ) arm=$ARM reps=$REPS ==="
  echo "Fixture: already-green bookshelf | arms differ ONLY on HARNESS_HARD_STOP_AFTER_GREEN_V1"
  echo "TAIL_SWEEP=0 (orthogonal). TYPECHECK KEEP remains ON."
  if [ "$ARM" = "control" ] || [ "$ARM" = "both" ]; then
    run_arm 0 "hard-stop-after-green-seeded-control" "control"
  fi
  if [ "$ARM" = "treatment" ] || [ "$ARM" = "both" ]; then
    run_arm 1 "hard-stop-after-green-seeded-treatment" "treatment"
  fi
  echo "=== hard-stop-after-green seeded complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} 2>&1 | tee -a "$PAIR_LOG"
