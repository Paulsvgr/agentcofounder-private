#!/usr/bin/env bash
# Run one retest condition: checkout commit, free port 3000, run challenge.
# Usage:
#   ./scripts/retest-condition.sh <label> <commit> [provider]
# Providers: zai (default) | berget | openai
# Examples:
#   ./scripts/retest-condition.sh A-baseline d0f0b49 zai
#   ./scripts/retest-condition.sh A-berget d0f0b49 berget
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=${1:?label required}
COMMIT=${2:?commit required}
PROVIDER=${3:-zai}

cd "$ROOT"

case "$PROVIDER" in
  zai)
    ENV_FILE="$HOME/.pi/agent/challenge-env-zai.sh"
    # Prefer repo template if home copy is missing.
    if [[ ! -f "$ENV_FILE" && -f "$ROOT/pi-agent/challenge-env-zai.sh" ]]; then
      ENV_FILE="$ROOT/pi-agent/challenge-env-zai.sh"
    fi
    ;;
  berget)
    ENV_FILE="$HOME/.pi/agent/challenge-env.sh"
    if [[ ! -f "$ENV_FILE" && -f "$ROOT/pi-agent/challenge-env.sh" ]]; then
      ENV_FILE="$ROOT/pi-agent/challenge-env.sh"
    fi
    ;;
  openai)
    ENV_FILE="$HOME/.pi/agent/challenge-env-openai.sh"
    if [[ ! -f "$ENV_FILE" && -f "$ROOT/pi-agent/challenge-env-openai.sh" ]]; then
      ENV_FILE="$ROOT/pi-agent/challenge-env-openai.sh"
    fi
    ;;
  *)
    echo "Unknown provider: $PROVIDER (expected zai|berget|openai)" >&2
    exit 2
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file for provider $PROVIDER: $ENV_FILE" >&2
  exit 2
fi

echo "==> Retest $LABEL at $COMMIT provider=$PROVIDER"
git checkout --quiet "$COMMIT"
echo "HEAD=$(git rev-parse --short HEAD) branch=$(git branch --show-current || true)"

# Free port 3000 if occupied (challenge requires it free).
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  pids=$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids:-}" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
  fi
fi

# shellcheck disable=SC1090
source "$ENV_FILE"
export CHALLENGE_THINKING="${CHALLENGE_THINKING:-off}"

LOG="$ROOT/artifacts/judgments/retest-${LABEL}-$(date -u +%Y%m%dT%H%M%SZ).log"
mkdir -p "$ROOT/artifacts/judgments"
echo "Logging to $LOG"
{
  echo "RETEST_LABEL=$LABEL COMMIT=$(git rev-parse HEAD) PROVIDER=$PROVIDER MODEL=${CHALLENGE_MODEL:-} ENV_FILE=$ENV_FILE"
} | tee "$LOG"

npm run challenge 2>&1 | tee -a "$LOG"
CHALLENGE_EXIT=${PIPESTATUS[0]}
echo "RETEST_DONE label=$LABEL exit=$CHALLENGE_EXIT" | tee -a "$LOG"

# Snapshot the generated app so builds remain reviewable after the next run wipes output/app.
RUN_ID=$(ls -1dt "$ROOT/artifacts/runs"/*/ 2>/dev/null | head -1 | xargs -r basename || true)
if [[ -n "${RUN_ID:-}" && -d "$ROOT/output/app" ]]; then
  "$ROOT/scripts/save-app.sh" "$LABEL" "$RUN_ID" | tee -a "$LOG"
  if command -v npm >/dev/null 2>&1; then
    npm run analyze -- "$RUN_ID" 2>&1 | tee -a "$LOG" || true
    npm run export:run -- "$RUN_ID" --approach "$LABEL" 2>&1 | tee -a "$LOG" || true
  fi
else
  echo "WARN: skipped save-app (run_id='${RUN_ID:-}' output/app missing?)" | tee -a "$LOG"
fi

exit "$CHALLENGE_EXIT"
