#!/usr/bin/env bash
# Export ss2b-scope-sequence-v2b official cohort to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-ss2b-scope-sequence-v2b-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/ss2b-scope-sequence-v2b-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T20-42-04Z.log"
RETAKE_LOG="artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T21-04-rep4-5-retake-balance.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T20-42-09-965Z"
  "2026-09-02T20-46-32-277Z"
  "2026-09-02T20-50-34-924Z"
  "2026-09-02T21-04-40-061Z"
  "2026-09-02T21-08-50-360Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL = [
  '2026-09-02T20-42-09-965Z',
  '2026-09-02T20-46-32-277Z',
  '2026-09-02T20-50-34-924Z',
  '2026-09-02T21-04-40-061Z',
  '2026-09-02T21-08-50-360Z',
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
  const scopePath = path.join('artifacts/runs', runId, 'scope-sequence.v2b.json');
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : null;
  const traj = existsSync(trajPath) ? JSON.parse(readFileSync(trajPath, 'utf8')) : null;
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const scope = existsSync(scopePath) ? JSON.parse(readFileSync(scopePath, 'utf8')) : null;
  const lastCall = ledger?.calls?.at(-1);
  const firstVerify = traj?.verification_runs?.find((r) => r.canonical)?.call_index ?? null;
  const firstTestMut = ledger ? firstTestMutationCall(ledger) : null;
  const mutationToVerifySpan =
    firstTestMut !== null && firstVerify !== null ? firstVerify - firstTestMut : null;
  const wMut = firstTestMut !== null && ledger ? weightedAtCall(ledger, firstTestMut) : null;
  const wVerify = firstVerify !== null && ledger ? weightedAtCall(ledger, firstVerify) : null;

  return {
    rep: index + 1,
    run_id: runId,
    harness_ok: result?.status === 'success',
    pinned_commit: manifest?.git?.commit ?? null,
    calls: ledger?.calls?.length ?? result?.model_calls ?? null,
    weighted_total: lastCall?.cumulative_weighted ?? manifest?.outcome?.weighted_cost ?? null,
    weighted_before_first_canonical_verification:
      traj?.weighted_before_first_canonical_verification ?? null,
    weighted_mutation_to_first_post_mutation_verify:
      wMut !== null && wVerify !== null ? wVerify - wMut : null,
    mutation_to_verify_span: mutationToVerifySpan,
    first_canonical_verify_call: firstVerify,
    result_status: result?.status ?? manifest?.outcome?.status ?? null,
    journeys: result?.tests_run?.length ?? null,
    verify_fail_before_first_canonical_green: traj?.verify_fail_before_first_canonical_green ?? null,
    canonical_verification_count: traj?.canonical_verification_count ?? null,
    scope_sequence_delivered: scope?.delivered ?? null,
    scope_sequence_anchor: scope?.anchor ?? null,
    scope_sequence_anchor_path: scope?.anchor_path ?? null,
    scope_sequence_delivery: scope?.delivery ?? null,
    scope_sequence_anchor_tool_call_index: scope?.anchor_tool_call_index ?? null,
  };
});

const okReps = reps.filter((rep) => rep.harness_ok);
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
      experiment: 'ss2b-scope-sequence-v2b',
      arm: 'treatment',
      official_cohort_log: 'artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T20-42-04Z.log',
      harness_ok: \`\${okReps.length}/5\`,
      ss1_comparator_frozen: {
        median_weighted_total: 60051,
        median_weighted_before_first_canonical_verification: 37607,
        median_weighted_mutation_to_first_post_mutation_verify: 8385,
        invented_scope_runs: '4/5',
        runs_ge_120k: 0,
        runs_le_70k: 4,
      },
      ss2_comparator_frozen: {
        median_weighted_total: 125684,
        median_weighted_before_first_canonical_verification: 50958,
        median_weighted_mutation_to_first_post_mutation_verify: 2815,
        invented_scope_runs: '0/5',
        runs_ge_120k: 3,
        runs_le_70k: 1,
      },
      reps,
      medians: {
        weighted_total: weightedTotals.length ? median(weightedTotals) : null,
        weighted_before_first_canonical_verification: preVerify.length ? median(preVerify) : null,
        weighted_mutation_to_first_post_mutation_verify: mutationWeighted.length
          ? median(mutationWeighted)
          : null,
        mutation_to_verify_span: spans.length ? median(spans) : null,
        calls: reps.length ? median(reps.map((rep) => rep.calls).filter((v) => typeof v === 'number')) : null,
      },
      tails: {
        runs_le_70k: weightedTotals.filter((v) => v <= 70_000).length,
        runs_ge_120k: weightedTotals.filter((v) => v >= 120_000).length,
        best_weighted: weightedTotals.length ? Math.min(...weightedTotals) : null,
        worst_weighted: weightedTotals.length ? Math.max(...weightedTotals) : null,
      },
      mechanism: {
        delivered_among_all_reps: reps.filter((rep) => rep.scope_sequence_delivered === true).length,
        delivered_among_ok_reps: okReps.filter((rep) => rep.scope_sequence_delivered === true).length,
        anchor_paths: reps.map((rep) => rep.scope_sequence_anchor_path),
      },
      gates: {
        a_pre_verify_primary: {
          median: preVerify.length ? median(preVerify) : null,
          threshold: 40000,
          pass: preVerify.length ? median(preVerify) <= 40000 : false,
        },
        b_median_total: {
          median: weightedTotals.length ? median(weightedTotals) : null,
          threshold: 60852,
          pass: weightedTotals.length ? median(weightedTotals) <= 60852 : false,
        },
        b_runs_ge_120k: {
          count: weightedTotals.filter((v) => v >= 120_000).length,
          threshold: 0,
          pass: weightedTotals.filter((v) => v >= 120_000).length === 0,
        },
        c_runs_le_70k: {
          count: weightedTotals.filter((v) => v <= 70_000).length,
          threshold: 4,
          pass: weightedTotals.filter((v) => v <= 70_000).length >= 4,
        },
      },
      rep4_rep5_retake_log: 'artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T21-04-rep4-5-retake-balance.log',
      note:
        'Reps 4-5 retaken after API balance recharge (original 429 failures). Official cohort is 5/5 harness OK.',
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

  for file in idea.txt result.json run-manifest.json app-test-results.json scope-sequence.v2b.json; do
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
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/ss2b-scope-sequence-v2b"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T20-42-04Z-official.log"
if [ -f "$RETAKE_LOG" ]; then
  cp "$RETAKE_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T21-04-rep4-5-retake-balance.log"
fi
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

cp "docs/v2/control-floor/experiment-scope-sequence-v2b-preregistration.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/experiment-scope-sequence-v2-preregistration.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/experiment-scope-sequence-v1-preregistration.md" "$STAGING_DIR/docs/"

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id" "ss2b-scope-sequence-v2b"
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
    'SS2b scope-sequence-v2b treatment cohort (5/5 harness OK; reps 4-5 retaken after API balance recharge). Broad pre-code anchor vs frozen SS1/SS2 comparators.',
  experiment: 'ss2b-scope-sequence-v2b',
  preregistration: 'docs/v2/control-floor/experiment-scope-sequence-v2b-preregistration.md',
  ss1_comparator: 'cohort-ss1-scope-sequence-v1-2026-09-02.zip (frozen)',
  ss2_comparator: 'cohort-ss2-scope-sequence-v2-2026-09-02.zip (frozen)',
  official_experiment_log: 'experiment-logs/2026-09-02T20-42-04Z-official.log',
  cohort_summary: summary,
  runs: summary.reps.map((rep) => ({
    run_id: rep.run_id,
    cohort_path: 'ss2b-scope-sequence-v2b/' + rep.run_id,
    label:
      'SS2b Scope Sequence v2b — Rep ' +
      rep.rep +
      ' (' +
      (rep.weighted_total ? Math.round(rep.weighted_total).toLocaleString() : '0') +
      ' weighted, ' +
      (rep.calls ?? '?') +
      ' calls, harness=' +
      rep.result_status +
      ')',
    rep: rep.rep,
    status: rep.result_status,
    harness_ok: rep.harness_ok,
    scope_sequence_delivered: rep.scope_sequence_delivered,
    scope_sequence_anchor_path: rep.scope_sequence_anchor_path,
    scope_sequence_delivery: rep.scope_sequence_delivery,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# SS2b Scope & Sequence v2b cohort export

Official treatment cohort: **5/5 harness OK** (\`artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T20-42-04Z.log\` + rep 4-5 retake \`2026-09-02T21-04-rep4-5-retake-balance.log\`).

**Frozen comparators (no re-run):**
- SS1 \`cohort-ss1-scope-sequence-v1-2026-09-02.zip\` — median total **60,051**, invented scope **4/5**
- SS2 \`cohort-ss2-scope-sequence-v2-2026-09-02.zip\` — median total **125,684**, invented scope **0/5**

See \`cohort-summary.json\` for rep-level metrics. Confirm SS2b steer in \`runs/*/sessions/pi-session.jsonl\` (\`customType: harness_scope_sequence_v2b\`).

**Reps 4–5:** Retaken after API 429 balance exhaustion on first attempt; see \`experiment-logs/2026-09-02T21-04-rep4-5-retake-balance.log\`.
EOF

mkdir -p "$REPO_ROOT/artifacts/exports"
REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/ss2b-scope-sequence-v2b-staging")
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
