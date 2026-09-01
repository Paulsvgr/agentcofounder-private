import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCallLedger, buildCallLedgerFromEvents } from "../src/v2/normalize.js";
import { buildStationReport } from "../src/v2/station.js";
import { buildTrajectoryMetrics } from "../src/v2/trajectory-metrics.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VERIFY = [
  "2026-08-31T15-39-40-550Z",
  "2026-08-31T15-45-36-928Z",
  "2026-08-31T15-51-10-217Z",
  "2026-08-31T15-54-07-890Z",
  "2026-08-31T15-57-09-094Z",
];

const CONTROL = [
  "2026-08-31T12-46-51-224Z",
  "2026-08-31T12-53-10-136Z",
  "2026-08-31T12-56-26-048Z",
  "2026-08-31T12-59-28-147Z",
  "2026-08-31T13-05-01-562Z",
];

function weighted(result: Record<string, number>): number {
  return Math.round(
    (result.input_tokens ?? 0) +
      (result.output_tokens ?? 0) * 3 +
      (result.cache_read_tokens ?? 0) * 0.1,
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function countEventTools(runDirectory: string): {
  verifyCalls: number;
  bashTestCalls: number;
  blockedBashHints: number;
  buildCalls: number;
} {
  const events = readFileSync(path.join(runDirectory, "events.jsonl"), "utf8");
  let verifyCalls = 0;
  let bashTestCalls = 0;
  let blockedBashHints = 0;
  let buildCalls = 0;

  for (const line of events.split("\n")) {
    if (!line.trim()) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type === "tool_execution_end" && event.toolName === "verify") {
      verifyCalls += 1;
    }

    if (event.type === "tool_execution_end" && event.toolName === "bash") {
      const args = JSON.stringify(event.args ?? {});
      if (/\bnpm\s+(?:run\s+)?test\b|\bvitest\b/i.test(args)) bashTestCalls += 1;
      if (/\bnpm run build\b|\bvite build\b/i.test(args)) buildCalls += 1;
    }

    if (event.type === "tool_execution_end" && event.isError === true) {
      const blob = JSON.stringify(event.result ?? event);
      if (/blocked|verify tool|harness-owned/i.test(blob)) blockedBashHints += 1;
    }
  }

  return { verifyCalls, bashTestCalls, blockedBashHints, buildCalls };
}

function readVitestSummary(runDirectory: string): { total: number | null; passed: number | null } {
  const vitestPath = path.join(runDirectory, "app-test-results.json");
  if (!existsSync(vitestPath)) return { total: null, passed: null };
  const report = JSON.parse(readFileSync(vitestPath, "utf8")) as {
    numTotalTests?: number;
    numPassedTests?: number;
  };
  return {
    total: report.numTotalTests ?? null,
    passed: report.numPassedTests ?? null,
  };
}

async function analyzeRun(runId: string) {
  const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", runId);
  const result = JSON.parse(readFileSync(path.join(runDirectory, "result.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const ledger = await buildCallLedger(runDirectory);
  const trajectory = buildTrajectoryMetrics(ledger);
  const report = buildStationReport(ledger, { runResult: result as never });
  const tools = countEventTools(runDirectory);
  const vitest = readVitestSummary(runDirectory);

  const testsRun = Array.isArray(result.tests_run) ? result.tests_run.length : 0;

  return {
    run_id: runId,
    weighted: weighted(result as Record<string, number>),
    calls: result.model_calls as number,
    status: result.status as string,
    pi_exit: result.pi_exit_code as number,
    harness_all_passed: Array.isArray(result.harness_checks)
      ? (result.harness_checks as Array<{ result: string }>).every((check) => check.result === "passed")
      : false,
    tests_run_count: testsRun,
    vitest_total: vitest.total,
    vitest_passed: vitest.passed,
    verify_tool_calls: tools.verifyCalls,
    bash_test_calls: tools.bashTestCalls,
    blocked_bash_hints: tools.blockedBashHints,
    build_bash_calls: tools.buildCalls,
    piped_test_commands: trajectory.piped_test_command_count,
    bash_test_commands: trajectory.test_command_count,
    first_test_green_call: trajectory.first_test_green_call,
    first_full_green_call: trajectory.first_full_green_call,
    post_full_green_calls: trajectory.post_full_green_calls,
    debug_sidecars: trajectory.debug_test_files_created.length,
    persistence_weighted: Math.round(trajectory.persistence_related_weighted),
    activity: report.activity_summary.slice(0, 6).map((bucket) => ({
      activity: bucket.activity,
      share_pct: Math.round(bucket.share_of_total * 100),
      weighted: Math.round(bucket.weighted_cost),
    })),
  };
}

async function main(): Promise<void> {
  const verifyRows = await Promise.all(VERIFY.map(analyzeRun));
  const controlRows = await Promise.all(CONTROL.map(analyzeRun));

  const summary = {
    verify: {
      rows: verifyRows,
      median_weighted: median(verifyRows.map((row) => row.weighted)),
      median_calls: median(verifyRows.map((row) => row.calls)),
      median_verify_calls: median(verifyRows.map((row) => row.verify_tool_calls)),
      piped_test_total: verifyRows.reduce((sum, row) => sum + row.piped_test_commands, 0),
      harness_pass: verifyRows.filter((row) => row.harness_all_passed).length,
      result_success: verifyRows.filter((row) => row.status === "success").length,
    },
    control: {
      rows: controlRows,
      median_weighted: median(controlRows.map((row) => row.weighted)),
      median_calls: median(controlRows.map((row) => row.calls)),
      piped_test_total: controlRows.reduce((sum, row) => sum + row.piped_test_commands, 0),
      harness_pass: controlRows.filter((row) => row.harness_all_passed).length,
      result_success: controlRows.filter((row) => row.status === "success").length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
