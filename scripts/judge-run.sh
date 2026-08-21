#!/usr/bin/env bash
# Append a human judgment for a challenge run.
# Usage:
#   ./scripts/judge-run.sh <run-id> --harness success|failed|timeout \
#     --product great|ok|broken [--issues localstorage,ui] [--note "..."]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JUDGMENTS_DIR="$ROOT/artifacts/judgments"
INDEX="$JUDGMENTS_DIR/pilot.jsonl"
mkdir -p "$JUDGMENTS_DIR"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <run-id> --harness <status> --product <rating> [--issues a,b] [--note text]" >&2
  exit 2
fi

RUN_ID=$1
shift

HARNESS=""
PRODUCT=""
ISSUES="[]"
NOTE=""
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || echo unknown)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --harness) HARNESS=$2; shift 2 ;;
    --product) PRODUCT=$2; shift 2 ;;
    --issues)
      IFS=',' read -r -a parts <<<"$2"
      ISSUES="["
      first=1
      for p in "${parts[@]}"; do
        [[ -z "$p" ]] && continue
        if [[ $first -eq 1 ]]; then first=0; else ISSUES+=","; fi
        ISSUES+="\"$p\""
      done
      ISSUES+="]"
      shift 2
      ;;
    --note) NOTE=$2; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$HARNESS" || -z "$PRODUCT" ]]; then
  echo "Required: --harness and --product" >&2
  exit 2
fi

NOTE_ESCAPED=${NOTE//\\/\\\\}
NOTE_ESCAPED=${NOTE_ESCAPED//\"/\\\"}
RECORDED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

LINE=$(cat <<EOF
{"run_id":"$RUN_ID","recorded_at":"$RECORDED_AT","git_commit":"$COMMIT","git_branch":"$BRANCH","harness_status":"$HARNESS","product_rating":"$PRODUCT","issues":$ISSUES,"note":"$NOTE_ESCAPED"}
EOF
)

echo "$LINE" >>"$INDEX"

RUN_DIR="$ROOT/artifacts/runs/$RUN_ID"
if [[ -d "$RUN_DIR" ]]; then
  printf '%s\n' "$LINE" >"$RUN_DIR/judgment.json"
fi

echo "Recorded judgment for $RUN_ID"
echo "$LINE"
