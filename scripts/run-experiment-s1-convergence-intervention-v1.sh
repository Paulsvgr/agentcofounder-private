#!/usr/bin/env bash
# Experiment S1 — Convergence intervention v1 — v2.2 OFF/OFF + post-VERIFY convergence redirect only.
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

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-s1-convergence-intervention-v1}"
export RUN_ARM="${RUN_ARM:-treatment}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-convergence-intervention-v1}"
export HARNESS_OWNED_VERIFY="${HARNESS_OWNED_VERIFY:-1}"
export HARNESS_VERIFY_REPAIR_V1="${HARNESS_VERIFY_REPAIR_V1:-0}"
export HARNESS_TEST_AUTHORING_GUARD_V1="${HARNESS_TEST_AUTHORING_GUARD_V1:-0}"
export HARNESS_EARLY_VERIFY_V1="${HARNESS_EARLY_VERIFY_V1:-0}"
export HARNESS_OWNED_TEST_STRUCTURE_V1="${HARNESS_OWNED_TEST_STRUCTURE_V1:-0}"
export HARNESS_CONVERGENCE_INTERVENTION_V1="${HARNESS_CONVERGENCE_INTERVENTION_V1:-1}"
export TEMPLATE_CSS_VOCABULARY="${TEMPLATE_CSS_VOCABULARY:-0}"
export TEMPLATE_PERSISTENCE="${TEMPLATE_PERSISTENCE:-0}"
export TEMPLATE_TEST_ISOLATION="${TEMPLATE_TEST_ISOLATION:-0}"

REPS="${1:-5}"
LOG_DIR="$REPO_ROOT/artifacts/experiments/s1-convergence-intervention-v1"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"
FAILURES=0

free_app_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -ti :3000 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
      # shellcheck disable=SC2086
      kill $PIDS >/dev/null 2>&1 || true
    fi
  fi
  sleep 0.5
}

echo "Experiment S1 (s1-convergence-intervention-v1) — experiment=$RUN_EXPERIMENT arm=$RUN_ARM intervention=$RUN_INTERVENTION reps=$REPS" | tee -a "$LOG_FILE"
npm run config:show | tee -a "$LOG_FILE"

for rep in $(seq 1 "$REPS"); do
  export RUN_REP="$rep"
  free_app_port
  echo "" | tee -a "$LOG_FILE"
  STAMP_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "=== rep $rep / $REPS ($STAMP_NOW) ===" | tee -a "$LOG_FILE"
  if npm run challenge 2>&1 | tee -a "$LOG_FILE"; then
    echo "rep $rep: OK" | tee -a "$LOG_FILE"
  else
    echo "rep $rep: FAILED (exit $?)" | tee -a "$LOG_FILE"
    FAILURES=$((FAILURES + 1))
  fi
  free_app_port
done

echo "" | tee -a "$LOG_FILE"
if [ "$FAILURES" -eq 0 ]; then
  echo "Experiment S1 complete ($REPS/$REPS OK). Log: $LOG_FILE" | tee -a "$LOG_FILE"
else
  OK_COUNT=$((REPS - FAILURES))
  echo "Experiment S1 complete ($OK_COUNT/$REPS OK, $FAILURES failed). Log: $LOG_FILE" | tee -a "$LOG_FILE"
  exit 1
fi
