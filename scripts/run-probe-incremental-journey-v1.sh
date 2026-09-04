#!/usr/bin/env bash
# One-run probe: ship KEEP stack + single AGENTS one-liner (no hard gate).
# Procedure: Write one journey it, run VERIFY, fix until green, then write the next journey.
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

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-incremental-journey-probe-v1}"
export RUN_ARM="${RUN_ARM:-probe}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-incremental-journey-one-line}"
export RUN_REP="${RUN_REP:-1}"

# Ship KEEP stack
export HARNESS_OWNED_VERIFY=1
export HARNESS_ROOT_ERROR_FIRST_V1=1
export HARNESS_VERIFY_RTL_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1
export HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=1
export HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_TAILWIND=1
export TEMPLATE_CSS_VOCABULARY=0
export HARNESS_FULL_GREEN_GATE_V1=1

# Explicit OFF
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

# Prompt-only procedure (no gate)
export HARNESS_AGENTS_APPEND_FILE="$REPO_ROOT/probes/incremental-journey-one-line.md"

IDEA_FILE="${1:-$REPO_ROOT/contract-public/development-idea.txt}"
LOG_DIR="$REPO_ROOT/artifacts/experiments/incremental-journey-probe-v1"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="$LOG_DIR/${STAMP}.log"

free_app_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
      # shellcheck disable=SC2086
      kill $PIDS >/dev/null 2>&1 || true
    fi
  fi
  sleep 0.3
}

{
  echo "=== incremental-journey-probe-v1 ONE RUN $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "Procedure: Write one journey it, run VERIFY, fix until green, then write the next journey."
  echo "No hard gate. Ship KEEP stack + AGENTS append only."
  echo "Idea: $IDEA_FILE"
  npm run config:show || true
  free_app_port
  BEFORE="$(ls -1 "$REPO_ROOT/artifacts/runs" 2>/dev/null | sort | tail -1 || true)"
  if npm run challenge -- --idea-file "$IDEA_FILE"; then
    echo "probe: OK"
    EXIT=0
  else
    echo "probe: FAILED (exit $?)"
    EXIT=1
  fi
  AFTER="$(ls -1 "$REPO_ROOT/artifacts/runs" 2>/dev/null | sort | tail -1 || true)"
  if [ -n "$AFTER" ] && [ "$AFTER" != "$BEFORE" ]; then
    echo "run_id: $AFTER"
    echo "$AFTER" > "$LOG_DIR/${STAMP}.run-id.txt"
  fi
  free_app_port
  echo "Log: $LOG_FILE"
  exit "$EXIT"
} 2>&1 | tee -a "$LOG_FILE"
