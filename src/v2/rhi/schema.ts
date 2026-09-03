import { createHash } from "node:crypto";
import type { MilestoneAction } from "../milestone-ralph/state.js";

export const RHI_HARNESS_SCHEMA = "agentcofounder.rhi_harness.v1" as const;

export type TaskKind = "coding" | "research" | "debugging" | "architecture" | "general";

export interface HarnessAgent {
  id: string;
  role: string;
  instructions: string;
  input_contract: string[];
  output_contract: string[];
  action?: MilestoneAction;
}

export interface WorkflowHop {
  from: string;
  to: string;
  condition: string;
  purpose: string;
}

export interface HarnessControl {
  termination_rules: string[];
  retry_rules: string[];
  fallback_rules: string[];
  recall_rules: string[];
  restore_on_repair: boolean;
  max_slices: number;
  slice_timeout_ms: number;
}

export interface HarnessGlobalRules {
  constraints: string[];
  tool_rules: string[];
  context_rules: string[];
  /** Injected into the live system prompt. Empty on v0 so production files stay the owner. */
  runtime_additions: string[];
}

export interface HarnessBody {
  agents: HarnessAgent[];
  workflow: { hops: WorkflowHop[] };
  control: HarnessControl;
  global_rules: HarnessGlobalRules;
}

export interface HarnessDocument {
  schema: typeof RHI_HARNESS_SCHEMA;
  id: string;
  task_kind: TaskKind;
  harness: HarnessBody;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function asStringArray(value: unknown, path: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${path} must be an array of strings`);
    return [];
  }
  return value;
}

function asNonEmptyString(value: unknown, path: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
    return "";
  }
  return value;
}

const ACTIONS = new Set<MilestoneAction>(["implement_core", "continue_journeys", "repair", "done"]);

function parseAgent(value: unknown, index: number, errors: string[]): HarnessAgent | undefined {
  if (!isRecord(value)) {
    errors.push(`harness.agents[${index}] must be an object`);
    return undefined;
  }
  const id = asNonEmptyString(value.id, `harness.agents[${index}].id`, errors);
  const role = asNonEmptyString(value.role, `harness.agents[${index}].role`, errors);
  const instructions = asNonEmptyString(value.instructions, `harness.agents[${index}].instructions`, errors);
  const input_contract = asStringArray(value.input_contract, `harness.agents[${index}].input_contract`, errors);
  const output_contract = asStringArray(value.output_contract, `harness.agents[${index}].output_contract`, errors);
  let action: MilestoneAction | undefined;
  if (value.action !== undefined) {
    if (typeof value.action !== "string" || !ACTIONS.has(value.action as MilestoneAction)) {
      errors.push(`harness.agents[${index}].action must be a milestone action`);
    } else {
      action = value.action as MilestoneAction;
    }
  }
  if (errors.some((error) => error.includes(`harness.agents[${index}]`))) return undefined;
  const agent: HarnessAgent = { id, role, instructions, input_contract, output_contract };
  if (action !== undefined) agent.action = action;
  return agent;
}

function parseHop(value: unknown, index: number, errors: string[]): WorkflowHop | undefined {
  if (!isRecord(value)) {
    errors.push(`harness.workflow.hops[${index}] must be an object`);
    return undefined;
  }
  const from = asNonEmptyString(value.from, `harness.workflow.hops[${index}].from`, errors);
  const to = asNonEmptyString(value.to, `harness.workflow.hops[${index}].to`, errors);
  const condition = asNonEmptyString(value.condition, `harness.workflow.hops[${index}].condition`, errors);
  const purpose = asNonEmptyString(value.purpose, `harness.workflow.hops[${index}].purpose`, errors);
  if (from === "" || to === "" || condition === "" || purpose === "") return undefined;
  return { from, to, condition, purpose };
}

export function parseHarnessDocument(value: unknown): { document?: HarnessDocument; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { errors: ["harness document must be an object"] };
  if (value.schema !== RHI_HARNESS_SCHEMA) {
    errors.push(`schema must be ${RHI_HARNESS_SCHEMA}`);
  }
  const id = asNonEmptyString(value.id, "id", errors);
  const taskKinds: TaskKind[] = ["coding", "research", "debugging", "architecture", "general"];
  if (typeof value.task_kind !== "string" || !taskKinds.includes(value.task_kind as TaskKind)) {
    errors.push("task_kind must be coding | research | debugging | architecture | general");
  }
  if (!isRecord(value.harness)) {
    errors.push("harness must be an object");
    return { errors };
  }
  const body = value.harness;
  if (!Array.isArray(body.agents)) errors.push("harness.agents must be an array");
  const agents = Array.isArray(body.agents)
    ? body.agents
        .map((agent, index) => parseAgent(agent, index, errors))
        .filter((agent): agent is HarnessAgent => agent !== undefined)
    : [];
  if (agents.length === 0) errors.push("harness.agents must contain at least one agent");
  const ids = new Set<string>();
  for (const agent of agents) {
    if (ids.has(agent.id)) errors.push(`duplicate agent id: ${agent.id}`);
    ids.add(agent.id);
  }

  if (!isRecord(body.workflow) || !Array.isArray(body.workflow.hops)) {
    errors.push("harness.workflow.hops must be an array");
  }
  const hops = isRecord(body.workflow) && Array.isArray(body.workflow.hops)
    ? body.workflow.hops
        .map((hop, index) => parseHop(hop, index, errors))
        .filter((hop): hop is WorkflowHop => hop !== undefined)
    : [];
  if (hops.length === 0) errors.push("harness.workflow.hops must contain at least one hop");

  if (!isRecord(body.control)) {
    errors.push("harness.control must be an object");
    return { errors };
  }
  const controlRaw = body.control;
  const restore_on_repair = controlRaw.restore_on_repair;
  if (typeof restore_on_repair !== "boolean") errors.push("harness.control.restore_on_repair must be a boolean");
  const max_slices = controlRaw.max_slices;
  if (typeof max_slices !== "number" || !Number.isSafeInteger(max_slices) || max_slices < 1) {
    errors.push("harness.control.max_slices must be a positive integer");
  }
  const slice_timeout_ms = controlRaw.slice_timeout_ms;
  if (typeof slice_timeout_ms !== "number" || !Number.isSafeInteger(slice_timeout_ms) || slice_timeout_ms < 1) {
    errors.push("harness.control.slice_timeout_ms must be a positive integer");
  }
  if (!isRecord(body.global_rules)) errors.push("harness.global_rules must be an object");
  const globalRaw = isRecord(body.global_rules) ? body.global_rules : {};
  const control = {
    termination_rules: asStringArray(controlRaw.termination_rules, "harness.control.termination_rules", errors),
    retry_rules: asStringArray(controlRaw.retry_rules, "harness.control.retry_rules", errors),
    fallback_rules: asStringArray(controlRaw.fallback_rules, "harness.control.fallback_rules", errors),
    recall_rules: asStringArray(controlRaw.recall_rules, "harness.control.recall_rules", errors),
    restore_on_repair: restore_on_repair as boolean,
    max_slices: max_slices as number,
    slice_timeout_ms: slice_timeout_ms as number,
  };
  const global_rules = {
    constraints: asStringArray(globalRaw.constraints, "harness.global_rules.constraints", errors),
    tool_rules: asStringArray(globalRaw.tool_rules, "harness.global_rules.tool_rules", errors),
    context_rules: asStringArray(globalRaw.context_rules, "harness.global_rules.context_rules", errors),
    runtime_additions: asStringArray(
      globalRaw.runtime_additions ?? [],
      "harness.global_rules.runtime_additions",
      errors,
    ),
  };

  if (errors.length > 0) return { errors };

  return {
    document: {
      schema: RHI_HARNESS_SCHEMA,
      id,
      task_kind: value.task_kind as TaskKind,
      harness: {
        agents,
        workflow: { hops },
        control,
        global_rules,
      },
    },
    errors,
  };
}

export function assertHarnessDocument(value: unknown): HarnessDocument {
  const parsed = parseHarnessDocument(value);
  if (!parsed.document || parsed.errors.length > 0) {
    throw new Error(`Invalid harness document: ${parsed.errors.join("; ")}`);
  }
  return parsed.document;
}

export function cloneHarness(document: HarnessDocument): HarnessDocument {
  return structuredClone(document);
}

export function harnessHash(document: HarnessDocument): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

export function findAgent(document: HarnessDocument, id: string): HarnessAgent | undefined {
  return document.harness.agents.find((agent) => agent.id === id);
}
