#!/usr/bin/env bash
# Unattended experiment sequence.
#
# Runs each phase in turn, and survives the provider refusing requests: a run
# that produces no result.json is retried after a wait rather than counted, so
# an exhausted wallet pauses the sequence instead of ending it.
#
# Usage: ./overnight.sh   (expects any current run to have finished)
set -uo pipefail

LOG=overnight.log
RETRY_WAIT=600      # 10 minutes between attempts when the provider refuses
MAX_RETRY=6         # give a refusing provider an hour before moving on

say() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

wait_idle() {
  while wsl -d Ubuntu -e pgrep -f run-challenge >/dev/null 2>&1; do sleep 20; done
}

# Run once. Returns 0 if a scored result landed, 1 if the provider refused.
run_once() {
  local before after newest
  before=$(ls runs 2>/dev/null | wc -l)
  wait_idle
  ./wrun.sh "$@" >/dev/null 2>&1 || true
  after=$(ls runs 2>/dev/null | wc -l)
  [ "$after" -eq "$before" ] && return 1
  newest=$(ls runs | tail -1)
  # model_calls without input_tokens means the request was rejected upstream.
  node -e '
    const fs=require("fs");
    try{const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      process.exit(r.input_tokens>0?0:1);}catch{process.exit(1);}
  ' "runs/$newest/result.json" 2>/dev/null
}

# Run once, retrying while the provider refuses.
run_resilient() {
  local label="$1"; shift
  local attempt=1
  while [ "$attempt" -le "$MAX_RETRY" ]; do
    if run_once "$@"; then
      say "  ok    $label"
      return 0
    fi
    say "  retry $label (attempt $attempt) — provider refused, waiting ${RETRY_WAIT}s"
    sleep "$RETRY_WAIT"
    attempt=$((attempt + 1))
  done
  say "  skip  $label — provider still refusing after $MAX_RETRY attempts"
  return 1
}

say "=== phase 1: eight shapes on the trimmed config ==="
run_resilient "books"
for idea in eval-ideas/*.txt; do
  run_resilient "$(basename "$idea" .txt)" --idea-file "$idea"
done
node compare.js | tee -a "$LOG"

say "=== phase 2: four repeats on one idea, for variance ==="
for i in 1 2 3 4; do run_resilient "books repeat $i"; done
node compare.js | tee -a "$LOG"

say "=== phase 3: GLM-5.2 on the same idea ==="
export CHALLENGE_MODEL="zai-org/GLM-5.2"
for i in 1 2 3; do run_resilient "glm $i"; done
unset CHALLENGE_MODEL

say "=== done ==="
node compare.js | tee -a "$LOG"
node audit.js  | tee -a "$LOG"
