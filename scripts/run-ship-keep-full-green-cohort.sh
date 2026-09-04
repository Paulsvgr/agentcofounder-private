#!/usr/bin/env bash
# Hackathon ship stack — natural bookshelf cohort (KEEP + FULL_GREEN).
# All REVERT / parked experiment flags OFF.
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

REPS="${1:-5}"
IDEA_FILE="${2:-$REPO_ROOT/contract-public/development-idea.txt}"

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-ship-keep-full-green-v1}"
export RUN_ARM="${RUN_ARM:-ship}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-ship-keep-full-green-v1}"

# KEEP / baseline stack
export HARNESS_OWNED_VERIFY=1
export HARNESS_ROOT_ERROR_FIRST_V1=1
export HARNESS_VERIFY_RTL_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=1
export HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_TAILWIND=1
export TEMPLATE_CSS_VOCABULARY=0

# Proven KEEP, default-on for this ship cohort
export HARNESS_FULL_GREEN_GATE_V1=1

# Explicit OFF — REVERT / parked / closed
export HARNESS_HARD_STOP_AFTER_GREEN_V1=0
export HARNESS_PRODUCT_QUALITY_CONTRACT_V1=0
export HARNESS_REPAIR_SURFACE_LOCK_V1=0
export HARNESS_PRE_GREEN_SINGLE_TEST_V1=0
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
unset HARNESS_SEEDED_FIXTURE_DIR

LOG_DIR="$REPO_ROOT/artifacts/experiments/ship-keep-full-green-v1"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"
FAILURES=0
RUN_IDS_FILE="$LOG_DIR/${STAMP}.run-ids.txt"
: > "$RUN_IDS_FILE"

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
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if command -v lsof >/dev/null 2>&1; then
      if ! lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
        break
      fi
    else
      break
    fi
    sleep 0.3
  done
  sleep 0.2
}

{
  echo "=== ship-keep-full-green-v1 start $(date -u +%Y-%m-%dT%H:%M:%SZ) reps=$REPS ==="
  echo "Stack: VERIFY + root-error-first + RTL evidence/MULTIPLE/text + TYPECHECK + persist + Tailwind + FULL_GREEN"
  echo "Idea: $IDEA_FILE"
  npm run config:show || true

  for rep in $(seq 1 "$REPS"); do
    export RUN_REP="$rep"
    free_app_port
    echo ""
    echo "=== ship rep $rep / $REPS $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    BEFORE="$(ls -1 "$REPO_ROOT/artifacts/runs" 2>/dev/null | sort | tail -1 || true)"
    if npm run challenge -- --idea-file "$IDEA_FILE"; then
      echo "rep $rep: OK"
    else
      echo "rep $rep: FAILED (exit $?)"
      FAILURES=$((FAILURES + 1))
    fi
    AFTER="$(ls -1 "$REPO_ROOT/artifacts/runs" 2>/dev/null | sort | tail -1 || true)"
    if [ -n "$AFTER" ] && [ "$AFTER" != "$BEFORE" ]; then
      echo "$AFTER" >> "$RUN_IDS_FILE"
      echo "run_id: $AFTER"
    elif [ -n "$AFTER" ]; then
      echo "$AFTER" >> "$RUN_IDS_FILE"
      echo "run_id (best-effort): $AFTER"
    fi
    free_app_port
  done

  echo ""
  if [ "$FAILURES" -eq 0 ]; then
    echo "=== ship-keep-full-green-v1 complete ($REPS/$REPS OK) $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  else
    OK_COUNT=$((REPS - FAILURES))
    echo "=== ship-keep-full-green-v1 complete ($OK_COUNT/$REPS OK, $FAILURES failed) $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  fi
  echo "Log: $LOG_FILE"
  echo "Run IDs: $RUN_IDS_FILE"
} 2>&1 | tee -a "$LOG_FILE"

exit "$FAILURES"
