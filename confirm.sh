#!/usr/bin/env bash
# Gather more samples on the current configuration, across all shapes.
set -uo pipefail
LOG=confirm.log
say() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
wait_idle() { while wsl -d Ubuntu -e pgrep -f run-challenge >/dev/null 2>&1; do sleep 20; done; }

run_resilient() {
  local label="$1"; shift
  for attempt in 1 2 3 4 5 6; do
    local before after
    before=$(ls runs 2>/dev/null | wc -l)
    wait_idle
    ./wrun.sh "$@" >/dev/null 2>&1 || true
    after=$(ls runs 2>/dev/null | wc -l)
    if [ "$after" -gt "$before" ]; then
      local newest; newest=$(ls runs | tail -1)
      if node -e 'const fs=require("fs");try{process.exit(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).input_tokens>0?0:1)}catch{process.exit(1)}' "runs/$newest/result.json" 2>/dev/null; then
        say "  ok    $label"; return 0
      fi
    fi
    say "  retry $label (attempt $attempt) — provider refused"
    sleep 600
  done
  say "  skip  $label"; return 1
}

say "=== confirming config B across two passes of every shape ==="
for pass in 1 2; do
  say "--- pass $pass ---"
  run_resilient "books p$pass"
  for idea in eval-ideas/*.txt; do
    run_resilient "$(basename "$idea" .txt) p$pass" --idea-file "$idea"
  done
done
say "=== done ==="
node compare.js | tee -a "$LOG"
