#!/usr/bin/env bash
# Lock the V2.2 baseline: 5 runs with harness-owned VERIFY (Control v2.1 + VERIFY v1.1).
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

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-phase-f-control-floor-v2.2}"
export RUN_ARM="${RUN_ARM:-control}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-control-floor-verify}"
export HARNESS_OWNED_VERIFY="${HARNESS_OWNED_VERIFY:-1}"

REPS="${1:-5}"
LOG_DIR="$REPO_ROOT/artifacts/baseline-lock-v2.2"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"

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

echo "V2.2 baseline lock (Control v2.1 + VERIFY) — experiment=$RUN_EXPERIMENT arm=$RUN_ARM intervention=$RUN_INTERVENTION reps=$REPS" | tee -a "$LOG_FILE"
npm run config:show | tee -a "$LOG_FILE"

for rep in $(seq 1 "$REPS"); do
  export RUN_REP="$rep"
  free_app_port
  echo "" | tee -a "$LOG_FILE"
  echo "=== rep $rep / $REPS ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ===" | tee -a "$LOG_FILE"
  if npm run challenge 2>&1 | tee -a "$LOG_FILE"; then
    echo "rep $rep: OK" | tee -a "$LOG_FILE"
  else
    echo "rep $rep: FAILED (exit $?)" | tee -a "$LOG_FILE"
    exit 1
  fi
  free_app_port
done

echo "" | tee -a "$LOG_FILE"
echo "Baseline lock complete. Log: $LOG_FILE" | tee -a "$LOG_FILE"
