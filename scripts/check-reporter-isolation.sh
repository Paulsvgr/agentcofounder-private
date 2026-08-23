#!/usr/bin/env bash
# Go/no-go gate: compact reporter must not leak into harness JSON audit path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

cp -a "$ROOT/app-template/." "$SCRATCH/"

cat > "$SCRATCH/src/isolation-fail.test.ts" <<'EOF'
import { describe, expect, it } from "vitest";

describe("isolation probe", () => {
  it("fails deliberately for reporter smoke test", () => {
    expect(1).toBe(2);
  });
});
EOF

cd "$SCRATCH"
npm install --silent >/dev/null 2>&1

MODEL_OUT="$(npm test 2>&1 || true)"
MARKER_COUNT="$(printf '%s' "$MODEL_OUT" | grep -c '^FAILURES [0-9]\+$' || true)"
if [ "$MARKER_COUNT" -ne 1 ]; then
  echo "FAIL: expected exactly one FAILURES marker from npm test, got $MARKER_COUNT" >&2
  exit 1
fi
if printf '%s' "$MODEL_OUT" | grep -q 'Test Files.*failed'; then
  echo "FAIL: default Vitest reporter output leaked alongside compact reporter" >&2
  exit 1
fi

JSON_OUT="$SCRATCH/audit.json"
AUDIT_STDOUT="$(npx vitest run --reporter=json --outputFile="$JSON_OUT" 2>&1 || true)"
if [ ! -f "$JSON_OUT" ]; then
  echo "FAIL: JSON audit output file was not created" >&2
  exit 1
fi
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$JSON_OUT"
if printf '%s' "$AUDIT_STDOUT" | grep -q '^FAILURES [0-9]\+$'; then
  echo "FAIL: compact reporter marker appeared during --reporter=json audit" >&2
  exit 1
fi

echo "PASS: reporter isolation gate satisfied"
