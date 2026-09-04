#!/usr/bin/env bash
# Export ss2-scope-sequence-v2 official cohort to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-ss2-scope-sequence-v2-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/ss2-scope-sequence-v2-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/ss2-scope-sequence-v2/2026-09-02T16-11-00Z.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T16-11-05-268Z"
  "2026-09-02T16-17-10-814Z"
  "2026-09-02T16-21-29-036Z"
  "2026-09-02T16-26-13-808Z"
  "2026-09-02T16-30-34-810Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL = [
  '2026-09-02T16-11-05-268Z',
  '2026-09-02T16-17-10-814Z',
  '2026-09-02T16-21-29-036Z',
  '2026-09-02T16-26-13-808Z',
  '2026-09-02T16-30-34-810Z',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function weightedAtCall(ledger, callIndex) {
  const call = ledger.calls.find((c) => c.index === callIndex);
  return call?.cumulative_weighted ?? null;
}

function firstTestMutationCall(ledger) {
  for (const call of ledger.calls) {
    for (const tool of call.tools) {
      if (tool.name !== 'write' && tool.name !== 'edit') continue;
      for (const p of [...(tool.paths ?? []), tool.detail].filter(Boolean)) {
        const norm = String(p).replace(/\\\\/g, '/');
        if (norm.startsWith('src/') && /\\.test\\.tsx?\$/.test(norm)) return call.index;
      }
    }
  }
  return null;
}

const reps = OFFICIAL.map((runId, index) => {
  const ledgerPath = path.join('artifacts/analysis', runId, 'ledger.json');
  const trajPath = path.join('artifacts/analysis', runId, 'trajectory.v2.json');
  const resultPath = path.join('artifacts/runs', runId, 'result.json');
  const manifestPath = path.join('artifacts/runs', runId, 'run-manifest.json');
  const scopePath = path.join('artifacts/runs', runId, 'scope-sequence.v2.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const traj = JSON.parse(readFileSync(trajPath, 'utf8'));
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const scope = existsSync(scopePath) ? JSON.parse(readFileSync(scopePath, 'utf8')) : null;
  const lastCall = ledger.calls.at(-1);
  const firstVerify = traj.verification_runs?.find((r) => r.canonical)?.call_index ?? null;
  const firstTestMut = firstTestMutationCall(ledger);
  const mutationToVerifySpan =
    firstTestMut !== null && firstVerify !== null ? firstVerify - firstTestMut : null;
  const wMut = firstTestMut !== null ? weightedAtCall(ledger, firstTestMut) : null;
  const wVerify = firstVerify !== null ? weightedAtCall(ledger, firstVerify) : null;

  return {
    rep: index + 1,
    run_id: runId,
    pinned_commit: manifest?.git?.commit ?? null,
    calls: ledger.calls.length,
    weighted_total: lastCall?.cumulative_weighted ?? manifest?.outcome?.weighted_cost ?? null,
    weighted_before_first_canonical_verification:
      traj.weighted_before_first_canonical_verification ?? null,
    weighted_mutation_to_first_post_mutation_verify:
      wMut !== null && wVerify !== null ? wVerify - wMut : null,
    mutation_to_verify_span: mutationToVerifySpan,
    first_canonical_verify_call: firstVerify,
    result_status: result?.status ?? manifest?.outcome?.status ?? null,
    journeys: result?.tests_run?.length ?? null,
    verify_fail_before_first_canonical_green: traj.verify_fail_before_first_canonical_green ?? null,
    canonical_verification_count: traj.canonical_verification_count ?? null,
    scope_sequence_delivered: scope?.delivered ?? null,
    scope_sequence_anchor: scope?.anchor ?? null,
    scope_sequence_delivery: scope?.delivery ?? null,
    scope_sequence_anchor_tool_call_index: scope?.anchor_tool_call_index ?? null,
  };
});

const weightedTotals = reps.map((rep) => rep.weighted_total).filter((v) => typeof v === 'number');
const preVerify = reps
  .map((rep) => rep.weighted_before_first_canonical_verification)
  .filter((v) => typeof v === 'number');
const mutationWeighted = reps
  .map((rep) => rep.weighted_mutation_to_first_post_mutation_verify)
  .filter((v) => typeof v === 'number');
const spans = reps.map((rep) => rep.mutation_to_verify_span).filter((v) => typeof v === 'number');

console.log(
  JSON.stringify(
    {
      experiment: 'ss2-scope-sequence-v2',
      arm: 'treatment',
      official_cohort_log: 'artifacts/experiments/ss2-scope-sequence-v2/2026-09-02T16-11-00Z.log',
      ss1_comparator_frozen: {
        median_weighted_total: 60051,
        median_weighted_before_first_canonical_verification: 37607,
        median_weighted_mutation_to_first_post_mutation_verify: 8385,
        invented_scope_runs: '4/5',
        runs_ge_120k: 0,
      },
      reps,
      medians: {
        weighted_total: median(weightedTotals),
        weighted_before_first_canonical_verification: median(preVerify),
        weighted_mutation_to_first_post_mutation_verify: mutationWeighted.length
          ? median(mutationWeighted)
          : null,
        mutation_to_verify_span: spans.length ? median(spans) : null,
        calls: median(reps.map((rep) => rep.calls)),
      },
      gates: {
        a_pre_verify_primary: {
          median: median(preVerify),
          threshold: 40000,
          pass: median(preVerify) <= 40000,
        },
        a_mutation_to_verify_weighted: {
          median: mutationWeighted.length ? median(mutationWeighted) : null,
          threshold: 8000,
          pass: mutationWeighted.length ? median(mutationWeighted) <= 8000 : false,
        },
        b_median_total: {
          median: median(weightedTotals),
          threshold: 60852,
          pass: median(weightedTotals) <= 60852,
        },
        b_runs_ge_120k: {
          count: weightedTotals.filter((v) => v >= 120_000).length,
          threshold: 1,
          pass: weightedTotals.filter((v) => v >= 120_000).length <= 1,
        },
        c_runs_le_70k: {
          count: weightedTotals.filter((v) => v <= 70_000).length,
          threshold: 2,
          pass: weightedTotals.filter((v) => v <= 70_000).length >= 2,
        },
        c_best_weighted: {
          value: Math.min(...weightedTotals),
          threshold: 55000,
          pass: Math.min(...weightedTotals) <= 55000,
        },
        d_mechanism: {
          pass: reps.every((rep) => rep.scope_sequence_delivered === true),
          note: 'Verify steer delivery in events/raw-event-stream.jsonl',
        },
      },
      delivery_telemetry_note:
        'SS2 delivery=steer_before_tool_call; verify actual steer with verbatim frozen text in events/raw-event-stream.jsonl.',
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

  for file in idea.txt result.json run-manifest.json app-test-results.json scope-sequence.v2.json; do
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
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/ss2-scope-sequence-v2"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T16-11-00Z-official.log"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

cp "docs/v2/control-floor/experiment-scope-sequence-v2-preregistration.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/experiment-scope-sequence-v1-preregistration.md" "$STAGING_DIR/docs/"

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id" "ss2-scope-sequence-v2"
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
  description: 'SS2 scope-sequence-v2 treatment cohort (official 5/5 reps). A/B timing vs frozen SS1 comparator.',
  experiment: 'ss2-scope-sequence-v2',
  preregistration: 'docs/v2/control-floor/experiment-scope-sequence-v2-preregistration.md',
  ss1_comparator: 'docs/experiment-scope-sequence-v1-preregistration.md (frozen cohort in cohort-ss1-scope-sequence-v1-2026-09-02.zip)',
  official_experiment_log: 'experiment-logs/2026-09-02T16-11-00Z-official.log',
  ss1_comparator_frozen: summary.ss1_comparator_frozen,
  cohort_summary: summary,
  runs: summary.reps.map((rep, index) => ({
    run_id: rep.run_id,
    cohort_path: 'ss2-scope-sequence-v2/' + rep.run_id,
    label:
      'SS2 Scope Sequence v2 — Rep ' +
      (index + 1) +
      ' (' +
      Math.round(rep.weighted_total).toLocaleString() +
      ' weighted, ' +
      rep.calls +
      ' calls)',
    rep: index + 1,
    status: rep.result_status,
    scope_sequence_delivered: rep.scope_sequence_delivered,
    scope_sequence_anchor: rep.scope_sequence_anchor,
    scope_sequence_delivery: rep.scope_sequence_delivery,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# SS2 Scope & Sequence v2 cohort export

Official treatment cohort: **5/5 OK** (\`artifacts/experiments/ss2-scope-sequence-v2/2026-09-02T16-11-00Z.log\`).

**Comparator (frozen, no re-run):** SS1 cohort \`cohort-ss1-scope-sequence-v1-2026-09-02.zip\` — median total **60,051**, invented scope **4/5**, mutation→VERIFY **8,385**.

See \`cohort-summary.json\` for rep-level metrics. Confirm SS2 steer delivery in \`runs/*/events/raw-event-stream.jsonl\` (verbatim frozen text before first \`src/App.tsx\` write/edit).
EOF

mkdir -p "$REPO_ROOT/artifacts/exports"
REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/ss2-scope-sequence-v2-staging")
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
