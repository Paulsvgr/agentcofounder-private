#!/usr/bin/env bash
# Tailwind A/B Arm A′ — persistence + free CSS (TEMPLATE_TAILWIND=0). Prefer reusing css-ab-persist-v1-a.
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

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-tailwind-ab-persist-v1-a}"
export RUN_ARM="${RUN_ARM:-comparator}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-tailwind-ab-persist-v1-a}"

export HARNESS_OWNED_VERIFY="${HARNESS_OWNED_VERIFY:-1}"
export HARNESS_ROOT_ERROR_FIRST_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_CSS_VOCABULARY=0
export TEMPLATE_TAILWIND=0

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

exec bash "$REPO_ROOT/scripts/run-experiment-css-ab-persist-v1-a.sh" "${1:-5}"
