#!/usr/bin/env bash
# Assert Phase F changes did not touch audited result machinery.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_SHA="${1:?Usage: ./scripts/check-compliance.sh <BASE_SHA> [result.json]}"

cd "$ROOT"

SACRED_PATHS=(
  "src/usage.ts"
  "src/result.ts"
  "src/validate-result.ts"
  "src/verify-app.ts"
  "src/run-challenge.ts"
  "src/port-owner.ts"
  "src/prepare-output.ts"
  "src/types.ts"
  "contract-public/result.schema.json"
  "solution/extensions/protected-paths.ts"
)

CHANGED=$(git diff --name-only "$BASE_SHA" HEAD || true)
VIOLATIONS=()
for sacred in "${SACRED_PATHS[@]}"; do
  if echo "$CHANGED" | grep -qx "$sacred"; then
    VIOLATIONS+=("$sacred")
  fi
done

if ((${#VIOLATIONS[@]} > 0)); then
  echo "COMPLIANCE FAIL: sacred paths modified since $BASE_SHA:" >&2
  printf '  - %s\n' "${VIOLATIONS[@]}" >&2
  exit 1
fi

RESULT_FILE="${2:-$ROOT/result.json}"
if [[ -f "$RESULT_FILE" ]]; then
  TELEM=$(node --input-type=module -e "
    const r = JSON.parse(await import('node:fs/promises').then(m => m.readFile('$RESULT_FILE','utf8')));
    console.log(r.telemetry_source ?? '');
  ")
  if [[ "$TELEM" != "pi-json-event-stream" ]]; then
    echo "COMPLIANCE FAIL: telemetry_source=$TELEM (expected pi-json-event-stream)" >&2
    exit 1
  fi
  npm run validate:result -- "$RESULT_FILE" >/dev/null
fi

echo "COMPLIANCE OK: no sacred path changes since $BASE_SHA"
