/**
 * Cohort summary for test-authoring-guard-v1 experiment.
 * Usage: node --import tsx scripts/summarize-test-authoring-guard-cohort.ts [log-file]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { scanTestDirectory } from "../solution/extensions/test-authoring-scan.js";

const RUN_IDS = [
  "2026-09-01T23-23-10-013Z",
  "2026-09-01T23-26-24-352Z",
  "2026-09-01T23-28-52-670Z",
  "2026-09-01T23-33-08-008Z",
  "2026-09-01T23-38-35-782Z",
];

interface VerificationRun {
  call_index: number;
  raw_summary: string;
  canonical_outcome: string;
  verify_exit_code: number | null;
  passed: number | null;
  total: number | null;
}

interface TrajectoryV2 {
  run_id: string;
  weighted_total: number;
  model_calls: number;
  verify_fail_before_first_canonical_green: number;
  weighted_before_first_canonical_verification: number;
  verification_runs: VerificationRun[];
}

interface LedgerCall {
  index: number;
  cumulative_weighted: number;
}

interface LedgerFile {
  calls: LedgerCall[];
}

function isGuardBlock(run: VerificationRun): boolean {
  return run.raw_summary.includes("guard_result: BLOCKED");
}

function guardPattern(run: VerificationRun): string | null {
  const match = /guard_violation:\s*(F[1-6]|SCAN_ERROR)/.exec(run.raw_summary);
  return match?.[1] ?? null;
}

function analyzeRun(runId: string) {
  const analysisDir = path.resolve("artifacts/analysis", runId);
  const runDir = path.resolve("artifacts/runs", runId);
  const trajectory = JSON.parse(
    readFileSync(path.join(analysisDir, "trajectory.v2.json"), "utf8"),
  ) as TrajectoryV2;
  const ledger = JSON.parse(
    readFileSync(path.join(analysisDir, "ledger.json"), "utf8"),
  ) as LedgerFile;
  const result = JSON.parse(readFileSync(path.join(runDir, "result.json"), "utf8")) as {
    status: string;
    tests_run: unknown[];
  };

  const verifyRuns = trajectory.verification_runs;
  const guardBlocks = verifyRuns.filter(isGuardBlock);
  const guardBlocksByPattern: Record<string, number> = {};
  for (const block of guardBlocks) {
    const pattern = guardPattern(block) ?? "unknown";
    guardBlocksByPattern[pattern] = (guardBlocksByPattern[pattern] ?? 0) + 1;
  }

  const firstAllowed = verifyRuns.find((run) => !isGuardBlock(run));
  const blocksBeforeFirstAllowed = firstAllowed
    ? guardBlocks.filter((run) => run.call_index < firstAllowed.call_index).length
    : guardBlocks.length;

  const firstAllowedPass =
    firstAllowed?.canonical_outcome === "pass" || firstAllowed?.raw_summary.includes("(PASS)");

  let preVerifyToFirstAllowed = trajectory.weighted_before_first_canonical_verification;
  if (firstAllowed) {
    const call = ledger.calls.find((entry) => entry.index === firstAllowed.call_index);
    if (call) preVerifyToFirstAllowed = call.cumulative_weighted;
  }

  const f6Final = existsSync(path.join(runDir, "app"))
    ? scanTestDirectory(path.join(runDir, "app")).reportOnlyHits.length
    : 0;

  return {
    run_id: runId,
    weighted: Math.round(trajectory.weighted_total),
    calls: trajectory.model_calls,
    guard_blocks_total: guardBlocks.length,
    guard_blocks_before_first_allowed: blocksBeforeFirstAllowed,
    guard_blocks_by_pattern: guardBlocksByPattern,
    first_allowed_verify_call: firstAllowed?.call_index ?? null,
    first_allowed_verify_outcome: firstAllowed?.canonical_outcome ?? null,
    first_allowed_verify_pass: firstAllowedPass ?? false,
    first_allowed_verify_summary: firstAllowed?.raw_summary.slice(0, 120) ?? null,
    pre_verify_weighted_to_first_allowed: Math.round(preVerifyToFirstAllowed),
    verify_fails_before_green: trajectory.verify_fail_before_first_canonical_green,
    canonical_unknown_before_green: trajectory.canonical_unknown_before_first_canonical_green,
    verify_tool_count: verifyRuns.length,
    result_status: result.status,
    journeys: result.tests_run?.length ?? 0,
    f6_hits_final_app: f6Final,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

const reps = RUN_IDS.map(analyzeRun);
const medians = {
  weighted: median(reps.map((r) => r.weighted)),
  calls: median(reps.map((r) => r.calls)),
  guard_blocks_before_first_allowed: median(reps.map((r) => r.guard_blocks_before_first_allowed)),
  pre_verify_to_first_allowed: median(reps.map((r) => r.pre_verify_weighted_to_first_allowed)),
  verify_fails: median(reps.map((r) => r.verify_fails_before_green)),
};

const firstAllowedPassCount = reps.filter((r) => r.first_allowed_verify_pass).length;
const over140k = reps.filter((r) => r.weighted > 140_000).length;
const over45kPre = reps.filter((r) => r.pre_verify_weighted_to_first_allowed > 45_000).length;
const over4Blocks = reps.filter((r) => r.guard_blocks_before_first_allowed > 4).length;

console.log(
  JSON.stringify(
    {
      experiment: "test-authoring-guard-v1",
      reps,
      medians,
      prereg_gates: {
        first_allowed_pass: `${firstAllowedPassCount}/5 (need ≥3/5)`,
        median_guard_blocks_before_first_allowed: `${medians.guard_blocks_before_first_allowed} (need ≤2)`,
        median_pre_verify_to_first_allowed: `${medians.pre_verify_to_first_allowed} (need ≤45000)`,
        median_weighted: `${medians.weighted} (need ≤70000)`,
        runs_over_140k: `${over140k}/5 (need 0/5)`,
        runs_over_45k_pre_allowed: `${over45kPre}/5`,
        runs_over_4_guard_blocks: `${over4Blocks}/5 (need ≤1/5)`,
      },
    },
    null,
    2,
  ),
);
