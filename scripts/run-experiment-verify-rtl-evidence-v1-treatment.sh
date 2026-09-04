#!/usr/bin/env bash
# verify-rtl-evidence-v1 TREATMENT — relevance-preserving role/name VERIFY MESSAGE.
# Same default stack as control; only HARNESS_VERIFY_RTL_EVIDENCE_V1=1 differs.
# See docs/v2/control-floor/experiment-verify-rtl-evidence-v1-preregistration.md
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

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-verify-rtl-evidence-v1-treatment}"
export RUN_ARM="${RUN_ARM:-treatment}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-verify-rtl-evidence-v1}"

export HARNESS_OWNED_VERIFY="${HARNESS_OWNED_VERIFY:-1}"
export HARNESS_ROOT_ERROR_FIRST_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_CSS_VOCABULARY=0
export TEMPLATE_TAILWIND=1
export HARNESS_VERIFY_RTL_EVIDENCE_V1=1

export HARNESS_ERROR_MEMORY_V1=0
export HARNESS_TAIL_SWEEP_V1=0
export HARNESS_VERIFY_REPAIR_V1=0
export HARNESS_TEST_AUTHORING_GUARD_V1=0
export HARNESS_EARLY_VERIFY_V1=0
export HARNESS_OWNED_TEST_STRUCTURE_V1=0
export HARNESS_CONVERGENCE_INTERVENTION_V1=0
export HARNESS_SCOPE_SEQUENCE_V1=0
export HARNESS_SCOPE_SEQUENCE_V2=0
export HARNESS_SCOPE_SEQUENCE_V2B=0
export TEMPLATE_TEST_ISOLATION=0

REPS="${1:-5}"
LOG_DIR="$REPO_ROOT/artifacts/experiments/${RUN_EXPERIMENT}"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"
FAILURES=0

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

echo "verify-rtl-evidence-v1-treatment — experiment=$RUN_EXPERIMENT arm=$RUN_ARM intervention=$RUN_INTERVENTION reps=$REPS" | tee -a "$LOG_FILE"
echo "Treatment: PERSISTENCE=1 TAILWIND=1 ROOT_ERROR_FIRST=1 RTL_EVIDENCE=1 (relevance-preserving)" | tee -a "$LOG_FILE"
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
  echo "verify-rtl-evidence-v1-treatment complete ($REPS/$REPS OK). Log: $LOG_FILE" | tee -a "$LOG_FILE"
else
  OK_COUNT=$((REPS - FAILURES))
  echo "verify-rtl-evidence-v1-treatment complete ($OK_COUNT/$REPS OK, $FAILURES failed). Log: $LOG_FILE" | tee -a "$LOG_FILE"
  exit 1
fi
