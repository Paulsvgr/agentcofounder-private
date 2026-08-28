import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PiUsage } from "../types.js";
import { compareUsage } from "./reconcile.js";
import { EFFICIENCY_WEIGHTS, weightedCost } from "./weights.js";
import type { RunResult } from "../types.js";

export const CALL_LEDGER_SCHEMA = "agentcofounder.call_ledger.v1" as const;
export const CLASSIFIER_VERSION = "v1-tools-paths" as const;

export interface LedgerTool {
  name: string;
  detail: string;
  is_error: boolean;
  paths: string[];
}

export interface CallLedgerEntry {
  index: number;
  turn: number;
  timestamp_ms: number | null;
  seconds_since_start: number | null;
  gap_seconds: number | null;
  model: string;
  stop_reason: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  weighted_cost: number;
  cumulative_weighted: number;
  tools: LedgerTool[];
}

export interface CallLedger {
  schema: typeof CALL_LEDGER_SCHEMA;
  run_id: string;
  source_events: string;
  classifier_version: typeof CLASSIFIER_VERSION;
  weights: typeof EFFICIENCY_WEIGHTS;
  calls: CallLedgerEntry[];
  reconciliation: {
    matched: boolean;
    fields: ReturnType<typeof compareUsage>;
  };
}

interface ToolExecution {
  name: string;
  args: Record<string, unknown>;
  is_error: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsage(value: unknown): value is PiUsage {
  if (!isRecord(value)) return false;
  return (
    typeof value.input === "number" &&
    typeof value.output === "number" &&
    typeof value.cacheRead === "number" &&
    typeof value.cacheWrite === "number" &&
    typeof value.totalTokens === "number"
  );
}

function collectPaths(value: unknown, paths: string[]): void {
  if (typeof value === "string") {
    if (value.includes("/") || value.includes("\\") || value.endsWith(".ts") || value.endsWith(".tsx")) {
      paths.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, paths);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "path" || key === "filePath" || key === "file_path") {
      if (typeof nested === "string") paths.push(nested);
    } else {
      collectPaths(nested, paths);
    }
  }
}

function toolDetail(name: string, args: Record<string, unknown>): string {
  if (name === "bash" && typeof args.command === "string") {
    const command = args.command.replace(/\s+/g, " ").trim();
    return command.length > 120 ? `${command.slice(0, 117)}...` : command;
  }
  if (typeof args.path === "string") return args.path;
  const paths: string[] = [];
  collectPaths(args, paths);
  if (paths.length > 0) return paths[0]!;
  return "";
}

function toLedgerTool(execution: ToolExecution): LedgerTool {
  const paths: string[] = [];
  collectPaths(execution.args, paths);
  return {
    name: execution.name,
    detail: toolDetail(execution.name, execution.args),
    is_error: execution.is_error,
    paths: [...new Set(paths)],
  };
}

function modelLabel(message: Record<string, unknown>): string {
  if (message.role === "assistant") {
    const provider = typeof message.provider === "string" ? `${message.provider}/` : "";
    const rawModel = message.responseModel ?? message.model;
    return typeof rawModel === "string" ? `${provider}${rawModel}` : `${provider}unknown`;
  }
  const toolName = message.toolName ?? message.name;
  return typeof toolName === "string" ? `tool:${toolName}` : "tool:unknown";
}

function parseEventLine(line: string): Record<string, unknown> | null {
  if (line.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildCallLedgerFromEvents(content: string, runId: string, eventsPath: string): CallLedger {
  const pendingTools: ToolExecution[] = [];
  const openToolArgs = new Map<string, Record<string, unknown>>();
  const calls: CallLedgerEntry[] = [];
  let turn = 0;
  let startMs: number | null = null;
  let previousMs: number | null = null;
  let cumulativeWeighted = 0;

  const flushPendingTools = (): void => {
    if (calls.length === 0 || pendingTools.length === 0) return;
    const last = calls[calls.length - 1]!;
    last.tools.push(...pendingTools.map(toLedgerTool));
    pendingTools.length = 0;
  };

  for (const line of content.split(/\r?\n/u)) {
    const event = parseEventLine(line);
    if (!event) continue;

    const type = event.type;
    if (type === "turn_start") {
      turn += 1;
    } else if (type === "tool_execution_start") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
      const args = isRecord(event.args) ? event.args : {};
      if (toolCallId) openToolArgs.set(toolCallId, args);
    } else if (type === "tool_execution_end") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : "";
      const name = typeof event.toolName === "string" ? event.toolName : "unknown";
      const args = openToolArgs.get(toolCallId) ?? (isRecord(event.args) ? event.args : {});
      if (toolCallId) openToolArgs.delete(toolCallId);
      const result = isRecord(event.result) ? event.result : {};
      pendingTools.push({
        name,
        args,
        is_error: result.isError === true,
      });
    } else if (type === "message_end") {
      const message = event.message;
      if (!isRecord(message) || !isUsage(message.usage)) continue;
      const role = message.role;
      if (role !== "assistant" && role !== "toolResult") continue;

      flushPendingTools();

      const usage = message.usage;
      const timestampMs = typeof message.timestamp === "number" ? message.timestamp : null;
      if (startMs === null && timestampMs !== null) startMs = timestampMs;
      const secondsSinceStart =
        startMs !== null && timestampMs !== null ? (timestampMs - startMs) / 1000 : null;
      const gapSeconds =
        previousMs !== null && timestampMs !== null ? (timestampMs - previousMs) / 1000 : null;
      if (timestampMs !== null) previousMs = timestampMs;

      const tokenUsage = {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_tokens: usage.cacheRead,
        cache_write_tokens: usage.cacheWrite,
      };
      const callWeighted = weightedCost(tokenUsage);
      cumulativeWeighted += callWeighted;

      calls.push({
        index: calls.length + 1,
        turn,
        timestamp_ms: timestampMs,
        seconds_since_start: secondsSinceStart,
        gap_seconds: gapSeconds,
        model: modelLabel(message),
        stop_reason: typeof message.stopReason === "string" ? message.stopReason : null,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_tokens: usage.cacheRead,
        cache_write_tokens: usage.cacheWrite,
        reasoning_tokens: typeof usage.reasoning === "number" ? usage.reasoning : 0,
        total_tokens: usage.totalTokens,
        weighted_cost: callWeighted,
        cumulative_weighted: cumulativeWeighted,
        tools: [],
      });
    }
  }

  flushPendingTools();

  return {
    schema: CALL_LEDGER_SCHEMA,
    run_id: runId,
    source_events: eventsPath,
    classifier_version: CLASSIFIER_VERSION,
    weights: EFFICIENCY_WEIGHTS,
    calls,
    reconciliation: {
      matched: true,
      fields: [],
    },
  };
}

function ledgerTotals(calls: CallLedgerEntry[]): {
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cost_total: number;
  call_log: [];
} {
  return calls.reduce(
    (totals, call) => ({
      model_calls: totals.model_calls + 1,
      input_tokens: totals.input_tokens + call.input_tokens,
      output_tokens: totals.output_tokens + call.output_tokens,
      cache_read_tokens: totals.cache_read_tokens + call.cache_read_tokens,
      cache_write_tokens: totals.cache_write_tokens + call.cache_write_tokens,
      total_tokens: totals.total_tokens + call.total_tokens,
      reasoning_tokens: totals.reasoning_tokens + call.reasoning_tokens,
      cost_total: totals.cost_total,
      call_log: [],
    }),
    {
      model_calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0,
      reasoning_tokens: 0,
      cost_total: 0,
      call_log: [],
    },
  );
}

export async function buildCallLedger(runDirectory: string): Promise<CallLedger> {
  const runId = path.basename(runDirectory);
  const eventsPath = path.join(runDirectory, "events.jsonl");
  const resultPath = path.join(runDirectory, "result.json");

  const [eventsContent, resultContent] = await Promise.all([
    readFile(eventsPath, "utf8"),
    readFile(resultPath, "utf8"),
  ]);

  const ledger = buildCallLedgerFromEvents(eventsContent, runId, eventsPath);
  const official = JSON.parse(resultContent) as RunResult;
  const fromLedger = ledgerTotals(ledger.calls);
  const fields = compareUsage(official, fromLedger);
  ledger.reconciliation = {
    matched: fields.every((field) => field.match),
    fields,
  };
  return ledger;
}
