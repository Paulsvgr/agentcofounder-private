import { cloneHarness, findAgent, type HarnessDocument } from "./schema.js";
import { parseHarnessDocument } from "./schema.js";
import type { Evaluation } from "./evaluator.js";
import type { JsonCompleter } from "./evaluator.js";
import type { ExecutionTrace } from "./trace.js";

export interface HarnessChange {
  path: string;
  reason: string;
  before: unknown;
  after: unknown;
}

export interface OptimizerResult {
  harness: HarnessDocument;
  change_summary: string;
  changes: HarnessChange[];
}

const MAX_CHANGES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function setPath(document: HarnessDocument, path: string, value: unknown): boolean {
  const agentMatch = /^harness\.agents\[id=([^\]]+)\]\.(instructions|role|input_contract|output_contract)$/.exec(path);
  if (agentMatch) {
    const agent = findAgent(document, agentMatch[1]!);
    const field = agentMatch[2]!;
    if (!agent) return false;
    if (field === "input_contract" || field === "output_contract") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return false;
      agent[field] = value as string[];
      return true;
    }
    if (typeof value !== "string") return false;
    if (field === "instructions") agent.instructions = value;
    if (field === "role") agent.role = value;
    return true;
  }

  const hopMatch = /^harness\.workflow\.hops\[(\d+)\]\.(condition|purpose|from|to)$/.exec(path);
  if (hopMatch) {
    const hop = document.harness.workflow.hops[Number(hopMatch[1])];
    const field = hopMatch[2] as "condition" | "purpose" | "from" | "to";
    if (!hop || typeof value !== "string" || value.trim() === "") return false;
    hop[field] = value;
    return true;
  }

  if (path === "harness.workflow.hops.push" && isRecord(value)) {
    if (
      typeof value.from !== "string" ||
      typeof value.to !== "string" ||
      typeof value.condition !== "string" ||
      typeof value.purpose !== "string"
    ) {
      return false;
    }
    document.harness.workflow.hops.push({
      from: value.from,
      to: value.to,
      condition: value.condition,
      purpose: value.purpose,
    });
    return true;
  }

  const controlMatch = /^harness\.control\.(restore_on_repair|max_slices|slice_timeout_ms)$/.exec(path);
  if (controlMatch) {
    const field = controlMatch[1]!;
    if (field === "restore_on_repair" && typeof value === "boolean") {
      document.harness.control.restore_on_repair = value;
      return true;
    }
    if ((field === "max_slices" || field === "slice_timeout_ms") && typeof value === "number" && value >= 1) {
      document.harness.control[field] = value;
      return true;
    }
    return false;
  }

  if (path === "harness.global_rules.runtime_additions" && Array.isArray(value) && value.every((item) => typeof item === "string")) {
    document.harness.global_rules.runtime_additions = value as string[];
    return true;
  }

  if (path === "task_kind" && typeof value === "string") {
    const allowed = ["coding", "research", "debugging", "architecture", "general"] as const;
    if ((allowed as readonly string[]).includes(value)) {
      document.task_kind = value as HarnessDocument["task_kind"];
      return true;
    }
  }
  return false;
}

export function applyOptimizerChanges(
  current: HarnessDocument,
  nextId: string,
  changes: Array<{ path?: unknown; value?: unknown; reason?: unknown }>,
): OptimizerResult {
  const harness = cloneHarness(current);
  harness.id = nextId;
  const applied: HarnessChange[] = [];
  for (const change of changes.slice(0, MAX_CHANGES)) {
    if (typeof change.path !== "string") continue;
    const before = change.path;
    const ok = setPath(harness, change.path, change.value);
    if (!ok) continue;
    applied.push({
      path: change.path,
      reason: typeof change.reason === "string" ? change.reason : "unspecified",
      before,
      after: change.value,
    });
  }
  const parsed = parseHarnessDocument(harness);
  if (!parsed.document) {
    return {
      harness: { ...cloneHarness(current), id: nextId },
      change_summary: "optimizer output was invalid; kept current harness",
      changes: [],
    };
  }
  return {
    harness: parsed.document,
    change_summary: applied.map((change) => change.path).join(", ") || "no valid changes",
    changes: applied,
  };
}

export async function optimizeHarness(input: {
  current: HarnessDocument;
  nextId: string;
  history: Evaluation[];
  trace: ExecutionTrace;
  complete: JsonCompleter;
}): Promise<OptimizerResult> {
  const raw = await input.complete(
    [
      "You are a harness optimizer. Change the smallest component that the evidence supports.",
      "Prefer contracts, context routing, workflow hops, termination gates, and failure recovery over rewriting agent roles.",
      "Do not duplicate instructions across global rules, agent prompts, and contracts.",
      "Do not increase reasoning effort or make prompts longer without evidence.",
      "Return JSON only with at most 3 changes.",
    ].join(" "),
    [
      `Current harness:\n${JSON.stringify(input.current, null, 2)}`,
      `Current execution trace:\n${JSON.stringify(
        {
          agents_called: input.trace.agents_called,
          tools_used: input.trace.tools_used,
          failures: input.trace.failures.slice(0, 12),
          retries: input.trace.retries,
          termination_reason: input.trace.termination_reason,
          usage: input.trace.usage,
          agent_calls: input.trace.agent_calls,
          tool_calls: input.trace.tool_calls,
        },
        null,
        2,
      )}`,
      `Preference history:\n${JSON.stringify(
        input.history.map((row) => ({
          iteration: row.iteration,
          winner: row.winner,
          improvements: row.improvements,
          regressions: row.regressions,
          root_causes: row.root_causes,
          recommendations: row.harness_recommendations,
        })),
        null,
        2,
      )}`,
      `Return JSON: {"change_summary":"...","changes":[{"path":"harness.agents[id=implementer].instructions","value":"...","reason":"..."}]}`,
      "Allowed paths: harness.agents[id=ID].(instructions|role|input_contract|output_contract), harness.workflow.hops[N].(condition|purpose|from|to), harness.workflow.hops.push, harness.control.(restore_on_repair|max_slices|slice_timeout_ms), harness.global_rules.runtime_additions, task_kind.",
    ].join("\n\n"),
  );

  const record = isRecord(raw) ? raw : {};
  const changes = Array.isArray(record.changes) ? record.changes : [];
  const result = applyOptimizerChanges(
    input.current,
    input.nextId,
    changes.filter((item): item is Record<string, unknown> => isRecord(item)),
  );
  if (typeof record.change_summary === "string" && record.change_summary.trim() !== "" && result.changes.length > 0) {
    result.change_summary = record.change_summary;
  }
  return result;
}
