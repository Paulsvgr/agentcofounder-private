#!/usr/bin/env bash
# Root-error-first VERIFY v1.1 — same CSS+persistence stack; broader import/module root patterns.
# No Error Memory, no verify-repair, no tsc, no new prompts/overlays.
set -euo pipefail

export RUN_EXPERIMENT="${RUN_EXPERIMENT:-root-error-first-v1-1}"
export RUN_ARM="${RUN_ARM:-treatment}"
export RUN_INTERVENTION="${RUN_INTERVENTION:-root-error-first-v1-1}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/run-experiment-root-error-first-v1.sh" "${1:-5}"
