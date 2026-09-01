import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { PiUsage } from "../types.js";
import {
  ACTIVITY_CLASSIFIER_VERSION,
  classifyCallActivity,
  summarizeActivities,
  type ActivityBucket,
  type ActivityPhase,
} from "./classify.js";
import { compareUsage } from "./reconcile.js";
import { EFFICIENCY_WEIGHTS, weightedCost } from "./weights.js";
import type { RunResult } from "../types.js";

export const CALL_LEDGER_SCHEMA = "agentcofounder.call_ledger.v1" as const;
export const CLASSIFIER_VERSION = ACTIVITY_CLASSIFIER_VERSION;

export interface LedgerTool {
  name: string;
  detail: string;
  is_error: boolean;
  paths: string[];
  /** Truncated stdout/stderr from tool result, when present. */
  output: string | null;
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
  /** Heuristic — one call may mix activities; see tools. */
  activity: ActivityPhase;
  tools: LedgerTool[];
}

export interface CallLedger {
  schema: typeof CALL_LEDGER_SCHEMA;
  run_id: string;
  source_events: string;
  classifier_version: typeof CLASSIFIER_VERSION;
  weights: typeof EFFICIENCY_WEIGHTS;
  calls: CallLedgerEntry[];
  activity_summary: ActivityBucket[];
  reconciliation: {
    matched: boolean;
    fields: ReturnType<typeof compareUsage>;
    /** True when artifacts/runs/<id>/result.json is absent — ledger built from events only. */
    official_missing?: boolean;
  };
}

interface ToolExecution {
  name: string;
  args: Record<string, unknown>;
  is_error: boolean;
  output: string | null;
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/gu, "");
}

function truncateText(text: string, maxLength = 800): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

const ERROR_LINE =
  /TestingLibraryElementError|AssertionError|VitestError|Expected .+ to|Received:|^\s*Error:/iu;
const FAILURE_LINE = /\bFAIL\b|\s×\s|Test Files.*failed|\|\s*\d+\s+failed/iu;

function isDomLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^<[a-z]/iu.test(trimmed)) return true;
  if (/^(aria-|class=|id=|value=)/u.test(trimmed)) return true;
  if (/^\s{4,}\S/u.test(line) && !ERROR_LINE.test(line)) return true;
  return false;
}

function isDomDump(text: string): boolean {
  const trimmed = text.trimStart();
  return /^<[a-z]+/iu.test(trimmed) && (trimmed.includes("class=") || trimmed.startsWith("<body"));
}

const SUITE_OUTCOME_LINE = /(?:✅|❌)\s*(PASS|FAIL)\s*\d+\/\d+/iu;

/** Lines metrics need to distinguish pass/fail from unknown — preserved before error truncation. */
export function extractVerificationHeader(text: string): string | null {
  const headerLines: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (/verify exit_code=\d+/iu.test(trimmed)) {
      headerLines.push(trimmed);
      continue;
    }
    if (SUITE_OUTCOME_LINE.test(trimmed) || /FAIL\s*0\/0|SUITE_ERROR|suite did not run/iu.test(trimmed)) {
      headerLines.push(trimmed);
    }
  }
  if (headerLines.length === 0) return null;
  return [...new Set(headerLines)].join("\n");
}

function extractErrorFocus(text: string): string {
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => ERROR_LINE.test(line));
  if (start === -1) return text;

  const chunk: string[] = [];
  for (let index = start; index < lines.length && chunk.length < 10; index += 1) {
    const line = lines[index]!;
    if (chunk.length > 0 && line.trim() === "") break;
    if (isDomLine(line)) break;
    chunk.push(line);
  }
  return chunk.join("\n").trim() || text;
}

function combineVerificationOutput(header: string | null, body: string, maxLength = 800): string {
  const combined = header ? `${header}\n\n${body}` : body;
  return truncateText(combined, maxLength);
}

function truncateToolOutput(text: string, maxLength = 800): string {
  const header = extractVerificationHeader(text);
  if (ERROR_LINE.test(text)) {
    return combineVerificationOutput(header, extractErrorFocus(text), maxLength);
  }
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  const tail = lines.slice(-12).join("\n");
  return combineVerificationOutput(header, tail, maxLength);
}

function hasFailureSummary(text: string): boolean {
  return FAILURE_LINE.test(text);
}

function hasErrorDetail(text: string): boolean {
  return ERROR_LINE.test(text);
}

function extractFailTestName(text: string): string | null {
  const failMatch = text.match(/\bFAIL\b[^\n]*>\s*(.+)/u);
  if (failMatch?.[1]) return failMatch[1].trim();
  const crossMatch = text.match(/\s×\s+(.+?)\s+\d+ms/u);
  return crossMatch?.[1]?.trim() ?? null;
}

interface ErrorSnippet {
  callIndex: number;
  text: string;
  testName: string | null;
}

function collectErrorSnippets(calls: CallLedgerEntry[]): ErrorSnippet[] {
  const snippets: ErrorSnippet[] = [];
  for (const call of calls) {
    for (const tool of call.tools) {
      if (!tool.output || !hasErrorDetail(tool.output)) continue;
      snippets.push({
        callIndex: call.index,
        text: truncateText(extractErrorFocus(tool.output), 600),
        testName: extractFailTestName(tool.output),
      });
    }
  }
  return snippets;
}

function findMatchingError(
  snippets: ErrorSnippet[],
  fromCallIndex: number,
  testName: string | null,
): string | null {
  const nearby = snippets.filter(
    (snippet) => snippet.callIndex >= fromCallIndex && snippet.callIndex <= fromCallIndex + 6,
  );
  if (testName) {
    const normalized = testName.toLowerCase();
    const exact = nearby.find((snippet) => {
      if (!snippet.testName) return false;
      const candidate = snippet.testName.toLowerCase();
      return candidate.includes(normalized) || normalized.includes(candidate);
    });
    if (exact) return exact.text;

    const tokens = normalized.split(/[^a-z0-9]+/u).filter((token) => token.length > 4);
    const tokenMatch = nearby.find((snippet) =>
      tokens.some((token) => snippet.text.toLowerCase().includes(token)),
    );
    if (tokenMatch) return tokenMatch.text;
  }
  return nearby[0]?.text ?? snippets.find((snippet) => snippet.callIndex > fromCallIndex)?.text ?? null;
}

export function enrichLedgerToolOutputs(calls: CallLedgerEntry[]): CallLedgerEntry[] {
  const snippets = collectErrorSnippets(calls);
  if (snippets.length === 0) return calls;

  return calls.map((call) => ({
    ...call,
    tools: call.tools.map((tool) => {
      if (!tool.output) return tool;

      if (hasErrorDetail(tool.output)) {
        const header = extractVerificationHeader(tool.output);
        return {
          ...tool,
          output: combineVerificationOutput(header, extractErrorFocus(tool.output), 800),
        };
      }

      if (isDomDump(tool.output)) {
        const error = findMatchingError(snippets, call.index, extractFailTestName(tool.detail));
        if (error) return { ...tool, output: error };
        return { ...tool, output: null };
      }

      if (tool.name === "bash" && hasFailureSummary(tool.output)) {
        const error = findMatchingError(snippets, call.index, extractFailTestName(tool.output));
        if (error) {
          return { ...tool, output: `${tool.output.trim()}\n\nCause: ${error}` };
        }
      }

      return tool;
    }),
  }));
}

function extractToolOutput(result: Record<string, unknown>): string | null {
  const content = result.content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0) {
      parts.push(block.text);
    }
  }
  if (parts.length === 0) return null;
  return truncateToolOutput(stripAnsi(parts.join("\n").trim()));
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
    output: execution.output,
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
        is_error: event.isError === true || result.isError === true,
        output: extractToolOutput(result),
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
        activity: "other",
        tools: [],
      });
    }
  }

  flushPendingTools();

  for (const call of calls) {
    call.activity = classifyCallActivity(call.tools);
  }

  return {
    schema: CALL_LEDGER_SCHEMA,
    run_id: runId,
    source_events: eventsPath,
    classifier_version: CLASSIFIER_VERSION,
    weights: EFFICIENCY_WEIGHTS,
    calls,
    activity_summary: summarizeActivities(calls),
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

  const eventsContent = await readFile(eventsPath, "utf8");
  const ledger = buildCallLedgerFromEvents(eventsContent, runId, eventsPath);

  let hasResult = false;
  try {
    await access(resultPath);
    hasResult = true;
  } catch {
    hasResult = false;
  }

  if (!hasResult) {
    ledger.reconciliation = {
      matched: false,
      fields: [],
      official_missing: true,
    };
    ledger.calls = enrichLedgerToolOutputs(ledger.calls);
    return ledger;
  }

  const resultContent = await readFile(resultPath, "utf8");
  const official = JSON.parse(resultContent) as RunResult;
  const fromLedger = ledgerTotals(ledger.calls);
  const fields = compareUsage(official, fromLedger);
  ledger.reconciliation = {
    matched: fields.every((field) => field.match),
    fields,
  };
  ledger.calls = enrichLedgerToolOutputs(ledger.calls);
  return ledger;
}
