#!/usr/bin/env bash
# Run one challenge inside WSL Ubuntu and copy results back to ./runs/<timestamp>/
#
# The starter cannot run on Windows: port-owner.ts implements only Linux /proc
# and macOS lsof paths, and every spawn uses shell:false, which Node 22 rejects
# for .cmd shims. WSL provides real Linux without a Docker daemon to babysit.
#
# Usage: ./wrun.sh [extra challenge args]
set -euo pipefail

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${BERGET_API_KEY:?set BERGET_API_KEY in .env.local}"

MODEL="${CHALLENGE_MODEL:-openai/gpt-oss-120b}"
THINKING="${CHALLENGE_THINKING:-off}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="runs/$STAMP"
WSL_DIR="\$HOME/agentcofounder"

echo "run:   $STAMP"
echo "model: $MODEL (thinking=$THINKING)"

# Mirror the current source into the WSL filesystem. node_modules and previous
# run output stay put, so only changed sources move.
# Git Bash reports /c/... for what WSL mounts at /mnt/c/...
# SKIP_SYNC lets a batch sync once up front, so an edit made mid-batch cannot
# silently change the configuration being measured.
if [ "${SKIP_SYNC:-0}" != "1" ]; then
  SRC="/mnt$(pwd)"
  wsl -d Ubuntu -e bash -lc "
    rsync -a \
      --exclude node_modules --exclude .git --exclude runs \
      --exclude 'artifacts/runs' --exclude 'output/app' --exclude dist \
      '$SRC/' $WSL_DIR/
  "
fi

set +e
wsl -d Ubuntu -e bash -lc "
  rm -rf $WSL_DIR/artifacts/runs   # keep one run's audit trail per result directory
  export PATH=\$HOME/tools/node22/bin:\$PATH
  export BERGET_API_KEY='$BERGET_API_KEY'
  export CHALLENGE_PROVIDER=berget
  export CHALLENGE_MODEL='$MODEL'
  export CHALLENGE_THINKING='$THINKING'
  export CHALLENGE_TIMEOUT_MS='${CHALLENGE_TIMEOUT_MS:-900000}'
  mkdir -p \$HOME/.pi/agent
  cp $WSL_DIR/solution/berget-models.json \$HOME/.pi/agent/models.json
  cd $WSL_DIR && npm run challenge -- $*
"
CODE=$?
set -e

mkdir -p "$DEST"
wsl -d Ubuntu -e bash -lc "
  cd $WSL_DIR
  tar cf - result.json artifacts/runs \
    output/app/src output/app/report.partial.json \
    output/app/package.json output/app/index.html 2>/dev/null
" | tar xf - -C "$DEST" 2>/dev/null || echo "  (some artifacts missing)"

echo "exit code: $CODE"
echo "results:   $DEST"
[ -f "$DEST/result.json" ] && node -e '
const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
const eff=r.input_tokens + r.output_tokens*3 + r.cache_read_tokens*0.1;
console.log("\n status      :",r.status);
console.log(" model_calls :",r.model_calls);
console.log(" input       :",r.input_tokens);
console.log(" output      :",r.output_tokens);
console.log(" EFFICIENCY  :",Math.round(eff));
console.log(" cost EUR    :",r.cost_total);
console.log(" journeys    :",(r.tests_run||[]).length,
            "harness:",(r.harness_checks||[]).map(c=>c.result).join(","));
' "$DEST/result.json"
exit $CODE
