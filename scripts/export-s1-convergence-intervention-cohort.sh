#!/usr/bin/env bash
# Export s1-convergence-intervention-v1 official cohort (+ invalid aa100517 audit trail) to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-s1-convergence-intervention-v1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/s1-convergence-intervention-v1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/s1-convergence-intervention-v1/2026-09-02T13-21-19Z.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T13-21-24-620Z"
  "2026-09-02T13-24-00-401Z"
  "2026-09-02T13-26-56-008Z"
  "2026-09-02T13-30-04-976Z"
  "2026-09-02T13-34-28-334Z"
)

DISCARDED_RUN_IDS=(
  "2026-09-02T12-40-07-751Z"
  "2026-09-02T12-55-19-652Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL = [
  '2026-09-02T13-21-24-620Z',
  '2026-09-02T13-24-00-401Z',
  '2026-09-02T13-26-56-008Z',
  '2026-09-02T13-30-04-976Z',
  '2026-09-02T13-34-28-334Z',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

const reps = OFFICIAL.map((runId, index) => {
  const ledgerPath = path.join('artifacts/analysis', runId, 'ledger.json');
  const trajPath = path.join('artifacts/analysis', runId, 'trajectory.v2.json');
  const resultPath = path.join('artifacts/runs', runId, 'result.json');
  const manifestPath = path.join('artifacts/runs', runId, 'run-manifest.json');
  const convergencePath = path.join('artifacts/runs', runId, 'convergence-intervention.v1.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const traj = JSON.parse(readFileSync(trajPath, 'utf8'));
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const convergence = existsSync(convergencePath)
    ? JSON.parse(readFileSync(convergencePath, 'utf8'))
    : null;
  const lastCall = ledger.calls.at(-1);

  return {
    rep: index + 1,
    run_id: runId,
    pinned_commit: manifest?.git?.commit ?? null,
    calls: ledger.calls.length,
    weighted_total: lastCall?.cumulative_weighted ?? manifest?.outcome?.weighted_cost ?? null,
    result_status: result?.status ?? manifest?.outcome?.status ?? null,
    journeys: result?.tests_run?.length ?? null,
    verify_fail_before_first_canonical_green: traj.verify_fail_before_first_canonical_green ?? null,
    canonical_verification_count: traj.canonical_verification_count ?? null,
    debug_test_files_created: traj.debug_test_files_created?.length ?? 0,
    tier1_count: convergence?.tier1_count ?? null,
    tier2_count: convergence?.tier2_count ?? null,
    false_positive_converging_interventions:
      convergence?.false_positive_converging_interventions ?? null,
    convergence_transitions: convergence?.transitions?.length ?? null,
  };
});

const weightedTotals = reps.map((rep) => rep.weighted_total).filter((v) => typeof v === 'number');

console.log(
  JSON.stringify(
    {
      experiment: 's1-convergence-intervention-v1',
      arm: 'treatment',
      pinned_treatment_commit: 'ee9095f012bd2e63330f8840e54f1ac308fbceaa',
      official_cohort_log: 'artifacts/experiments/s1-convergence-intervention-v1/2026-09-02T13-21-19Z.log',
      excluded_invalid_run_ids: [
        '2026-09-02T12-40-07-751Z',
        '2026-09-02T12-55-19-652Z',
      ],
      excluded_reason:
        'invalid_infrastructure_failure — VERIFY delivery broken on aa100517 (status is not defined)',
      control_baselines_locked: {
        median_weighted_total: 60852,
        runs_ge_120k: 0,
        runs_le_70k: 3,
        best_weighted: 49449,
      },
      reps,
      medians: {
        weighted_total: median(weightedTotals),
        calls: median(reps.map((rep) => rep.calls)),
      },
      gate_a_preview: {
        runs_ge_120k: weightedTotals.filter((v) => v >= 120_000).length,
        median_weighted_total: median(weightedTotals),
      },
      gate_b_preview: {
        runs_le_70k: weightedTotals.filter((v) => v <= 70_000).length,
        best_weighted: Math.min(...weightedTotals),
      },
      delivery_telemetry_note:
        'Export delivery=appended_to_verify_result is message_composed only; verify actual delivery in events.jsonl.',
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

  for file in idea.txt result.json run-manifest.json app-test-results.json convergence-intervention.v1.json; do
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
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/s1-convergence-intervention-v1" "$STAGING_DIR/runs/s1-convergence-intervention-v1-invalid-aa100517"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T13-21-19Z-official-ee9095f.log"
if [ -f "artifacts/experiments/s1-convergence-intervention-v1/cohort-ee9095f-2026-09-02T13-21-19Z.log" ]; then
  cp "artifacts/experiments/s1-convergence-intervention-v1/cohort-ee9095f-2026-09-02T13-21-19Z.log" \
    "$STAGING_DIR/experiment-logs/cohort-ee9095f-2026-09-02T13-21-19Z.log"
fi
cp "artifacts/experiments/s1-convergence-intervention-v1/cohort-protocol.v1.json" "$STAGING_DIR/cohort-protocol.v1.json"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

cp "docs/v2/control-floor/experiment-s1-convergence-intervention-v1-preregistration.md" "$STAGING_DIR/docs/"

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id" "s1-convergence-intervention-v1"
done

for run_id in "${DISCARDED_RUN_IDS[@]}"; do
  if [ -d "$REPO_ROOT/artifacts/runs/$run_id" ]; then
    copy_run "$run_id" "s1-convergence-intervention-v1-invalid-aa100517"
  fi
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
    'S1 convergence-intervention-v1 treatment cohort (official 5 reps on ee9095f) plus invalid aa100517 audit trail (VERIFY delivery broken, excluded from stats).',
  experiment: 's1-convergence-intervention-v1',
  preregistration: 'docs/v2/control-floor/experiment-s1-convergence-intervention-v1-preregistration.md',
  pinned_treatment_commit: summary.pinned_treatment_commit,
  official_experiment_log: 'experiment-logs/2026-09-02T13-21-19Z-official-ee9095f.log',
  excluded_invalid_run_ids: summary.excluded_invalid_run_ids,
  control_baselines_locked: summary.control_baselines_locked,
  cohort_summary: summary,
  runs: summary.reps.map((rep, index) => ({
    run_id: rep.run_id,
    cohort_path: 's1-convergence-intervention-v1/' + rep.run_id,
    label:
      'S1 Convergence Intervention v1 — Rep ' +
      (index + 1) +
      ' (' +
      Math.round(rep.weighted_total).toLocaleString() +
      ' weighted, ' +
      rep.calls +
      ' calls)',
    rep: index + 1,
    status: rep.result_status,
    tier1_count: rep.tier1_count,
    tier2_count: rep.tier2_count,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# S1 Convergence Intervention v1 cohort export

Official treatment cohort: **5/5 OK** on pinned commit \`ee9095f\` (artifacts/experiments/s1-convergence-intervention-v1/2026-09-02T13-21-19Z.log).

Invalid aa100517 runs (\`2026-09-02T12-40-07-751Z\`, \`2026-09-02T12-55-19-652Z\`) are under \`runs/s1-convergence-intervention-v1-invalid-aa100517/\` for audit only — **excluded from Gate A/B/C statistics**.

See \`cohort-summary.json\` for rep-level metrics and \`cohort-protocol.v1.json\` for analysis rules (message_composed vs message_delivered).
EOF

mkdir -p "$REPO_ROOT/artifacts/exports"
REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/s1-convergence-intervention-v1-staging")
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
