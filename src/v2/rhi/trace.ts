import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../../types.js";
import { collectUsageFromJsonLines } from "../../usage.js";
import type { MilestoneState } from "../milestone-ralph/state.js";
import type { HarnessDocument } from "./schema.js";

export const RHI_TRACE_SCHEMA = "agentcofounder.rhi_trace.v1" as const;

export interface TraceAgentCall {
  id: string;
  slice: number;
  action: string;
  title: string;
  l0_passed: boolean | null;
}

export interface TraceTransfer {
  from: string;
  to: string;
  summary: string;
}

export interface TraceToolUse {
  name: string;
  count: number;
  errors: number;
}

export interface ExecutionTrace {
  schema: typeof RHI_TRACE_SCHEMA;
  task: string;
  harness_id: string;
  agents_called: TraceAgentCall[];
  information_passed: TraceTransfer[];
  tools_used: TraceToolUse[];
  tests_executed: Array<{ command: string; result: string; journey: string }>;
  failures: string[];
  retries: number;
  termination_reason: string;
  agent_calls: number;
  tool_calls: number;
  workflow_hops: number;
  execution_time_ms: number;
  usage: {
    model_calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_tokens: number;
    cost_total: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function toolNameFromEvent(event: Record<string, unknown>): string | undefined {
  if (event.type === "tool_execution_end" && typeof event.toolName === "string") return event.toolName;
  if (event.type === "message_end" && isRecord(event.message) && event.message.role === "toolResult") {
    const name = event.message.toolName ?? event.message.name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

function collectTools(events: string): TraceToolUse[] {
  const counts = new Map<string, { count: number; errors: number }>();
  for (const line of events.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const name = toolNameFromEvent(event);
      if (!name) continue;
      const current = counts.get(name) ?? { count: 0, errors: 0 };
      current.count += 1;
      if (event.isError === true) current.errors += 1;
      counts.set(name, current);
    } catch {
      // Malformed lines stay in the raw events file.
    }
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, count: value.count, errors: value.errors }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function terminationReason(state: MilestoneState | null, result: RunResult | null, timedOut: boolean): string {
  if (timedOut) return "overall_timeout";
  if (state?.last_action === "done") return "orchestrator_done";
  if (state?.last_l0?.passed && result?.status === "success") return "l0_passed_and_success";
  if (state?.last_l0 && !state.last_l0.passed) return "l0_failed";
  if (result?.status) return `result_${result.status}`;
  return "unknown";
}

export async function buildExecutionTrace(input: {
  task: string;
  harness: HarnessDocument;
  artifactDirectory: string;
  executionTimeMs: number;
  timedOut?: boolean;
}): Promise<ExecutionTrace> {
  const eventsPath = path.join(input.artifactDirectory, "events.jsonl");
  const resultPath = path.join(input.artifactDirectory, "result.json");
  const statePath = path.join(input.artifactDirectory, "milestone-state.json");
  const events = await readFile(eventsPath, "utf8").catch(() => "");
  const usage = collectUsageFromJsonLines(events);
  const tools = collectTools(events);

  let result: RunResult | null = null;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8")) as RunResult;
  } catch {
    result = null;
  }
  let state: MilestoneState | null = null;
  try {
    state = JSON.parse(await readFile(statePath, "utf8")) as MilestoneState;
  } catch {
    state = null;
  }

  const agentsCalled: TraceAgentCall[] = (state?.sealed ?? []).map((entry) => ({
    id: entry.action === "implement_core" ? "implementer" : entry.action === "continue_journeys" ? "continuer" : entry.action === "repair" ? "repairer" : "done",
    slice: entry.slice,
    action: entry.action,
    title: entry.title,
    l0_passed: entry.l0_passed,
  }));

  const informationPassed: TraceTransfer[] = [];
  for (let index = 0; index < agentsCalled.length; index += 1) {
    const current = agentsCalled[index]!;
    const previous = agentsCalled[index - 1];
    informationPassed.push({
      from: previous?.id ?? "orchestrator",
      to: current.id,
      summary: `slice ${current.slice} ${current.action}; L0 ${current.l0_passed ? "pass" : "fail"}`,
    });
    informationPassed.push({
      from: current.id,
      to: "l0_verifier",
      summary: "workspace tree after worker exit",
    });
  }

  const tests = [
    ...(result?.tests_run ?? []),
    ...(result?.harness_checks ?? []),
  ].map((row) => ({ command: row.command, result: row.result, journey: row.journey }));

  const failures: string[] = [];
  for (const row of tests) {
    if (row.result === "failed") failures.push(`${row.command}: ${row.journey}`);
  }
  if (result?.status === "failed") failures.push(result.summary);

  const retries = agentsCalled.filter((call) => call.action === "repair").length;
  const toolCalls = tools.reduce((sum, tool) => sum + tool.count, 0);

  return {
    schema: RHI_TRACE_SCHEMA,
    task: input.task,
    harness_id: input.harness.id,
    agents_called: agentsCalled,
    information_passed: informationPassed,
    tools_used: tools,
    tests_executed: tests,
    failures: failures.filter(Boolean),
    retries,
    termination_reason: terminationReason(state, result, input.timedOut === true),
    agent_calls: agentsCalled.length,
    tool_calls: toolCalls,
    workflow_hops: agentsCalled.length,
    execution_time_ms: input.executionTimeMs,
    usage: {
      model_calls: usage.model_calls,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      total_tokens: usage.total_tokens,
      cost_total: usage.cost_total,
    },
  };
}
