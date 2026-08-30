#!/usr/bin/env bash
# Lock the V2 baseline: 5 runs with default HarnessConfig and structured experiment metadata.
# Costs model tokens. Requires Pi/Berget credentials (see pi-agent/README.md).
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

export RUN_COHORT="${RUN_COHORT:-v2-baseline-lock}"
export RUN_ARM="${RUN_ARM:-control}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-baseline}"

REPS="${1:-5}"
LOG_DIR="$REPO_ROOT/artifacts/baseline-lock"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"

echo "V2 baseline lock — cohort=$RUN_COHORT arm=$RUN_ARM intervention=$RUN_INTERVENTION reps=$REPS" | tee -a "$LOG_FILE"
npm run config:show | tee -a "$LOG_FILE"

for rep in $(seq 1 "$REPS"); do
  export RUN_REP="$rep"
  echo "" | tee -a "$LOG_FILE"
  echo "=== rep $rep / $REPS ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ===" | tee -a "$LOG_FILE"
  if npm run challenge 2>&1 | tee -a "$LOG_FILE"; then
    echo "rep $rep: OK" | tee -a "$LOG_FILE"
  else
    echo "rep $rep: FAILED (exit $?)" | tee -a "$LOG_FILE"
    exit 1
  fi
done

echo "" | tee -a "$LOG_FILE"
echo "Baseline lock complete. Log: $LOG_FILE" | tee -a "$LOG_FILE"
