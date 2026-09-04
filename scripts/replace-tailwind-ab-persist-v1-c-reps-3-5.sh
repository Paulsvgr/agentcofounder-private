#!/usr/bin/env bash
# Replace failed tailwind-ab-persist-v1-c reps 3-5 after provider balance fix.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f "$HOME/.pi/agent/challenge-env-zai.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.pi/agent/challenge-env-zai.sh"
elif [ -f "$HOME/.pi/agent/challenge-env.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.pi/agent/challenge-env.sh"
fi

export RUN_EXPERIMENT=tailwind-ab-persist-v1-c
export RUN_ARM=treatment
export RUN_INTERVENTION=tailwind-ab-persist-v1-c
export HARNESS_OWNED_VERIFY=1
export HARNESS_ROOT_ERROR_FIRST_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_CSS_VOCABULARY=0
export TEMPLATE_TAILWIND=1
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

LOG_DIR="$REPO_ROOT/artifacts/experiments/tailwind-ab-persist-v1-c"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/replacement-after-balance-$(date -u +%Y-%m-%dT%H-%M-%SZ).log"
FAILURES=0

free_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
  fi
  sleep 0.5
}

echo "Arm C replacements after balance fix — reps 3 4 5" | tee "$LOG"

for rep in 3 4 5; do
  export RUN_REP="$rep"
  free_port
  echo "" | tee -a "$LOG"
  echo "=== replacement rep $rep ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ===" | tee -a "$LOG"
  if npm run challenge 2>&1 | tee -a "$LOG"; then
    echo "rep $rep: OK" | tee -a "$LOG"
  else
    echo "rep $rep: FAILED (exit $?)" | tee -a "$LOG"
    FAILURES=$((FAILURES + 1))
  fi
  free_port
done

echo "" | tee -a "$LOG"
echo "replacements finished failures=$FAILURES log=$LOG" | tee -a "$LOG"
exit "$FAILURES"
