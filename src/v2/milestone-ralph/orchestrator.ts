import type { MilestoneState, NextSlice } from "./state.js";
import { qualityGapLines, type WorkspaceObservation } from "./observe.js";
import { baselineHarness } from "../rhi/baseline.js";
import { formatContractPrompt, selectHop } from "../rhi/materialize.js";
import type { HarnessDocument } from "../rhi/schema.js";
import type { MilestoneContext } from "../context/types.js";
import { formatVolatileWorkerPrompt } from "../context/prompt.js";
import type { SliceContract } from "../context/slice-contract.js";
import { selectVoiAction, type VoiDecision } from "../voi/select.js";
import type { DiagnosisFinding } from "../sensors/types.js";

export type { NextSlice };

export function repairSlice(l0Summary: string): NextSlice {
  return {
    action: "repair",
    title: "Repair last L0 failure",
    instruction: [
      "The previous slice's files are still on disk. Do not restore the seed and do not start over.",
      "Fix only what the L0 report names — usually missing or failing src/**/*.test.ts(x).",
      "Prefer fixing inside domain/storage/components rather than collapsing everything into App.tsx.",
      "Edit the existing app and tests, then stop. No long explanations.",
      "L0 report:",
      l0Summary.trim() || "(no summary)",
    ].join("\n"),
  };
}

export function chooseNextSlice(
  state: MilestoneState,
  observation: WorkspaceObservation,
  maxSlices: number,
  harness: HarnessDocument = baselineHarness(),
): NextSlice {
  return selectHop(harness, state, observation, maxSlices);
}

export function chooseNextSliceIntelligent(input: {
  state: MilestoneState;
  observation: WorkspaceObservation;
  diagnosis: DiagnosisFinding[];
  maxSlices: number;
  harness?: HarnessDocument;
  adaptive?: boolean;
  stableSystemTokens?: number;
  volatileTokens?: number;
}): { slice: NextSlice; decision: VoiDecision | null } {
  const adaptive = input.adaptive !== false && process.env.RALPH_ADAPTIVE !== "0";
  if (!adaptive) {
    return {
      slice: chooseNextSlice(input.state, input.observation, input.maxSlices, input.harness),
      decision: null,
    };
  }

  const decision = selectVoiAction({
    observation: input.observation,
    diagnosis: input.diagnosis,
    state: input.state,
    maxSlices: input.maxSlices,
    unchangedWorkspaceStreak: input.state.unchanged_workspace_streak ?? 0,
    ...(input.stableSystemTokens !== undefined ? { stableSystemTokens: input.stableSystemTokens } : {}),
    ...(input.volatileTokens !== undefined ? { volatileTokens: input.volatileTokens } : {}),
  });

  return {
    decision,
    slice: {
      action: decision.selected.action,
      title: decision.selected.title,
      instruction: decision.selected.instruction,
      voi_kind: decision.selected.kind,
      success_condition: decision.selected.success_condition,
      score: decision.selected.score,
    },
  };
}

export function formatWorkerPrompt(
  idea: string,
  slice: NextSlice,
  state: MilestoneState,
  harness?: HarnessDocument,
  observation?: WorkspaceObservation,
  milestoneContext?: MilestoneContext,
  sliceContract?: SliceContract,
): string {
  if (milestoneContext) {
    return formatVolatileWorkerPrompt(milestoneContext, sliceContract);
  }

  if (harness && harness.id !== "v0") {
    return formatContractPrompt(idea, slice, state, harness, observation);
  }

  const sealed =
    state.sealed.length === 0
      ? "- none yet"
      : state.sealed.map((entry) => `- slice ${entry.slice}: ${entry.title} (L0 ${entry.l0_passed ? "pass" : "fail"})`).join("\n");
  const lastL0 = state.last_l0?.summary?.trim() ? state.last_l0.summary.trim() : "- none yet";
  const gaps = observation ? qualityGapLines(observation) : [];
  const qualityBlock =
    gaps.length === 0
      ? []
      : ["## Quality gaps to close this slice", "", ...gaps, ""];

  return [
    "## Product idea",
    "",
    idea.trim(),
    "",
    "## Current slice",
    "",
    `Title: ${slice.title}`,
    `Action: ${slice.action}`,
    "",
    slice.instruction,
    "",
    ...qualityBlock,
    "## Observed harness state (do not re-plan sealed work)",
    "",
    `Slice index: ${state.slice}`,
    "Sealed milestones:",
    sealed,
    "",
    "Last L0:",
    lastL0,
    "",
    "This session is fresh. Prefer write/edit. No long explanations. Stop after success.",
    "You are already in the generated app directory. Use src/App.tsx, not output/app/....",
    "",
  ].join("\n");
}
