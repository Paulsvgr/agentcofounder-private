import { EFFICIENCY_WEIGHTS, weightedCost } from "./weights.js";

/** Estimated token spend for a candidate Pi hop (competition-weighted). */
export interface ExpectedTokenSpend {
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cache_read_tokens: number;
}

export function expectedWeightedCost(spend: ExpectedTokenSpend): number {
  return weightedCost({
    input_tokens: spend.estimated_input_tokens,
    output_tokens: spend.estimated_output_tokens,
    cache_read_tokens: spend.estimated_cache_read_tokens,
    cache_write_tokens: 0,
  });
}

/**
 * Cost-aware VOI:
 *   (expected_quality_gain × probability_of_success) / expected_weighted_token_cost
 * Scaled ×1000 so scores stay readable.
 */
export function costAwareActionScore(input: {
  expected_quality_gain: number;
  probability_of_success: number;
  spend: ExpectedTokenSpend;
}): number {
  const numerator = Math.max(0, input.expected_quality_gain) * Math.max(0, Math.min(1, input.probability_of_success));
  const denom = Math.max(1, expectedWeightedCost(input.spend));
  return Number(((numerator / denom) * 1000).toFixed(4));
}

/** Heuristic token budgets by action kind (output-heavy actions are expensive). */
export function estimateSpendForKind(
  kind: string,
  stableSystemTokens: number,
  volatileTokens: number,
): ExpectedTokenSpend {
  const input = Math.max(200, volatileTokens) + Math.ceil(stableSystemTokens * 0.15);
  // Assume high cache hit on stable system append after slice 0.
  const cacheRead = Math.max(0, Math.floor(stableSystemTokens * 0.85));
  const outputByKind: Record<string, number> = {
    implement_core: 6_000,
    repair_failure: 3_500,
    fix_architecture: 4_000,
    fix_persistence: 3_000,
    improve_accessibility: 2_500,
    complete_missing_journey: 3_500,
    stop: 0,
  };
  return {
    estimated_input_tokens: input,
    estimated_output_tokens: outputByKind[kind] ?? 3_000,
    estimated_cache_read_tokens: cacheRead,
  };
}

export function competitionWeightedTokens(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}): number {
  return weightedCost(usage);
}

/**
 * Efficiency score for result.json:
 * journeys_passed / competition_weighted_tokens (higher is better).
 * Returns 0 when denominator is 0.
 */
export function weightedEfficiencyScore(input: {
  journeys_passed: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  };
}): number {
  const weighted = competitionWeightedTokens(input.usage);
  if (weighted <= 0) return 0;
  return Number((input.journeys_passed / weighted).toFixed(8));
}

export { EFFICIENCY_WEIGHTS, weightedCost };
