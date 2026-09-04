/**
 * Post-mutation early VERIFY metrics for Q2-D (ledger + export + trajectory).
 */

import type { CallLedger } from "./normalize.js";
import type { TrajectoryMetrics, VerificationRunSnapshot } from "./trajectory-metrics.js";
import {
  countAuthoredTestsFromSources,
  isQualifyingTestFile,
  readEarlyVerifyExportFromRun,
  type EarlyVerifyExport,
} from "../../solution/extensions/early-verify-core.js";

export interface EarlyVerifyRunMetrics {
  first_test_mutation_call: number | null;
  first_test_mutation_paths: string[];
  first_post_mutation_canonical_verify_call: number | null;
  first_post_mutation_canonical_verify_source: "auto_early_v1" | "pi_verify" | "bash" | null;
  first_post_mutation_canonical_verify_outcome: "pass" | "fail" | "unknown" | null;
  authored_test_count_at_first_post_mutation_verify: number | null;
  test_loc_at_first_post_mutation_verify: number | null;
  authored_test_count_from_vitest_at_anchor: number | null;
  weighted_mutation_to_first_post_mutation_verify: number | null;
  weighted_to_first_post_mutation_verify: number | null;
  run_end_authored_test_count: number | null;
  run_end_journey_test_count: number | null;
  total_canonical_verify_count: number;
  canonical_verify_count_after_first_mutation: number;
  auto_early_verify_fired: boolean;
  early_verify_error: boolean;
  export: EarlyVerifyExport | null;
}

function isTestPathCandidate(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return isQualifyingTestFile(normalized) || /src\/.*\.test\.tsx?/i.test(normalized);
}

export function inferFirstTestMutationCallFromLedger(ledger: CallLedger): {
  call_index: number | null;
  paths: string[];
} {
  for (const call of ledger.calls) {
    const paths = new Set<string>();
    for (const tool of call.tools) {
      if (tool.name === "write" || tool.name === "edit") {
        for (const candidate of [...tool.paths, tool.detail]) {
          if (candidate && isTestPathCandidate(candidate)) paths.add(candidate.replace(/\\/g, "/"));
        }
      }
      if (tool.name === "bash" && /\.test\.(ts|tsx)/i.test(tool.detail)) {
        const match = /src\/[^\s'"]+\.test\.tsx?/i.exec(tool.detail);
        if (match?.[0]) paths.add(match[0]);
      }
    }
    if (paths.size > 0) {
      return { call_index: call.index, paths: [...paths].sort() };
    }
  }
  return { call_index: null, paths: [] };
}

function verificationSource(run: VerificationRunSnapshot): "auto_early_v1" | "pi_verify" | "bash" {
  if (run.raw_summary?.includes("verify_source: auto_early_v1")) return "auto_early_v1";
  if (run.source === "verify") return "pi_verify";
  return "bash";
}

export function findFirstPostMutationCanonicalVerify(
  trajectory: TrajectoryMetrics,
  mutationCall: number | null,
): VerificationRunSnapshot | null {
  if (mutationCall === null) return null;
  return (
    trajectory.verification_runs.find(
      (run) => run.canonical && run.call_index >= mutationCall,
    ) ?? null
  );
}

export function buildEarlyVerifyRunMetrics(input: {
  ledger: CallLedger;
  trajectory: TrajectoryMetrics;
  runDirectory: string;
  runEndJourneyTestCount?: number | null;
  runEndAuthoredTestCount?: number | null;
}): EarlyVerifyRunMetrics {
  const exportData = readEarlyVerifyExportFromRun(input.runDirectory);
  const inferred = inferFirstTestMutationCallFromLedger(input.ledger);
  const mutationCall =
    exportData?.first_test_mutation_tool_result_index !== null &&
    exportData?.first_test_mutation_tool_result_index !== undefined
      ? mapToolResultIndexToCallIndex(input.ledger, exportData.first_test_mutation_tool_result_index)
      : inferred.call_index;

  const firstPost = findFirstPostMutationCanonicalVerify(input.trajectory, mutationCall);
  const mutationLedgerCall =
    mutationCall === null ? null : input.ledger.calls.find((call) => call.index === mutationCall) ?? null;
  const postLedgerCall =
    firstPost === null
      ? null
      : input.ledger.calls.find((call) => call.index === firstPost.call_index) ?? null;

  const exportAuthored = exportData?.auto_early_verify?.authored_test_count_at_mutation ?? null;
  const vitestAnchorTotal = firstPost?.total ?? null;

  return {
    first_test_mutation_call: mutationCall,
    first_test_mutation_paths: exportData?.first_test_mutation_paths.length
      ? exportData.first_test_mutation_paths
      : inferred.paths,
    first_post_mutation_canonical_verify_call: firstPost?.call_index ?? null,
    first_post_mutation_canonical_verify_source: firstPost ? verificationSource(firstPost) : null,
    first_post_mutation_canonical_verify_outcome: firstPost?.canonical_outcome ?? null,
    authored_test_count_at_first_post_mutation_verify: exportAuthored,
    test_loc_at_first_post_mutation_verify: exportData?.auto_early_verify?.test_loc_at_mutation ?? null,
    authored_test_count_from_vitest_at_anchor: vitestAnchorTotal,
    weighted_mutation_to_first_post_mutation_verify:
      mutationLedgerCall && postLedgerCall
        ? postLedgerCall.cumulative_weighted - mutationLedgerCall.cumulative_weighted
        : null,
    weighted_to_first_post_mutation_verify: postLedgerCall?.cumulative_weighted ?? null,
    run_end_authored_test_count: input.runEndAuthoredTestCount ?? null,
    run_end_journey_test_count: input.runEndJourneyTestCount ?? null,
    total_canonical_verify_count: input.trajectory.canonical_verification_count,
    canonical_verify_count_after_first_mutation:
      mutationCall === null
        ? 0
        : input.trajectory.verification_runs.filter(
            (run) => run.canonical && run.call_index >= mutationCall,
          ).length,
    auto_early_verify_fired: exportData?.auto_early_verify_fired ?? false,
    early_verify_error: exportData?.early_verify_error ?? false,
    export: exportData,
  };
}

function mapToolResultIndexToCallIndex(ledger: CallLedger, toolResultIndex: number): number | null {
  let seen = 0;
  for (const call of ledger.calls) {
    seen += call.tools.length;
    if (seen >= toolResultIndex) return call.index;
  }
  return ledger.calls.at(-1)?.index ?? null;
}

export function mergeAutoEarlyVerifyIntoTrajectory(
  trajectory: TrajectoryMetrics,
  exportData: EarlyVerifyExport | null,
  ledger: CallLedger,
): TrajectoryMetrics {
  if (!exportData?.auto_early_verify) return trajectory;
  const auto = exportData.auto_early_verify;
  const alreadyPresent = trajectory.verification_runs.some((run) =>
    run.raw_summary?.includes("verify_source: auto_early_v1"),
  );
  if (alreadyPresent) return trajectory;

  const callIndex = mapToolResultIndexToCallIndex(ledger, auto.tool_result_index);
  if (callIndex === null) return trajectory;

  const passed = auto.output.match(/(?:✅|❌)\s*(PASS|FAIL)\s*(\d+)\/(\d+)/iu);
  const verifyRun: VerificationRunSnapshot = {
    call_index: callIndex,
    source: "verify",
    command: "verify",
    piped: false,
    canonical: true,
    sidecar: false,
    exit_code_trusted: true,
    verify_exit_code: auto.exit_code,
    passed: passed?.[2] ? Number(passed[2]) : null,
    total: passed?.[3] ? Number(passed[3]) : null,
    pass_ratio:
      passed?.[2] && passed?.[3] && Number(passed[3]) > 0
        ? Number(passed[2]) / Number(passed[3])
        : null,
    suite_error: /FAIL\s*0\/0|suite did not run|SUITE_ERROR/iu.test(auto.output),
    canonical_outcome: auto.exit_code === 0 ? "pass" : "fail",
    raw_summary: auto.output.slice(0, 120),
  };

  const verificationRuns = [...trajectory.verification_runs, verifyRun].sort(
    (a, b) => a.call_index - b.call_index || 0,
  );

  return {
    ...trajectory,
    verify_tool_count: trajectory.verify_tool_count + 1,
    canonical_verification_count: trajectory.canonical_verification_count + 1,
    verification_runs: verificationRuns,
    suite_runs: verificationRuns,
  };
}

export { countAuthoredTestsFromSources };
