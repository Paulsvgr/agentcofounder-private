import type { MilestoneContext, ContextMetricsSnapshot, VolatileContextSection } from "./types.js";
import { estimateTokens, estimateJsonTokens, compactionThresholdTokens } from "./estimate.js";
import type { SliceContract } from "./slice-contract.js";
import { formatSliceContractPrompt } from "./slice-contract.js";
import { weightedCost } from "../weights.js";

/**
 * Prefer surgical slice contracts. Fall back to compact volatile summary only when no contract.
 */
export function formatVolatileWorkerPrompt(context: MilestoneContext, contract?: SliceContract): string {
  if (contract) {
    return formatSliceContractPrompt(contract, context.stable.idea_digest);
  }

  const v = context.volatile;
  const findings =
    v.top_findings.length === 0
      ? "- none"
      : v.top_findings
          .slice(0, 3)
          .map((f, i) => `${i + 1}. [${f.severity}/${f.area}] ${f.recommended_action}`)
          .join("\n");

  return [
    "## Slice objective",
    `Objective: ${v.current_objective}`,
    `Success: ${v.success_condition}`,
    "",
    "## Top findings",
    findings,
    "",
    "## Idea digest",
    context.stable.idea_digest,
    "",
    "Work until success, no long explanations, stop immediately after verify once.",
    "",
  ].join("\n");
}

/** Legacy-style bloated prompt estimate for measuring reduction. */
export function estimateLegacyPromptTokens(input: {
  idea: string;
  instruction: string;
  sealedSummary: string;
  lastL0Summary: string;
  qualityGaps: string[];
}): number {
  const text = [
    input.idea,
    input.instruction,
    input.sealedSummary,
    input.lastL0Summary,
    ...input.qualityGaps,
    "Observed harness state",
  ].join("\n");
  return estimateTokens(text);
}

export function measureContextPrompt(input: {
  slice: number;
  stableSystemChars: number;
  volatilePrompt: string;
  context: MilestoneContext;
  legacyEstimateTokens: number;
  compacted: boolean;
  stablePromptSha256?: string;
  outputBudget?: number;
}): ContextMetricsSnapshot {
  const volatileTokens = estimateTokens(input.volatilePrompt);
  const stableTokens = Math.ceil(input.stableSystemChars / 4);
  const legacyUser = Math.max(input.legacyEstimateTokens, volatileTokens);
  const reduction = legacyUser <= 0 ? 0 : Math.max(0, (legacyUser - volatileTokens) / legacyUser);
  const cacheHitAssumption = input.slice === 0 ? 0 : 0.85;
  const estimatedCacheRead = Math.floor(stableTokens * cacheHitAssumption);
  const estimatedOutput = input.outputBudget ?? 2_500;
  const estimatedWeighted = weightedCost({
    input_tokens: volatileTokens + Math.ceil(stableTokens * (1 - cacheHitAssumption)),
    output_tokens: estimatedOutput,
    cache_read_tokens: estimatedCacheRead,
    cache_write_tokens: 0,
  });
  return {
    slice: input.slice,
    estimated_tokens_before: legacyUser + stableTokens,
    estimated_tokens_after: volatileTokens + stableTokens,
    volatile_chars: input.volatilePrompt.length,
    stable_chars: input.stableSystemChars,
    compacted: input.compacted,
    reduction_ratio: Number(reduction.toFixed(4)),
    estimated_weighted_cost: Number(estimatedWeighted.toFixed(2)),
    estimated_output_budget: estimatedOutput,
    ...(input.stablePromptSha256 ? { stable_prompt_sha256: input.stablePromptSha256 } : {}),
    cache_hit_assumption: cacheHitAssumption,
  };
}

export function maybeCompactContext(context: MilestoneContext): { context: MilestoneContext; compacted: boolean } {
  const volatileTokens = estimateJsonTokens(context.volatile);
  const threshold = compactionThresholdTokens();
  // Compact when volatile section alone is large relative to budget slice (~12% of window).
  const volatileBudget = Math.floor(threshold * 0.15);
  if (volatileTokens <= volatileBudget) {
    return { context, compacted: false };
  }

  const v = context.volatile;
  const summary = [
    `compacted@slice: defects=${v.known_defects.length}`,
    `findings=${v.top_findings.map((f) => f.area).join("|") || "none"}`,
    `journeys_done=${v.completed_journeys.length}`,
    `arch=${Number(v.architecture.has_domain)}${Number(v.architecture.has_storage)}${Number(v.architecture.has_components)}`,
  ].join("; ");

  const compactedVolatile: VolatileContextSection = {
    ...v,
    known_defects: v.known_defects.slice(0, 5),
    top_findings: v.top_findings.slice(0, 3),
    changed_files: v.changed_files.slice(-12),
    artifact_pointers: v.artifact_pointers.slice(0, 6),
    completed_journeys: v.completed_journeys.slice(0, 12),
    remaining_journeys: v.remaining_journeys.slice(0, 12),
  };

  return {
    compacted: true,
    context: {
      ...context,
      volatile: compactedVolatile,
      compaction_summaries: [...context.compaction_summaries, summary].slice(-20),
    },
  };
}
