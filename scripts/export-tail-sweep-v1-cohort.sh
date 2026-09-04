#!/usr/bin/env bash
# Export tail-sweep-v1 official cohort to ZIP.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXPORT_DATE="${EXPORT_DATE:-2026-09-02}"
EXPORT_NAME="cohort-tail-sweep-v1-${EXPORT_DATE}"
STAGING_DIR="$REPO_ROOT/artifacts/exports/tail-sweep-v1-staging"
ZIP_PATH="$REPO_ROOT/artifacts/exports/${EXPORT_NAME}.zip"

OFFICIAL_LOG="artifacts/experiments/tail-sweep-v1/2026-09-02T22-18-12Z.log"

OFFICIAL_RUN_IDS=(
  "2026-09-02T22-18-20-544Z"
  "2026-09-02T22-22-38-277Z"
  "2026-09-02T22-27-48-249Z"
  "2026-09-02T22-35-34-360Z"
  "2026-09-02T22-39-35-536Z"
)

COHORT_JSON="$(node --import tsx -e "
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL = [
  '2026-09-02T22-18-20-544Z',
  '2026-09-02T22-22-38-277Z',
  '2026-09-02T22-27-48-249Z',
  '2026-09-02T22-35-34-360Z',
  '2026-09-02T22-39-35-536Z',
];

const V22_BASELINE_MEDIAN = 60852;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function postReportMetrics(runId) {
  const eventsPath = path.join('artifacts/runs', runId, 'events.jsonl');
  if (!existsSync(eventsPath)) return { report_turn: null, post_report_calls: null, post_report_weighted: null };
  const lines = readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean);
  let turn = 0;
  let reportTurn = null;
  const turns = [];
  for (const line of lines) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      e.type === 'tool_execution_end' &&
      e.toolName === 'write' &&
      JSON.stringify(e).includes('report.partial.json')
    ) {
      reportTurn = turn + 1;
    }
    if (e.type === 'turn_end') {
      turn += 1;
      const u = e.message?.usage || {};
      turns.push({
        turn,
        w: (u.input || 0) + (u.output || 0) * 3 + (u.cacheRead || 0) * 0.1,
      });
    }
  }
  const post = reportTurn ? turns.filter((t) => t.turn > reportTurn) : [];
  return {
    report_turn: reportTurn,
    post_report_calls: post.length,
    post_report_weighted: Math.round(post.reduce((a, b) => a + b.w, 0)),
  };
}

const reps = OFFICIAL.map((runId, index) => {
  const resultPath = path.join('artifacts/runs', runId, 'result.json');
  const manifestPath = path.join('artifacts/runs', runId, 'run-manifest.json');
  const sweepPath = path.join('artifacts/runs', runId, 'tail-sweep.v1.json');
  const trajPath = path.join('artifacts/analysis', runId, 'trajectory.v2.json');
  const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const sweep = existsSync(sweepPath) ? JSON.parse(readFileSync(sweepPath, 'utf8')) : null;
  const traj = existsSync(trajPath) ? JSON.parse(readFileSync(trajPath, 'utf8')) : null;
  const i = result?.input_tokens ?? 0;
  const o = result?.output_tokens ?? 0;
  const cr = result?.cache_read_tokens ?? 0;
  const weighted = Math.floor(i + o * 3 + cr * 0.1);
  const post = postReportMetrics(runId);
  const overlays = manifest?.template_overlays?.active ?? null;

  return {
    rep: index + 1,
    run_id: runId,
    harness_ok: result?.status === 'success',
    result_status: result?.status ?? null,
    pinned_commit: manifest?.git?.commit ?? null,
    calls: result?.model_calls ?? null,
    weighted_total: weighted,
    input_tokens: i,
    output_tokens: o,
    cache_read_tokens: cr,
    cache_hit_rate: i + cr > 0 ? cr / (i + cr) : null,
    journeys: result?.tests_run?.length ?? null,
    weighted_before_first_canonical_verification:
      traj?.weighted_before_first_canonical_verification ?? null,
    tail_sweep_fired: sweep?.fired ?? null,
    tail_sweep_passed: sweep?.passed ?? null,
    tail_sweep_tool_result_index: sweep?.tool_result_index ?? null,
    report_turn: post.report_turn,
    post_report_calls: post.post_report_calls,
    post_report_weighted: post.post_report_weighted,
    overlays,
  };
});

const okReps = reps.filter((rep) => rep.harness_ok);
const weightedTotals = reps.map((rep) => rep.weighted_total).filter((v) => typeof v === 'number');
const hits = reps.map((rep) => rep.cache_hit_rate).filter((v) => typeof v === 'number');
const postCalls = reps.map((rep) => rep.post_report_calls).filter((v) => typeof v === 'number');
const postW = reps.map((rep) => rep.post_report_weighted).filter((v) => typeof v === 'number');

console.log(
  JSON.stringify(
    {
      experiment: 'tail-sweep-v1',
      arm: 'treatment',
      baseline: 'control-floor-v2.2 (HARNESS_OWNED_VERIFY=1, all overlays OFF)',
      official_cohort_log: 'artifacts/experiments/tail-sweep-v1/2026-09-02T22-18-12Z.log',
      harness_ok: \`\${okReps.length}/5\`,
      v22_comparator_frozen: {
        median_weighted_total: V22_BASELINE_MEDIAN,
        note: 'harness-owned-verify-v1-1 cohort median (2026-08-31)',
      },
      reps,
      medians: {
        weighted_total: weightedTotals.length ? median(weightedTotals) : null,
        calls: median(reps.map((r) => r.calls).filter((v) => typeof v === 'number')),
        cache_hit_rate: hits.length ? median(hits) : null,
        post_report_calls: postCalls.length ? median(postCalls) : null,
        post_report_weighted: postW.length ? median(postW) : null,
      },
      means: {
        cache_hit_rate: hits.length ? mean(hits) : null,
      },
      tails: {
        runs_le_70k: weightedTotals.filter((v) => v <= 70_000).length,
        runs_ge_120k: weightedTotals.filter((v) => v >= 120_000).length,
        best_weighted: weightedTotals.length ? Math.min(...weightedTotals) : null,
        worst_weighted: weightedTotals.length ? Math.max(...weightedTotals) : null,
      },
      mechanism: {
        fired_among_all_reps: reps.filter((r) => r.tail_sweep_fired === true).length,
        passed_among_fired: reps.filter((r) => r.tail_sweep_passed === true).length,
        post_report_build_dev_tools: 'NONE on all 5 reps (verified from events)',
      },
      gates: {
        a_mechanism: {
          fired: reps.filter((r) => r.tail_sweep_fired === true).length,
          threshold: 5,
          pass: reps.every((r) => r.tail_sweep_fired === true),
        },
        b_functional: {
          success: okReps.length,
          threshold: 4,
          pass: okReps.length >= 4,
        },
        c_cost: {
          median: weightedTotals.length ? median(weightedTotals) : null,
          threshold: V22_BASELINE_MEDIAN,
          pass: weightedTotals.length ? median(weightedTotals) <= V22_BASELINE_MEDIAN : false,
        },
        d_tail_calls: {
          median_post_report_calls: postCalls.length ? median(postCalls) : null,
          note: 'v2.2 typical post-report calls ~2; treatment target 0-1',
        },
      },
      analysis_note:
        'Median total 113761 vs v2.2 60852 is mostly body cache-collapse (fresh input), not post-report tail. Mechanism 5/5 PASS; cost gate FAIL. Formal verdict: REVERT on cost, keep mechanism as engineering note.',
    },
    null,
    2,
  ),
);
")"

copy_run() {
  local run_id="$1"
  local dest="$STAGING_DIR/runs/tail-sweep-v1/$run_id"
  local src_run="$REPO_ROOT/artifacts/runs/$run_id"
  local src_analysis="$REPO_ROOT/artifacts/analysis/$run_id"

  mkdir -p "$dest/events" "$dest/sessions" "$dest/logs" "$dest/analysis" "$dest/app"

  for file in idea.txt result.json run-manifest.json app-test-results.json tail-sweep.v1.json; do
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
mkdir -p "$STAGING_DIR/experiment-logs" "$STAGING_DIR/docs" "$STAGING_DIR/runs/tail-sweep-v1"

cp "$OFFICIAL_LOG" "$STAGING_DIR/experiment-logs/2026-09-02T22-18-12Z-official.log"
echo "$COHORT_JSON" > "$STAGING_DIR/cohort-summary.json"

cp "docs/v2/control-floor/experiment-tail-sweep-v1-preregistration.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/tail-sweep-no-summary-prose.md" "$STAGING_DIR/docs/"
cp "docs/v2/control-floor/control-floor-v2.2-baseline.md" "$STAGING_DIR/docs/" 2>/dev/null || true

for run_id in "${OFFICIAL_RUN_IDS[@]}"; do
  copy_run "$run_id"
done

STAGING_DIR="$STAGING_DIR" EXPORT_NAME="$EXPORT_NAME" node --import tsx -e "
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const stagingDir = process.env.STAGING_DIR!;
const exportName = process.env.EXPORT_NAME!;
const summary = JSON.parse(readFileSync(path.join(stagingDir, 'cohort-summary.json'), 'utf8'));

const manifest = {
  export_name: exportName,
  generated_at: new Date().toISOString(),
  description:
    'Tail sweep v1 treatment cohort (5/5 harness OK). v2.2 + HARNESS_TAIL_SWEEP_V1 only; CSS/persistence overlays OFF.',
  experiment: 'tail-sweep-v1',
  preregistration: 'docs/v2/control-floor/experiment-tail-sweep-v1-preregistration.md',
  no_summary_prose_note: 'docs/v2/control-floor/tail-sweep-no-summary-prose.md',
  v22_comparator: 'control-floor-v2.2 median 60852 (harness-owned-verify-v1-1)',
  official_experiment_log: 'experiment-logs/2026-09-02T22-18-12Z-official.log',
  cohort_summary: summary,
  runs: summary.reps.map((rep) => ({
    run_id: rep.run_id,
    cohort_path: 'tail-sweep-v1/' + rep.run_id,
    label:
      'Tail Sweep v1 — Rep ' +
      rep.rep +
      ' (' +
      Math.round(rep.weighted_total).toLocaleString() +
      ' weighted, ' +
      (rep.calls ?? '?') +
      ' calls, harness=' +
      rep.result_status +
      ', sweep=' +
      (rep.tail_sweep_fired ? 'fired' : 'miss') +
      ')',
    rep: rep.rep,
    status: rep.result_status,
    harness_ok: rep.harness_ok,
    tail_sweep_fired: rep.tail_sweep_fired,
    tail_sweep_passed: rep.tail_sweep_passed,
    post_report_calls: rep.post_report_calls,
    post_report_weighted: rep.post_report_weighted,
  })),
};

writeFileSync(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
"

cat > "$STAGING_DIR/README.md" <<EOF
# Tail Sweep v1 cohort export

Official treatment cohort: **5/5 harness OK** (\`artifacts/experiments/tail-sweep-v1/2026-09-02T22-18-12Z.log\`).

**Config:** v2.2 + \`HARNESS_TAIL_SWEEP_V1=1\` only. CSS vocabulary, persistence, and other experiment flags **OFF**.

**Headline vs v2.2 (60,852):**
- Median weighted: **113,761** (cost gate FAIL)
- Mechanism: **5/5** \`tail-sweep.v1.json\` fired + passed
- Post-report build/dev: **0/5**
- Post-report model calls: median **1** (was ~2)

See \`cohort-summary.json\` for rep-level metrics and phase notes. Confirm harness steer in \`runs/*/sessions/pi-session.jsonl\` (\`customType: harness_tail_sweep_v1\`).
EOF

mkdir -p "$REPO_ROOT/artifacts/exports"
REPO_ROOT="$REPO_ROOT" ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import zipfile

repo = os.environ.get("REPO_ROOT", ".")
staging = os.path.join(repo, "artifacts/exports/tail-sweep-v1-staging")
zip_path = os.environ.get("ZIP_PATH")

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, staging)
            zf.write(full, arcname=os.path.join(os.path.basename(zip_path).replace(".zip", ""), arc))

print(zip_path)
print("bytes", os.path.getsize(zip_path))
PY

echo ""
echo "Exported: $ZIP_PATH"
