#!/usr/bin/env bash
# One-run IGNORED_FACTS salience probe: Dune mid-spiral + PRESENT REPAIR footer.
# See docs/v2/control-floor/probe-ignored-facts-salience-v1.md
# Kill: next VERIFY still primary-fails on "Lend out" (or repair ignores lend assertion).
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

# KEEP / ship stack
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

# REVERT / parked OFF
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

# Causal probe change (default OFF elsewhere)
export HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1=1

export HARNESS_SEEDED_FIXTURE_DIR="fixtures/verify-test-context-dune-148k"
IDEA_FILE="$REPO_ROOT/fixtures/verify-test-context-dune-148k/repair-idea.txt"

export RUN_EXPERIMENT="ignored-facts-salience-probe-v1"
export RUN_ARM="treatment"
export RUN_INTERVENTION="verify-repair-present-hint-v1"
export RUN_REP="${RUN_REP:-1}"

LOG_DIR="$REPO_ROOT/artifacts/experiments/ignored-facts-salience-probe-v1"
mkdir -p "$LOG_DIR"
PROBE_LOG="$LOG_DIR/seeded-probe.log"

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

{
  echo "=== ignored-facts-salience-probe-v1 start $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "Fixture: mid-spiral 14-48-25 Dune Lend out / BUTTONS PRESENT"
  echo "Causal: HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1=1"
  echo "Kill: next VERIFY still primary-fails on Lend out"
  free_app_port
  npm run challenge -- --idea-file "$IDEA_FILE" || {
    echo "WARNING: probe exited non-zero (continuing to log)"
  }
  free_app_port
  echo "=== ignored-facts-salience-probe-v1 complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} 2>&1 | tee -a "$PROBE_LOG"
