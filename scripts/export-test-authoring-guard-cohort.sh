#!/usr/bin/env bash
# Export test-authoring-guard-v1 cohort to staging + ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-test-authoring-guard-v1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/test-authoring-guard-v1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"
EXPERIMENT_LOG="artifacts/experiments/test-authoring-guard-v1/2026-09-01T23-23-04Z.log"
COHORT_JSON="$(node --import tsx scripts/summarize-test-authoring-guard-cohort.ts)"

RUN_IDS=(
  "2026-09-01T23-23-10-013Z"
  "2026-09-01T23-26-24-352Z"
  "2026-09-01T23-28-52-670Z"
  "2026-09-01T23-33-08-008Z"
  "2026-09-01T23-38-35-782Z"
)

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/runs/test-authoring-guard-v1"

cp "$EXPERIMENT_LOG" "$STAGING_DIR/experiment-logs/2026-09-01T23-23-04Z.log"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

for rep in "${!RUN_IDS[@]}"; do
  run_id="${RUN_IDS[$rep]}"
  rep_num=$((rep + 1))
  dest="$STAGING_DIR/runs/test-authoring-guard-v1/$run_id"
  src_run="$REPO_ROOT/artifacts/runs/$run_id"
  src_analysis="$REPO_ROOT/artifacts/analysis/$run_id"

  mkdir -p "$dest/events" "$dest/sessions" "$dest/logs" "$dest/analysis" "$dest/app"

  for file in idea.txt result.json run-manifest.json app-test-results.json; do
    if [ -f "$src_run/$file" ]; then
      cp "$src_run/$file" "$dest/$file"
    fi
  done

  if [ -f "$src_run/events.jsonl" ]; then
    cp "$src_run/events.jsonl" "$dest/events/raw-event-stream.jsonl"
  fi

  session_file="$(find "$src_run/sessions" -maxdepth 1 -name '*.jsonl' | head -1 || true)"
  if [ -n "$session_file" ]; then
    cp "$session_file" "$dest/sessions/pi-session.jsonl"
  fi

  for log in pi.stderr.log app-test.log app-build.log app-dev.log; do
    if [ -f "$src_run/$log" ]; then
      cp "$src_run/$log" "$dest/logs/$log"
    fi
  done

  if [ -d "$src_run/app" ]; then
    rsync -a --exclude 'node_modules' --exclude 'dist' "$src_run/app/" "$dest/app/"
  fi

  if [ -d "$src_analysis" ]; then
    cp -r "$src_analysis/." "$dest/analysis/"
  fi

  node --import tsx -e "
const summary = JSON.parse(process.argv[2]);
const repIndex = Number(process.argv[3]);
const rep = summary.reps[repIndex];
const fs = require('node:fs');
const path = require('node:path');
const dest = process.argv[4];
fs.writeFileSync(path.join(dest, 'RUN_INFO.json'), JSON.stringify({
  run_id: rep.run_id,
  experiment: 'test-authoring-guard-v1',
  rep: repIndex + 1,
  label: \`Q2-C Test Authoring Guard v1 — Rep \${repIndex + 1} (\${rep.weighted.toLocaleString()} weighted, \${rep.calls} calls)\`,
  guard_blocks_before_first_allowed: rep.guard_blocks_before_first_allowed,
  guard_blocks_by_pattern: rep.guard_blocks_by_pattern,
  first_allowed_verify_pass: rep.first_allowed_verify_pass,
  pre_verify_weighted_to_first_allowed: rep.pre_verify_weighted_to_first_allowed,
  verify_fail_before_first_canonical_green: rep.verify_fails_before_green,
  harness_script_ok: true,
}, null, 2));
" _ "$COHORT_JSON" "$rep" "$dest"
done

node --import tsx scripts/write-test-authoring-guard-manifest.ts "$STAGING_DIR" "$EXPORT_NAME" "$COHORT_JSON"

REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/test-authoring-guard-v1-staging")
zip_path = os.environ.get("ZIP_PATH")

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, os.path.dirname(staging))
            zf.write(full, arc)
print(zip_path)
PY

ls -lh "$ZIP_PATH"
