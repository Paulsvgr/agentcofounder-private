import { writeFileSync } from "node:fs";
import path from "node:path";

interface CohortRep {
  run_id: string;
  weighted: number;
  calls: number;
  guard_blocks_total: number;
  guard_blocks_before_first_allowed: number;
  guard_blocks_by_pattern: Record<string, number>;
  first_allowed_verify_call: number | null;
  first_allowed_verify_pass: boolean;
  pre_verify_weighted_to_first_allowed: number;
  verify_fails_before_green: number;
  result_status: string;
  journeys: number;
}

interface CohortSummary {
  reps: CohortRep[];
  medians: {
    weighted: number;
    calls: number;
    guard_blocks_before_first_allowed: number;
    pre_verify_to_first_allowed: number;
    verify_fails: number;
  };
}

const stagingDir = process.argv[2];
const exportName = process.argv[3];
const summary = JSON.parse(process.argv[4]!) as CohortSummary;

const runs = summary.reps.map((rep, index) => ({
  run_id: rep.run_id,
  cohort_path: `test-authoring-guard-v1/${rep.run_id}`,
  label: `Q2-C Test Authoring Guard v1 — Rep ${index + 1} (${rep.weighted.toLocaleString()} weighted, ${rep.calls} calls)`,
  rep: index + 1,
  source_run_directory: `artifacts/runs/${rep.run_id}`,
  source_analysis_directory: `artifacts/analysis/${rep.run_id}`,
  status: rep.result_status,
  model_calls: rep.calls,
  weighted_total: rep.weighted,
  guard_blocks_total: rep.guard_blocks_total,
  guard_blocks_before_first_allowed: rep.guard_blocks_before_first_allowed,
  guard_blocks_by_pattern: rep.guard_blocks_by_pattern,
  first_allowed_verify_pass: rep.first_allowed_verify_pass,
  pre_verify_weighted_to_first_allowed: rep.pre_verify_weighted_to_first_allowed,
  verify_fail_before_first_canonical_green: rep.verify_fails_before_green,
  journeys_in_tests_run: rep.journeys,
  harness_script_ok: true,
  has_session: true,
  has_events: true,
  has_app: true,
  has_analysis: true,
  analysis_files: [
    "ledger.json",
    "reconcile.json",
    "station.html",
    "station.json",
    "trajectory.json",
    "trajectory.v2.json",
  ],
}));

const manifest = {
  export_name: exportName,
  generated_at: new Date().toISOString(),
  description:
    "Raw run artifacts for Q2-C Test Authoring Guard v1 experiment (v2.2 OFF/OFF + HARNESS_TEST_AUTHORING_GUARD_V1). Five treatment reps from 2026-09-01.",
  run_count: 5,
  cohorts: {
    "test-authoring-guard-v1": 5,
  },
  experiment_logs: {
    "test-authoring-guard-v1": "artifacts/experiments/test-authoring-guard-v1/2026-09-01T23-23-04Z.log",
  },
  preregistration: "docs/v2/control-floor/experiment-test-authoring-guard-v1-preregistration.md",
  cohort_summary: {
    median_weighted_total: summary.medians.weighted,
    weighted_range: [
      Math.min(...summary.reps.map((rep) => rep.weighted)),
      Math.max(...summary.reps.map((rep) => rep.weighted)),
    ],
    median_guard_blocks_before_first_allowed: summary.medians.guard_blocks_before_first_allowed,
    median_pre_verify_weighted_to_first_allowed: summary.medians.pre_verify_to_first_allowed,
    median_verify_fail_before_first_canonical_green: summary.medians.verify_fails,
    first_allowed_verify_pass_reps: summary.reps.filter((rep) => rep.first_allowed_verify_pass).length,
    runs_over_140k_weighted: summary.reps.filter((rep) => rep.weighted > 140_000).length,
    harness_script_ok_runs: 5,
  },
  layout: {
    "result.json": "Final tokens, calls, status, harness checks, timing",
    "sessions/pi-session.jsonl": "Full Pi agent session (canonical name)",
    "events/raw-event-stream.jsonl": "Harness event stream with verify tool, guard blocks, pipes",
    "app/": "Generated app source (node_modules excluded)",
    "analysis/": "ledger.json, trajectory.json, trajectory.v2.json, reconcile.json, station.json, station.html",
    "logs/": "pi.stderr.log, app-test.log, app-build.log, app-dev.log",
    "cohort-summary.json": "Frozen prereg gate metrics from summarize-test-authoring-guard-cohort.ts",
  },
  runs,
};

const readme = `# Q2-C — Test Authoring Guard v1 cohort export

Experiment: **test-authoring-guard-v1** (v2.2 OFF/OFF + HARNESS_TEST_AUTHORING_GUARD_V1)

Preregistration: \`docs/v2/control-floor/experiment-test-authoring-guard-v1-preregistration.md\`

## Cohort (5 runs)

| Rep | Run ID | Weighted | Calls | Guard blocks | First allowed VERIFY | Pre-VERIFY | VERIFY fails | Status | Journeys |
|-----|--------|----------|-------|--------------|----------------------|------------|--------------|--------|----------|
${summary.reps
  .map(
    (rep, index) =>
      `| ${index + 1} | \`${rep.run_id}\` | ${rep.weighted.toLocaleString()} | ${rep.calls} | ${rep.guard_blocks_before_first_allowed} | ${rep.first_allowed_verify_pass ? "PASS" : "FAIL"} | ${rep.pre_verify_weighted_to_first_allowed.toLocaleString()} | ${rep.verify_fails_before_green} | ${rep.result_status} | ${rep.journeys} |`,
  )
  .join("\n")}

**Median weighted:** ${summary.medians.weighted.toLocaleString()}

**First allowed VERIFY pass:** ${summary.reps.filter((rep) => rep.first_allowed_verify_pass).length}/5

**Median guard blocks before first allowed VERIFY:** ${summary.medians.guard_blocks_before_first_allowed}

**Median pre-VERIFY to first allowed:** ${summary.medians.pre_verify_to_first_allowed.toLocaleString()}

Log: \`artifacts/experiments/test-authoring-guard-v1/2026-09-01T23-23-04Z.log\`

## Per-run layout

See \`MANIFEST.json\` and \`cohort-summary.json\`.
`;

writeFileSync(path.join(stagingDir, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(stagingDir, "README.md"), readme);
