import type { NextSlice } from "../milestone-ralph/state.js";
import type { MilestoneAction, MilestoneState } from "../milestone-ralph/state.js";
import { qualityGapLines, type WorkspaceObservation } from "../milestone-ralph/observe.js";
import { evaluateCondition, type ConditionContext } from "./conditions.js";
import { baselineHarness } from "./baseline.js";
import { findAgent, type HarnessDocument } from "./schema.js";

const ACTION_TO_AGENT: Record<MilestoneAction, string> = {
  implement_core: "implementer",
  continue_journeys: "continuer",
  repair: "repairer",
  done: "done",
};

export function lastAgentId(state: MilestoneState): string {
  if (state.last_action === null) return "start";
  return ACTION_TO_AGENT[state.last_action];
}

export function conditionContext(
  state: MilestoneState,
  observation: WorkspaceObservation,
  maxSlices: number,
  taskKind = "coding",
): ConditionContext {
  return {
    done: state.done,
    slice: state.slice,
    max_slices: maxSlices,
    last_action: state.last_action,
    last_l0_exists: state.last_l0 !== null,
    last_l0_passed: state.last_l0?.passed ?? null,
    product_test_count: observation.productTestFiles.length,
    report_status: observation.reportStatus,
    has_report: observation.hasReportPartial,
    last_agent: lastAgentId(state),
    task_kind: taskKind,
  };
}

function hopFromMatches(from: string, lastAgent: string): boolean {
  return from === "*" || from === "any" || from === lastAgent;
}

export function selectHop(
  document: HarnessDocument,
  state: MilestoneState,
  observation: WorkspaceObservation,
  maxSlices: number,
): NextSlice {
  const ctx = conditionContext(state, observation, maxSlices, document.task_kind);
  for (const hop of document.harness.workflow.hops) {
    if (!hopFromMatches(hop.from, ctx.last_agent)) continue;
    if (!evaluateCondition(hop.condition, ctx)) continue;
    return sliceForAgent(document, hop.to, state);
  }
  return { action: "done", title: "Done", instruction: "" };
}

function sliceForAgent(document: HarnessDocument, agentId: string, state: MilestoneState): NextSlice {
  const agent = findAgent(document, agentId);
  if (agentId === "done" || agent?.action === "done") {
    return { action: "done", title: "Done", instruction: "" };
  }
  if (!agent) {
    return { action: "done", title: "Done", instruction: "" };
  }
  let instruction = agent.instructions;
  if (agent.action === "repair" && state.last_l0?.summary) {
    instruction = `${instruction}\n${state.last_l0.summary.trim() || "(no summary)"}`;
  }
  return {
    action: agent.action ?? "implement_core",
    title: titleForAction(agent.action ?? "implement_core", agent.role),
    instruction,
  };
}

function titleForAction(action: MilestoneAction, role: string): string {
  if (action === "implement_core") return "Core product + tests";
  if (action === "continue_journeys") return "Remaining journeys";
  if (action === "repair") return "Repair last L0 failure";
  if (action === "done") return "Done";
  return role;
}

export function formatContractPrompt(
  idea: string,
  slice: NextSlice,
  state: MilestoneState,
  document: HarnessDocument = baselineHarness(),
  observation?: WorkspaceObservation,
): string {
  const agentId = ACTION_TO_AGENT[slice.action];
  const agent = findAgent(document, agentId);
  const sealed =
    state.sealed.length === 0
      ? "- none yet"
      : state.sealed
          .map((entry) => `- slice ${entry.slice}: ${entry.title} (L0 ${entry.l0_passed ? "pass" : "fail"})`)
          .join("\n");
  const lastL0 = state.last_l0?.summary?.trim() ? state.last_l0.summary.trim() : "- none yet";
  const inputLines = [
    `idea: ${idea.trim()}`,
    `slice_title: ${slice.title}`,
    `slice_action: ${slice.action}`,
    `sealed_milestones:\n${sealed}`,
    `last_l0:\n${lastL0}`,
  ];
  const contract = agent?.input_contract ?? ["idea", "slice_title", "slice_action", "sealed_milestones", "last_l0"];
  const selected = inputLines.filter((line) => contract.some((field) => line.startsWith(field.split(".")[0]!)));
  const output = (agent?.output_contract ?? []).map((item) => `- ${item}`).join("\n");
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
    "## Input contract",
    "",
    selected.join("\n"),
    "",
    "## Output contract",
    "",
    output || "- source_changes",
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
    "",
  ].join("\n");
}

export function materializeRuntimeAdditions(document: HarnessDocument): string {
  return document.harness.global_rules.runtime_additions.map((line) => line.trim()).filter(Boolean).join("\n");
}
