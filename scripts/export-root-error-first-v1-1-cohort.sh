#!/usr/bin/env bash
# Export root-error-first-v1-1 cohort to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-03}"
EXPORT_NAME="cohort-root-error-first-v1-1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/root-error-first-v1-1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"
OFFICIAL_LOG="artifacts/experiments/root-error-first-v1-1/2026-09-03T19-16-29Z.log"

RUN_IDS=(
  "2026-09-03T19-16-36-521Z"
  "2026-09-03T19-19-37-116Z"
  "2026-09-03T19-22-51-374Z"
  "2026-09-03T19-27-54-147Z"
  "2026-09-03T19-30-53-874Z"
)
REPLACEMENT_RUN_ID="2026-09-03T19-35-06-282Z"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/root-error-first-v1-1"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-03T19-16-29Z-official.log"
cp "docs/v2/control-floor/experiment-root-error-first-v1-preregistration.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/experiment-root-error-first-v1.1-preregistration.md" "$STAGING_DIR/docs/"

copy_run() {
  local run_id="$1"
  local dest="$STAGING_DIR/runs/root-error-first-v1-1/$run_id"
  local src_run="$REPO_ROOT/artifacts/runs/$run_id"
  local src_analysis="$REPO_ROOT/artifacts/analysis/$run_id"

  mkdir -p "$dest/events" "$dest/sessions" "$dest/logs" "$dest/analysis" "$dest/app"

  for file in idea.txt result.json run-manifest.json app-test-results.json; do
    if [ -f "$src_run/$file" ]; then
      cp "$src_run/$file" "$dest/$file"
    fi
  done

  if [ -f "$src_run/events.jsonl" ]; then
    cp "$src_run/events.jsonl" "$dest/events/raw-event-stream.jsonl"
  fi

  session_file="$(find "$src_run/sessions" -maxdepth 1 -name '*.jsonl' 2>/dev/null | head -1 || true)"
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
}

for run_id in "${RUN_IDS[@]}" "$REPLACEMENT_RUN_ID"; do
  copy_run "$run_id"
done

node --import tsx -e "
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const staging = process.argv[1];
const official = process.argv[2].split(',');
const replacement = process.argv[3];

function w(r) {
  return Math.floor((r.input_tokens || 0) + (r.output_tokens || 0) * 3 + (r.cache_read_tokens || 0) * 0.1);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
function inspect(runId) {
  const result = JSON.parse(readFileSync(path.join('artifacts/runs', runId, 'result.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(path.join('artifacts/runs', runId, 'run-manifest.json'), 'utf8'));
  const eventsPath = path.join('artifacts/runs', runId, 'events.jsonl');
  let verifies = 0, fails = 0, rootSections = 0;
  if (existsSync(eventsPath)) {
    for (const line of readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean)) {
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type !== 'tool_execution_end' || e.toolName !== 'verify') continue;
      verifies += 1;
      const text = e.result?.content?.[0]?.text || '';
      if (text.includes('exit_code=1')) fails += 1;
      if (text.includes('ROOT / RUNTIME ERROR')) rootSections += 1;
    }
  }
  return {
    run_id: runId,
    rep: manifest.experiment?.rep ?? null,
    status: result.status ?? null,
    calls: result.model_calls ?? null,
    weighted_total: w(result),
    verify_calls: verifies,
    verify_fails: fails,
    root_sections: rootSections,
  };
}

const reps = official.map(inspect);
const replacementRep = inspect(replacement);
const ok = reps.filter((r) => r.status === 'success');
const summary = {
  experiment: 'root-error-first-v1-1',
  arm: 'treatment',
  date: '2026-09-03',
  comparator: 'css-persistence-v1 median 105386; inert root-error-first-v1 median 83386',
  official_cohort_log: 'experiment-logs/2026-09-03T19-16-29Z-official.log',
  harness_ok: \`\${ok.length}/5\`,
  note: 'Rep 5 official failed on Vite EPIPE after Pi; replacement also EPIPE (journeys 8/8, status partial).',
  reps,
  replacement_rep5: replacementRep,
  medians: {
    weighted_total_success_only: ok.length ? median(ok.map((r) => r.weighted_total)) : null,
    calls_success_only: ok.length ? median(ok.map((r) => r.calls).filter((v) => typeof v === 'number')) : null,
  },
  mechanism: {
    reps_with_root_section: reps.filter((r) => r.root_sections > 0).length,
  },
};
writeFileSync(path.join(staging, 'cohort-summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(path.join(staging, 'EXPORT_MANIFEST.json'), JSON.stringify({
  export_name: 'cohort-root-error-first-v1-1-2026-09-03',
  generated_at: new Date().toISOString(),
  description: 'Root-error-first VERIFY v1.1 (Vite import-resolution coverage) on frozen CSS+persistence stack.',
  experiment: 'root-error-first-v1-1',
  preregistration: 'docs/experiment-root-error-first-v1.1-preregistration.md',
  cohort_summary: summary,
}, null, 2));
" "$STAGING_DIR" "$(IFS=,; echo "${RUN_IDS[*]}")" "$REPLACEMENT_RUN_ID"

ZIP_PATH="$ZIP_PATH" STAGING_DIR="$STAGING_DIR" python3 - <<'PY'
import os
import zipfile

staging = os.environ["STAGING_DIR"]
zip_path = os.environ["ZIP_PATH"]
parent = os.path.dirname(staging)

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, parent)
            zf.write(full, arc)
print(zip_path)
PY

ls -lh "$ZIP_PATH"
