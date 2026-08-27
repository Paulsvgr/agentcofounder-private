#!/usr/bin/env bash
# Run one challenge in Docker and copy the results back to ./runs/<timestamp>/
# Usage: BERGET_API_KEY=... ./run.sh [--idea-file <path>] [extra challenge args]
set -euo pipefail

# .env.local is gitignored (.env.* rule). Put BERGET_API_KEY=... in it.
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi

: "${BERGET_API_KEY:?set BERGET_API_KEY in .env.local or the environment}"
MODEL="${CHALLENGE_MODEL:-openai/gpt-oss-120b}"
THINKING="${CHALLENGE_THINKING:-off}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="acf-$STAMP"
DEST="runs/$STAMP"

docker build -q -f Dockerfile.berget -t agentcofounder:berget . >/dev/null

echo "run:   $STAMP"
echo "model: $MODEL (thinking=$THINKING)"

set +e
docker run --name "$NAME" \
  -e BERGET_API_KEY \
  -e CHALLENGE_PROVIDER=berget \
  -e CHALLENGE_MODEL="$MODEL" \
  -e CHALLENGE_THINKING="$THINKING" \
  -e CHALLENGE_TIMEOUT_MS="${CHALLENGE_TIMEOUT_MS:-900000}" \
  agentcofounder:berget "$@"
CODE=$?
set -e

mkdir -p "$DEST"
# Copy explicit paths only. Copying /challenge/output wholesale pulls ~200MB of
# node_modules and dies partway, silently losing the generated src/.
for p in /challenge/result.json \
         /challenge/artifacts \
         /challenge/output/app/src \
         /challenge/output/app/report.partial.json \
         /challenge/output/app/package.json \
         /challenge/output/app/index.html; do
  docker cp "$NAME:$p" "$DEST/" 2>/dev/null || echo "  (no $p)"
done
docker rm -f "$NAME" >/dev/null

echo "exit code: $CODE"
echo "results:   $DEST"
[ -f "$DEST/result.json" ] && node -e '
const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
const eff=r.input_tokens + r.output_tokens*3 + r.cache_read_tokens*0.1;
console.log("\n status      :",r.status);
console.log(" model_calls :",r.model_calls);
console.log(" input       :",r.input_tokens);
console.log(" output      :",r.output_tokens);
console.log(" cache_read  :",r.cache_read_tokens);
console.log(" EFFICIENCY  :",Math.round(eff),"(input + 3*output + 0.1*cache_read)");
console.log(" cost EUR    :",r.cost_total);
console.log(" journeys    :",(r.tests_run||[]).length, "harness:",(r.harness_checks||[]).map(c=>c.result).join(","));
' "$DEST/result.json"
exit $CODE
