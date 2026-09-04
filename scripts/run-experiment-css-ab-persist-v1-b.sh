#!/usr/bin/env bash
# CSS A/B Arm B — CSS + persistence + root-error-first (comparator fill / rerun).
# Prefer reusing root-error-first-v1-1 successes; use this only to fill missing B reps.
# See docs/v2/control-floor/experiment-css-ab-persist-v1-preregistration.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-css-ab-persist-v1-b}"
export RUN_ARM="${RUN_ARM:-comparator}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-css-ab-persist-v1-b}"

export HARNESS_OWNED_VERIFY="${HARNESS_OWNED_VERIFY:-1}"
export HARNESS_ROOT_ERROR_FIRST_V1=1
export TEMPLATE_PERSISTENCE=1
export TEMPLATE_CSS_VOCABULARY=1

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

exec bash "$REPO_ROOT/scripts/run-experiment-root-error-first-v1.sh" "${1:-5}"
