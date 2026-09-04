#!/usr/bin/env bash
# Export q2-early-verify-v1 official cohort (+ invalid preflight audit trail) to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-q2-early-verify-v1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/q2-early-verify-v1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/q2-early-verify-v1/2026-09-02T07-43-17Z.log"
PREFLIGHT_LOG="artifacts/experiments/q2-early-verify-v1/2026-09-02T07-42-08Z.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T07-43-21-803Z"
  "2026-09-02T07-48-39-238Z"
  "2026-09-02T07-55-36-143Z"
  "2026-09-02T08-00-40-390Z"
  "2026-09-02T08-04-39-535Z"
)

PREFLIGHT_RUN_IDS=(
  "2026-09-02T07-42-13-311Z"
  "2026-09-02T07-42-23-510Z"
  "2026-09-02T07-42-32-866Z"
  "2026-09-02T07-42-42-355Z"
  "2026-09-02T07-42-51-203Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL = [
  '2026-09-02T07-43-21-803Z',
  '2026-09-02T07-48-39-238Z',
  '2026-09-02T07-55-36-143Z',
  '2026-09-02T08-00-40-390Z',
  '2026-09-02T08-04-39-535Z',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

const reps = OFFICIAL.map((runId, index) => {
  const metricsPath = path.join('artifacts/analysis', runId, 'early-verify.metrics.json');
  const ledgerPath = path.join('artifacts/analysis', runId, 'ledger.json');
  const trajPath = path.join('artifacts/analysis', runId, 'trajectory.v2.json');
  const resultPath = path.join('artifacts/runs', runId, 'result.json');
  const metrics = JSON.parse(readFileSync(metricsPath, 'utf8'));
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const traj = JSON.parse(readFileSync(trajPath, 'utf8'));
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const lastCall = ledger.calls.at(-1);
  const anchor = metrics.first_post_mutation_canonical_verify_call;
  const firstPass = traj.verification_runs?.find(
    (run) => run.canonical && run.canonical_outcome === 'pass',
  );
  const anchorCall = ledger.calls.find((call) => call.index === anchor);
  const passCall = firstPass
    ? ledger.calls.find((call) => call.index === firstPass.call_index)
    : null;
  const repairSpan =
    anchorCall && passCall
      ? passCall.cumulative_weighted - anchorCall.cumulative_weighted
      : null;

  return {
    rep: index + 1,
    run_id: runId,
    calls: ledger.calls.length,
    weighted_total: lastCall?.cumulative_weighted ?? null,
    result_status: result?.status ?? null,
    journeys: result?.tests_run?.length ?? null,
    first_test_mutation_call: metrics.first_test_mutation_call,
    first_post_mutation_canonical_verify_call: metrics.first_post_mutation_canonical_verify_call,
    first_post_mutation_canonical_verify_source: metrics.first_post_mutation_canonical_verify_source,
    first_post_mutation_canonical_verify_outcome: metrics.first_post_mutation_canonical_verify_outcome,
    authored_test_count_at_first_post_mutation_verify:
      metrics.authored_test_count_at_first_post_mutation_verify,
    test_loc_at_first_post_mutation_verify: metrics.test_loc_at_first_post_mutation_verify,
    weighted_mutation_to_first_post_mutation_verify:
      metrics.weighted_mutation_to_first_post_mutation_verify,
    call_span_mutation_to_post_mutation:
      metrics.first_post_mutation_canonical_verify_call !== null &&
      metrics.first_test_mutation_call !== null
        ? metrics.first_post_mutation_canonical_verify_call -
          metrics.first_test_mutation_call
        : null,
    weighted_post_mutation_verify_to_first_canonical_pass: repairSpan,
    auto_early_verify_fired: metrics.auto_early_verify_fired,
    early_verify_error: metrics.early_verify_error,
    total_canonical_verify_count: metrics.total_canonical_verify_count,
    run_end_authored_test_count: metrics.run_end_authored_test_count,
    run_end_journey_test_count: metrics.run_end_journey_test_count,
    verify_fail_before_first_canonical_green: traj.verify_fail_before_first_canonical_green ?? null,
  };
});

const pick = (key) => reps.map((rep) => rep[key]).filter((value) => typeof value === 'number');

console.log(
  JSON.stringify(
    {
      experiment: 'q2-early-verify-v1',
      arm: 'treatment',
      official_cohort_log: 'artifacts/experiments/q2-early-verify-v1/2026-09-02T07-43-17Z.log',
      excluded_preflight_run_ids: [
        '2026-09-02T07-42-13-311Z',
        '2026-09-02T07-42-23-510Z',
        '2026-09-02T07-42-32-866Z',
        '2026-09-02T07-42-42-355Z',
        '2026-09-02T07-42-51-203Z',
      ],
      control_baselines_locked: {
        authored_test_count_at_first_post_mutation_verify: 8,
        test_loc_at_first_post_mutation_verify: 171,
        weighted_mutation_to_first_post_mutation_verify: 8929,
        call_span_mutation_to_first_post_mutation_verify: 1,
      },
      reps,
      medians: {
        authored_test_count_at_first_post_mutation_verify: median(
          pick('authored_test_count_at_first_post_mutation_verify'),
        ),
        test_loc_at_first_post_mutation_verify: median(
          pick('test_loc_at_first_post_mutation_verify'),
        ),
        weighted_mutation_to_first_post_mutation_verify: median(
          pick('weighted_mutation_to_first_post_mutation_verify'),
        ),
        call_span_mutation_to_post_mutation: median(pick('call_span_mutation_to_post_mutation')),
        weighted_total: median(pick('weighted_total')),
        weighted_post_mutation_verify_to_first_canonical_pass: median(
          pick('weighted_post_mutation_verify_to_first_canonical_pass'),
        ),
        calls: median(pick('calls')),
      },
      gate_c: {
        auto_early_verify_fired: reps.filter((rep) => rep.auto_early_verify_fired).length,
        first_post_mutation_source_auto_early_v1: reps.filter(
          (rep) => rep.first_post_mutation_canonical_verify_source === 'auto_early_v1',
        ).length,
        early_verify_errors: reps.filter((rep) => rep.early_verify_error).length,
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

  for file in idea.txt result.json run-manifest.json app-test-results.json early-verify.v1.json; do
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
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/q2-early-verify-v1" "$STAGING_DIR/runs/q2-early-verify-v1-preflight-invalid"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T07-43-17Z-official.log"
cp "$PREFLIGHT_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T07-42-08Z-preflight-invalid.log"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

npm run retro:q2-early-verify-control > "$STAGING_DIR/control-retro-v2.2.json" 2>/dev/null || true

cp "docs/v2/control-floor/experiment-q2-early-verify-v1-preregistration.md" "$STAGING_DIR/docs/"

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id" "q2-early-verify-v1"
done

for run_id in "${PREFLIGHT_RUN_IDS[@]}"; do
  copy_run "$run_id" "q2-early-verify-v1-preflight-invalid"
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
    'Q2-D early-verify-v1 treatment cohort (official 5 reps) plus invalid preflight audit trail (parser failure, excluded from stats).',
  experiment: 'q2-early-verify-v1',
  preregistration: 'docs/v2/control-floor/experiment-q2-early-verify-v1-preregistration.md',
  official_experiment_log: 'experiment-logs/2026-09-02T07-43-17Z-official.log',
  preflight_invalid_log: 'experiment-logs/2026-09-02T07-42-08Z-preflight-invalid.log',
  treatment_run_count: summary.reps.length,
  excluded_preflight_run_ids: summary.excluded_preflight_run_ids,
  control_baselines_locked: summary.control_baselines_locked,
  cohort_summary: summary,
  runs: summary.reps.map((rep, index) => ({
    run_id: rep.run_id,
    cohort_path: 'q2-early-verify-v1/' + rep.run_id,
    label:
      'Q2-D Early VERIFY v1 — Rep ' +
      (index + 1) +
      ' (' +
      Math.round(rep.weighted_total).toLocaleString() +
      ' weighted, ' +
      rep.calls +
      ' calls)',
    rep: index + 1,
    status: rep.result_status,
    auto_early_verify_fired: rep.auto_early_verify_fired,
    authored_at_anchor: rep.authored_test_count_at_first_post_mutation_verify,
    test_loc_at_anchor: rep.test_loc_at_first_post_mutation_verify,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# Q2-D Early VERIFY v1 cohort export

Official treatment cohort: **5/5 OK** (artifacts/experiments/q2-early-verify-v1/2026-09-02T07-43-17Z.log).

Invalid preflight batch (extension JSDoc parse error, 0 calls each) is included under \`runs/q2-early-verify-v1-preflight-invalid/\` for audit only — **excluded from treatment statistics**.

See \`cohort-summary.json\` for Gate A–E inputs and \`control-retro-v2.2.json\` for locked v2.2 control baselines.
EOF

REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/q2-early-verify-v1-staging")
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
