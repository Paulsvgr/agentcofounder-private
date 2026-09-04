#!/usr/bin/env bash
# Export q2-harness-owned-test-structure-v1 official cohort to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-q2-harness-owned-test-structure-v1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/q2-harness-owned-test-structure-v1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/q2-harness-owned-test-structure-v1/2026-09-02T09-33-38Z.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T09-33-44-044Z"
  "2026-09-02T09-38-48-126Z"
  "2026-09-02T09-45-03-724Z"
  "2026-09-02T09-49-15-043Z"
  "2026-09-02T09-53-21-545Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { countAuthoredTestsInApp } from './solution/extensions/early-verify-core.js';

const OFFICIAL = [
  '2026-09-02T09-33-44-044Z',
  '2026-09-02T09-38-48-126Z',
  '2026-09-02T09-45-03-724Z',
  '2026-09-02T09-49-15-043Z',
  '2026-09-02T09-53-21-545Z',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

const reps = OFFICIAL.map((runId, index) => {
  const metricsPath = path.join('artifacts/analysis', runId, 'test-structure.metrics.json');
  const ledgerPath = path.join('artifacts/analysis', runId, 'ledger.json');
  const trajPath = path.join('artifacts/analysis', runId, 'trajectory.v2.json');
  const resultPath = path.join('artifacts/runs', runId, 'result.json');
  const exportPath = path.join('artifacts/runs', runId, 'test-structure.v1.json');
  const appDir = path.join('artifacts/runs', runId, 'app');
  const metrics = JSON.parse(readFileSync(metricsPath, 'utf8'));
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const traj = JSON.parse(readFileSync(trajPath, 'utf8'));
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const exportData = existsSync(exportPath) ? JSON.parse(readFileSync(exportPath, 'utf8')) : null;
  const runEndAuthored = existsSync(appDir) ? countAuthoredTestsInApp(appDir) : null;
  const lastCall = ledger.calls.at(-1);

  return {
    rep: index + 1,
    run_id: runId,
    calls: ledger.calls.length,
    weighted_total: lastCall?.cumulative_weighted ?? null,
    result_status: result?.status ?? null,
    journeys: result?.tests_run?.length ?? null,
    first_successful_authored_test_addition_call:
      metrics.first_successful_authored_test_addition_call,
    primary_anchor_canonical_verify_call: metrics.primary_anchor_canonical_verify_call,
    primary_anchor_verify_source: metrics.primary_anchor_verify_source,
    primary_anchor_verify_outcome: metrics.primary_anchor_verify_outcome,
    call_span_first_addition_to_anchor: metrics.call_span_first_addition_to_anchor,
    weighted_first_addition_to_anchor_verify: metrics.weighted_first_addition_to_anchor_verify,
    weighted_anchor_verify_to_first_canonical_pass:
      metrics.weighted_anchor_verify_to_first_canonical_pass,
    increment_guard_rejections: metrics.increment_guard_rejections,
    max_accepted_single_step_delta: metrics.max_accepted_single_step_delta,
    skeleton_authored_count_at_start: metrics.skeleton_authored_count_at_start,
    test_structure_error: metrics.test_structure_error,
    run_end_authored_test_count: runEndAuthored?.authored_test_count ?? null,
    run_end_test_loc: runEndAuthored?.test_loc ?? null,
    run_end_journey_test_count: metrics.run_end_journey_test_count,
    verify_fail_before_first_canonical_green: traj.verify_fail_before_first_canonical_green ?? null,
    export: exportData,
  };
});

const pick = (key) => reps.map((rep) => rep[key]).filter((value) => typeof value === 'number');

console.log(
  JSON.stringify(
    {
      experiment: 'q2-harness-owned-test-structure-v1',
      arm: 'treatment',
      official_cohort_log:
        'artifacts/experiments/q2-harness-owned-test-structure-v1/2026-09-02T09-33-38Z.log',
      control_baselines_locked: {
        authored_test_count_at_anchor: 8,
        test_loc_at_anchor: 171,
        weighted_first_test_mutation_to_first_post_mutation_canonical_verify: 8929,
        median_weighted_total: 60852,
        run_end_journey_test_count_median: 8,
        run_end_journey_test_count_min: 6,
      },
      reps,
      medians: {
        weighted_total: median(pick('weighted_total')),
        calls: median(pick('calls')),
        run_end_journey_test_count: median(pick('run_end_journey_test_count')),
        run_end_authored_test_count: median(pick('run_end_authored_test_count')),
        weighted_anchor_verify_to_first_canonical_pass: median(
          pick('weighted_anchor_verify_to_first_canonical_pass'),
        ),
        increment_guard_rejections: median(pick('increment_guard_rejections')),
      },
      gate_c: {
        skeleton_authored_count_zero: reps.filter((rep) => rep.skeleton_authored_count_at_start === 0)
          .length,
        test_structure_errors: reps.filter((rep) => rep.test_structure_error).length,
        max_accepted_single_step_delta_le_1: reps.filter(
          (rep) => rep.max_accepted_single_step_delta <= 1,
        ).length,
        increment_guard_rejections_total: reps.reduce(
          (sum, rep) => sum + rep.increment_guard_rejections,
          0,
        ),
      },
    },
    null,
    2,
  ),
);
")"

copy_run() {
  local run_id="$1"
  local cohort_key="$2"
  local dest="$STAGING_DIR/runs/$cohort_key/$run_id"
  local src_run="$REPO_ROOT/artifacts/runs/$run_id"
  local src_analysis="$REPO_ROOT/artifacts/analysis/$run_id"

  mkdir -p "$dest/events" "$dest/sessions" "$dest/logs" "$dest/analysis" "$dest/app"

  for file in idea.txt result.json run-manifest.json app-test-results.json test-structure.v1.json; do
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

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/q2-harness-owned-test-structure-v1"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T09-33-38Z-official.log"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

npm run retro:q2-early-verify-control > "$STAGING_DIR/control-retro-v2.2.json" 2>/dev/null || true

cp "docs/v2/control-floor/experiment-q2-harness-owned-test-structure-v1-preregistration.md" "$STAGING_DIR/docs/"

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id" "q2-harness-owned-test-structure-v1"
done

STAGING_DIR="$STAGING_DIR" EXPORT_NAME="$EXPORT_NAME" node --import tsx -e "
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const stagingDir = process.env.STAGING_DIR!;
const exportName = process.env.EXPORT_NAME!;
const summary = JSON.parse(
  readFileSync(path.join(stagingDir, 'cohort-summary.json'), 'utf8'),
);

const manifest = {
  export_name: exportName,
  generated_at: new Date().toISOString(),
  description:
    'Q2-E harness-owned-test-structure-v1 treatment cohort (official 5 reps, 5/5 OK).',
  experiment: 'q2-harness-owned-test-structure-v1',
  preregistration:
    'docs/v2/control-floor/experiment-q2-harness-owned-test-structure-v1-preregistration.md',
  official_experiment_log: 'experiment-logs/2026-09-02T09-33-38Z-official.log',
  treatment_run_count: summary.reps.length,
  control_baselines_locked: summary.control_baselines_locked,
  cohort_summary: summary,
  runs: summary.reps.map((rep, index) => ({
    run_id: rep.run_id,
    cohort_path: 'q2-harness-owned-test-structure-v1/' + rep.run_id,
    label:
      'Q2-E Harness-owned test structure v1 — Rep ' +
      (index + 1) +
      ' (' +
      Math.round(rep.weighted_total).toLocaleString() +
      ' weighted, ' +
      rep.calls +
      ' calls)',
    rep: index + 1,
    status: rep.result_status,
    increment_guard_rejections: rep.increment_guard_rejections,
    max_accepted_single_step_delta: rep.max_accepted_single_step_delta,
    run_end_journeys: rep.run_end_journey_test_count,
    run_end_authored: rep.run_end_authored_test_count,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# Q2-E Harness-owned test structure v1 cohort export

Official treatment cohort: **5/5 OK** (artifacts/experiments/q2-harness-owned-test-structure-v1/2026-09-02T09-33-38Z.log).

See \`cohort-summary.json\` for Gate A–F inputs and \`control-retro-v2.2.json\` for locked v2.2 control baselines.

Formal experiment verdict remains **PENDING** until human quality scoring (\`app_rating\`, \`usability_ux\`) on all 5 treatment apps per frozen prereg Gate F.
EOF

REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/q2-harness-owned-test-structure-v1-staging")
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
