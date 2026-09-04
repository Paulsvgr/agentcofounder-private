/**
 * Q2-E test-structure metrics for trajectory / analysis export.
 */

import type { CallLedger } from "./normalize.js";
import type { TrajectoryMetrics, VerificationRunSnapshot } from "./trajectory-metrics.js";
import {
  readTestStructureExportFromRun,
  type TestStructureExport,
} from "../../solution/extensions/test-structure-core.js";
import { findFirstPostMutationCanonicalVerify } from "./early-verify-metrics.js";

export interface TestStructureRunMetrics {
  first_successful_authored_test_addition_call: number | null;
  primary_anchor_canonical_verify_call: number | null;
  primary_anchor_verify_source: "pi_verify" | "bash" | null;
  primary_anchor_verify_outcome: "pass" | "fail" | "unknown" | null;
  authored_test_count_at_anchor: number | null;
  test_loc_at_anchor: number | null;
  call_span_first_addition_to_anchor: number | null;
  authored_tests_added_before_anchor: number | null;
  weighted_first_addition_to_anchor_verify: number | null;
  weighted_anchor_verify_to_first_canonical_pass: number | null;
  run_end_authored_test_count: number | null;
  run_end_journey_test_count: number | null;
  increment_guard_rejections: number;
  max_accepted_single_step_delta: number;
  skeleton_authored_count_at_start: number | null;
  test_structure_error: boolean;
  export: TestStructureExport | null;
}

function mapToolResultIndexToCallIndex(ledger: CallLedger, toolResultIndex: number): number | null {
  let seen = 0;
  for (const call of ledger.calls) {
    seen += call.tools.length;
    if (seen >= toolResultIndex) return call.index;
  }
  return ledger.calls.at(-1)?.index ?? null;
}

function verificationSource(run: VerificationRunSnapshot): "pi_verify" | "bash" {
  if (run.source === "verify") return "pi_verify";
  return "bash";
}

function findFirstCanonicalPassAfterCall(
  trajectory: TrajectoryMetrics,
  fromCall: number,
): VerificationRunSnapshot | null {
  return (
    trajectory.verification_runs.find(
      (run) => run.canonical && run.call_index >= fromCall && run.canonical_outcome === "pass",
    ) ?? null
  );
}

export function buildTestStructureRunMetrics(input: {
  ledger: CallLedger;
  trajectory: TrajectoryMetrics;
  runDirectory: string;
  runEndJourneyTestCount?: number | null;
  runEndAuthoredTestCount?: number | null;
  authoredTestCountAtAnchor?: number | null;
  testLocAtAnchor?: number | null;
}): TestStructureRunMetrics {
  const exportData = readTestStructureExportFromRun(input.runDirectory);
  const additionCall =
    exportData?.first_successful_authored_test_addition_tool_result_index !== null &&
    exportData?.first_successful_authored_test_addition_tool_result_index !== undefined
      ? mapToolResultIndexToCallIndex(
          input.ledger,
          exportData.first_successful_authored_test_addition_tool_result_index,
        )
      : null;

  const anchorVerify = findFirstPostMutationCanonicalVerify(input.trajectory, additionCall);
  const additionLedgerCall =
    additionCall === null
      ? null
      : input.ledger.calls.find((call) => call.index === additionCall) ?? null;
  const anchorLedgerCall =
    anchorVerify === null
      ? null
      : input.ledger.calls.find((call) => call.index === anchorVerify.call_index) ?? null;
  const firstPassAfterAnchor = anchorVerify
    ? findFirstCanonicalPassAfterCall(input.trajectory, anchorVerify.call_index)
    : null;
  const passLedgerCall =
    firstPassAfterAnchor === null
      ? null
      : input.ledger.calls.find((call) => call.index === firstPassAfterAnchor.call_index) ?? null;

  return {
    first_successful_authored_test_addition_call: additionCall,
    primary_anchor_canonical_verify_call: anchorVerify?.call_index ?? null,
    primary_anchor_verify_source: anchorVerify ? verificationSource(anchorVerify) : null,
    primary_anchor_verify_outcome: anchorVerify?.canonical_outcome ?? null,
    authored_test_count_at_anchor: input.authoredTestCountAtAnchor ?? null,
    test_loc_at_anchor: input.testLocAtAnchor ?? null,
    call_span_first_addition_to_anchor:
      additionCall !== null && anchorVerify !== null
        ? anchorVerify.call_index - additionCall
        : null,
    authored_tests_added_before_anchor: input.authoredTestCountAtAnchor ?? null,
    weighted_first_addition_to_anchor_verify:
      additionLedgerCall && anchorLedgerCall
        ? anchorLedgerCall.cumulative_weighted - additionLedgerCall.cumulative_weighted
        : null,
    weighted_anchor_verify_to_first_canonical_pass:
      anchorLedgerCall && passLedgerCall
        ? passLedgerCall.cumulative_weighted - anchorLedgerCall.cumulative_weighted
        : null,
    run_end_authored_test_count: input.runEndAuthoredTestCount ?? null,
    run_end_journey_test_count: input.runEndJourneyTestCount ?? null,
    increment_guard_rejections: exportData?.increment_guard_rejections ?? 0,
    max_accepted_single_step_delta: exportData?.max_accepted_single_step_delta ?? 0,
    skeleton_authored_count_at_start: exportData?.skeleton_authored_count_at_start ?? null,
    test_structure_error: exportData?.test_structure_error ?? false,
    export: exportData,
  };
}
