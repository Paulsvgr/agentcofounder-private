import type { RunExport, RunExportEfficiency } from "../types/runExport";

/** Normalized timing + call-count fields with v1 → v2 aliases applied. */
export type NormalizedEfficiency = {
  first_test_failure_s: number | null;
  first_green_s: number | null;
  last_green_s: number | null;
  green_to_exit_s: number | null;
  manual_test_calls: number | null;
  manual_build_calls: number | null;
  test_reinspection_calls: number | null;
  post_green_verification_calls: number | null;
  auto_test_candidate_events: number | null;
  auto_test_actual_runs: number | null;
};

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numOrZero(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function normalizeEfficiencyFields(
  eff: RunExportEfficiency | undefined,
): NormalizedEfficiency {
  if (!eff) {
    return {
      first_test_failure_s: null,
      first_green_s: null,
      last_green_s: null,
      green_to_exit_s: null,
      manual_test_calls: null,
      manual_build_calls: null,
      test_reinspection_calls: null,
      post_green_verification_calls: null,
      auto_test_candidate_events: null,
      auto_test_actual_runs: null,
    };
  }

  return {
    first_test_failure_s:
      numOrNull(eff.first_test_failure_s) ?? numOrNull(eff.time_to_first_failing_test_s),
    first_green_s: numOrNull(eff.first_green_s),
    last_green_s: numOrNull(eff.last_green_s) ?? numOrNull(eff.time_to_final_green_s),
    green_to_exit_s: numOrNull(eff.green_to_exit_s),
    manual_test_calls:
      numOrZero(eff.manual_test_calls) ?? numOrZero(eff.npm_test_command_count),
    manual_build_calls: numOrZero(eff.manual_build_calls),
    test_reinspection_calls: numOrZero(eff.test_reinspection_calls),
    post_green_verification_calls: numOrZero(eff.post_green_verification_calls),
    auto_test_candidate_events:
      numOrZero(eff.auto_test_candidate_events) ?? numOrZero(eff.auto_test_trigger_hits),
    auto_test_actual_runs: numOrZero(eff.auto_test_actual_runs),
  };
}

export function efficiencyOf(run: { data: { export?: RunExport } }): NormalizedEfficiency {
  return normalizeEfficiencyFields(run.data.export?.efficiency);
}

export const WEIGHTED_COST_TOOLTIP =
  "Weighted cost ≈ input + output×3 + cache_read×0.1. Lower is better when outcomes are comparable.";
