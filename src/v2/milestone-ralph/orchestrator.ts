import type { MilestoneState, NextSlice } from "./state.js";
import type { WorkspaceObservation } from "./observe.js";
import { baselineHarness } from "../rhi/baseline.js";
import { formatContractPrompt, selectHop } from "../rhi/materialize.js";
import type { HarnessDocument } from "../rhi/schema.js";

export type { NextSlice };

export function repairSlice(l0Summary: string): NextSlice {
  return {
    action: "repair",
    title: "Repair last L0 failure",
    instruction: [
      "The previous slice's files are still on disk. Do not restore the seed and do not start over.",
      "Fix only what the L0 report names — usually missing or failing src/**/*.test.ts(x).",
      "Edit the existing app and tests, then stop.",
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

export function formatWorkerPrompt(
  idea: string,
  slice: NextSlice,
  state: MilestoneState,
  harness?: HarnessDocument,
): string {
  if (harness && harness.id !== "v0") {
    return formatContractPrompt(idea, slice, state, harness);
  }

  const sealed =
    state.sealed.length === 0
      ? "- none yet"
      : state.sealed.map((entry) => `- slice ${entry.slice}: ${entry.title} (L0 ${entry.l0_passed ? "pass" : "fail"})`).join("\n");
  const lastL0 = state.last_l0?.summary?.trim() ? state.last_l0.summary.trim() : "- none yet";

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
    "## Observed harness state (do not re-plan sealed work)",
    "",
    `Slice index: ${state.slice}`,
    "Sealed milestones:",
    sealed,
    "",
    "Last L0:",
    lastL0,
    "",
    "This session is fresh. The workspace on disk is the source of truth. Do not assume chat history from earlier slices.",
    "You are already in the generated app directory. Use src/App.tsx, not output/app/....",
    "",
  ].join("\n");
}
