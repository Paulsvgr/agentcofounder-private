import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");
const ANALYSIS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "analysis");

/** Official efficiency formula. cacheWrite weight is undecided; default 0. */
export const WEIGHTS = {
  input: 1,
  output: 3,
  cacheRead: 0.1,
  cacheWrite: 0,
} as const;

export type HeuristicPhase = "recon" | "build" | "test_debug" | "finalize" | "mixed" | "other";

export interface ToolTag {
  name: string;
  detail: string;
  is_error: boolean;
}

export interface CallLedgerEntry {
  index: number;
  timestamp: string;
  seconds_since_start: number;
  gap_seconds: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  weighted_cost: number;
  cumulative_weighted: number;
  stop_reason: string | null;
  tools: ToolTag[];
  /** Heuristic only — a turn may mix activities. */
  phase_heuristic: HeuristicPhase;
}

export interface PhaseBucket {
  phase: HeuristicPhase;
  call_count: number;
  weighted_cost: number;
  share_of_total: number;
}

export interface RunAnalysis {
  run_id: string;
  provider: string | null;
  model: string | null;
  status: string | null;
  model_calls: number;
  wall_seconds: number;
  seconds_per_call: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  weighted_total: number;
  time_to_first_failing_test_s: number | null;
  time_to_final_green_s: number | null;
  npm_test_command_count: number;
  auto_test_trigger_hits: number;
  reconciliation: {
    matched: boolean;
    warnings: string[];
    result_json_path: string | null;
  };
  /** Heuristic phase rollup — labelled as such in consumers. */
  phase_heuristic: PhaseBucket[];
  calls: CallLedgerEntry[];
}

interface SessionUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  reasoning?: number;
}

interface SessionMessage {
  role: string;
  content?: unknown;
  usage?: SessionUsage;
  stopReason?: string;
  provider?: string;
  model?: string;
  toolName?: string;
  isError?: boolean;
  toolCallId?: string;
}

interface SessionRow {
  type: string;
  timestamp?: string;
  provider?: string;
  modelId?: string;
  message?: SessionMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseTimestamp(value: string): Date {
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

export function weightedCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}): number {
  return (
    usage.input_tokens * WEIGHTS.input +
    usage.output_tokens * WEIGHTS.output +
    usage.cache_read_tokens * WEIGHTS.cacheRead +
    usage.cache_write_tokens * WEIGHTS.cacheWrite
  );
}

function truncateDetail(value: string, max = 72): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function toolDetail(name: string, args: Record<string, unknown>): string {
  if (typeof args.command === "string") return truncateDetail(args.command);
  if (typeof args.path === "string") return truncateDetail(args.path);
  return truncateDetail(JSON.stringify(args));
}

function extractToolTags(content: unknown): ToolTag[] {
  if (!Array.isArray(content)) return [];
  const tags: ToolTag[] = [];
  for (const block of content) {
    if (!isRecord(block) || block.type !== "toolCall") continue;
    const name = typeof block.name === "string" ? block.name : "unknown";
    const args = isRecord(block.arguments) ? block.arguments : {};
    tags.push({ name, detail: toolDetail(name, args), is_error: false });
  }
  return tags;
}

function isNpmTestCommand(detail: string): boolean {
  if (/\bnpm\s+(?:run\s+)?test\b/i.test(detail)) return true;
  // Match `vitest` as a command, not filenames like vitest.config.ts.
  return /(?:^|[;&|]\s*|\/)\.?\/?vitest(?:\s|$)/i.test(detail) || /\bnpx\s+vitest\b/i.test(detail);
}

function isTestFilePath(detail: string): boolean {
  return /\.test\.[tj]sx?\b/.test(detail) || /[/\\]test[/\\]setup\.[tj]sx?\b/.test(detail);
}

function isDevServerCommand(detail: string): boolean {
  return /\bnpm\s+run\s+dev\b/i.test(detail) || /(?:^|[;&|]\s*)vite(?:\s|$)/i.test(detail);
}

function isBuildCommand(detail: string): boolean {
  return /\bnpm\s+run\s+build\b/i.test(detail);
}

function isReportWrite(detail: string): boolean {
  return /report\.partial\.json\b/.test(detail);
}

/** Heuristic only — turns often mix activities. */
export function classifyPhaseHeuristic(tools: ToolTag[]): HeuristicPhase {
  if (tools.length === 0) return "finalize";

  const names = new Set(tools.map((tool) => tool.name));
  const details = tools.map((tool) => tool.detail);
  const hasTestCmd = details.some(isNpmTestCommand);
  const hasBuild = details.some(isBuildCommand);
  const hasDev = details.some(isDevServerCommand);
  const hasReport = details.some(isReportWrite);
  const hasWrite = names.has("write") || names.has("edit");
  const hasRead = names.has("read") || names.has("bash");
  const onlyReadish =
    [...names].every((name) => name === "read" || name === "bash") &&
    !hasTestCmd &&
    !hasBuild &&
    !hasDev &&
    !hasReport;

  const categories = new Set<HeuristicPhase>();
  if (onlyReadish) categories.add("recon");
  if (hasWrite && !hasReport) categories.add("build");
  if (hasTestCmd || details.some((detail) => isTestFilePath(detail))) categories.add("test_debug");
  if (hasBuild || hasDev || hasReport || tools.length === 0) categories.add("finalize");

  if (categories.size === 0) return "other";
  if (categories.size > 1) return "mixed";
  const [only] = [...categories];
  return only ?? "other";
}

async function findSessionFile(runDirectory: string): Promise<string | undefined> {
  const sessionsDirectory = path.join(runDirectory, "sessions");
  try {
    const entries = await readdir(sessionsDirectory);
    const jsonl = entries.filter((name) => name.endsWith(".jsonl")).sort();
    const first = jsonl[0];
    return first ? path.join(sessionsDirectory, first) : undefined;
  } catch {
    return undefined;
  }
}

async function loadJsonl(filePath: string): Promise<SessionRow[]> {
  const raw = await readFile(filePath, "utf8");
  const rows: SessionRow[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line) as SessionRow);
    } catch {
      // Keep going; a malformed line is retained in the raw artifact.
    }
  }
  return rows;
}

async function loadResultJson(runId: string, runDirectory: string): Promise<{
  path: string | null;
  status: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_tokens: number | null;
  model_calls: number | null;
}> {
  const candidates = [
    path.join(runDirectory, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `a-prime-zai-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `b-prime-zai-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `c-prime-zai-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `c-prime-zai-clean-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `a-prime-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `b-prime-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `c-prime-openai-${runId}`, "result.json"),
    path.join(REPOSITORY_ROOT, "saved-apps", `c-prime-gpt41-${runId}`, "result.json"),
  ];

  // Also scan saved-apps for any folder ending with the run id.
  try {
    const saved = await readdir(path.join(REPOSITORY_ROOT, "saved-apps"));
    for (const name of saved) {
      if (name.includes(runId)) {
        candidates.push(path.join(REPOSITORY_ROOT, "saved-apps", name, "result.json"));
      }
    }
  } catch {
    // optional
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, "utf8")) as Record<string, unknown>;
      return {
        path: candidate,
        status: typeof parsed.status === "string" ? parsed.status : null,
        input_tokens: finiteNonNegative(parsed.input_tokens) ? parsed.input_tokens : null,
        output_tokens: finiteNonNegative(parsed.output_tokens) ? parsed.output_tokens : null,
        cache_read_tokens: finiteNonNegative(parsed.cache_read_tokens) ? parsed.cache_read_tokens : null,
        cache_write_tokens: finiteNonNegative(parsed.cache_write_tokens) ? parsed.cache_write_tokens : null,
        total_tokens: finiteNonNegative(parsed.total_tokens) ? parsed.total_tokens : null,
        model_calls: finiteNonNegative(parsed.model_calls) ? parsed.model_calls : null,
      };
    } catch {
      // try next
    }
  }

  return {
    path: null,
    status: null,
    input_tokens: null,
    output_tokens: null,
    cache_read_tokens: null,
    cache_write_tokens: null,
    total_tokens: null,
    model_calls: null,
  };
}

function applyToolErrors(tools: ToolTag[], toolResults: Map<string, boolean>): void {
  // Session rows do not always join by id in order; mark by sequential matching of toolName.
  void toolResults;
  for (const tool of tools) {
    // Errors are attached later when we walk toolResult messages between assistants.
    void tool;
  }
}

export async function analyzeRun(runId: string): Promise<RunAnalysis> {
  const runDirectory = path.join(RUNS_DIRECTORY, runId);
  const sessionPath = await findSessionFile(runDirectory);
  if (!sessionPath) {
    throw new Error(`No session JSONL found under artifacts/runs/${runId}/sessions/`);
  }

  const rows = await loadJsonl(sessionPath);
  let provider: string | null = null;
  let model: string | null = null;
  for (const row of rows) {
    if (row.type === "model_change") {
      provider = typeof row.provider === "string" ? row.provider : provider;
      model = typeof row.modelId === "string" ? row.modelId : model;
    }
  }

  const messages = rows.filter((row) => row.type === "message" && row.message && row.timestamp);
  const assistantMessages = messages.filter((row) => row.message?.role === "assistant");
  if (assistantMessages.length === 0) {
    throw new Error(`Session for ${runId} has no assistant messages`);
  }

  const start = parseTimestamp(messages[0]?.timestamp ?? assistantMessages[0]!.timestamp!);
  const end = parseTimestamp(messages[messages.length - 1]!.timestamp!);
  const wallSeconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);

  // Map toolCallId -> isError from intervening toolResult messages.
  const errorByCallId = new Map<string, boolean>();
  for (const row of messages) {
    const message = row.message;
    if (!message || message.role !== "toolResult") continue;
    if (typeof message.toolCallId === "string") {
      errorByCallId.set(message.toolCallId, Boolean(message.isError));
    }
  }

  const calls: CallLedgerEntry[] = [];
  let cumulative = 0;
  let previousTime = start;
  let timeToFirstFailingTest: number | null = null;
  let timeToFinalGreen: number | null = null;
  let lastGreenAt: number | null = null;
  let npmTestCommandCount = 0;
  let autoTestTriggerHits = 0;

  // Flat tool sequence across the run for trigger analysis.
  const flatTools: Array<{ callIndex: number; name: string; detail: string }> = [];

  for (const row of assistantMessages) {
    const message = row.message!;
    const timestamp = row.timestamp!;
    const at = parseTimestamp(timestamp);
    const usage = message.usage;
    const input = usage?.input ?? 0;
    const output = usage?.output ?? 0;
    const cacheRead = usage?.cacheRead ?? 0;
    const cacheWrite = usage?.cacheWrite ?? 0;
    const reasoning = usage?.reasoning ?? 0;
    const total = usage?.totalTokens ?? input + output + cacheRead + cacheWrite;
    const weighted = weightedCost({
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
    });
    cumulative += weighted;

    const tools = extractToolTags(message.content);
    // Attach errors by scanning toolCall ids in content.
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (!isRecord(block) || block.type !== "toolCall") continue;
        const id = typeof block.id === "string" ? block.id : undefined;
        if (!id) continue;
        const tag = tools.find((tool) => tool.name === block.name && !tool.is_error);
        if (tag && errorByCallId.has(id)) {
          tag.is_error = Boolean(errorByCallId.get(id));
        }
      }
    }
    applyToolErrors(tools, errorByCallId);

    const index = calls.length + 1;
    for (const tool of tools) {
      flatTools.push({ callIndex: index, name: tool.name, detail: tool.detail });
    }

    const hasTest = tools.some((tool) => tool.name === "bash" && isNpmTestCommand(tool.detail));
    if (hasTest) {
      npmTestCommandCount += 1;
      const failed = tools.some(
        (tool) => tool.name === "bash" && isNpmTestCommand(tool.detail) && tool.is_error,
      );
      const seconds = (at.getTime() - start.getTime()) / 1000;
      if (failed && timeToFirstFailingTest === null) timeToFirstFailingTest = seconds;
      if (!failed) lastGreenAt = seconds;
    }

    if (provider === null && typeof message.provider === "string") provider = message.provider;
    if (model === null && typeof message.model === "string") model = message.model;

    calls.push({
      index,
      timestamp,
      seconds_since_start: (at.getTime() - start.getTime()) / 1000,
      gap_seconds: (at.getTime() - previousTime.getTime()) / 1000,
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      reasoning_tokens: reasoning,
      total_tokens: total,
      weighted_cost: weighted,
      cumulative_weighted: cumulative,
      stop_reason: typeof message.stopReason === "string" ? message.stopReason : null,
      tools,
      phase_heuristic: classifyPhaseHeuristic(tools),
    });
    previousTime = at;
  }

  timeToFinalGreen = lastGreenAt;

  for (let i = 0; i < flatTools.length; i += 1) {
    const current = flatTools[i]!;
    if (current.name !== "bash" || !isNpmTestCommand(current.detail)) continue;
    const previous = flatTools[i - 1];
    if (
      previous &&
      (previous.name === "write" || previous.name === "edit") &&
      isTestFilePath(previous.detail)
    ) {
      autoTestTriggerHits += 1;
    }
  }

  const totals = calls.reduce(
    (sum, call) => ({
      input: sum.input + call.input_tokens,
      output: sum.output + call.output_tokens,
      cacheRead: sum.cacheRead + call.cache_read_tokens,
      cacheWrite: sum.cacheWrite + call.cache_write_tokens,
      total: sum.total + call.total_tokens,
      reasoning: sum.reasoning + call.reasoning_tokens,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, reasoning: 0 },
  );

  const result = await loadResultJson(runId, runDirectory);
  const warnings: string[] = [];
  if (!result.path) {
    warnings.push("result.json not found next to run or in saved-apps; skipped reconciliation");
  } else {
    if (result.model_calls !== null && result.model_calls !== calls.length) {
      warnings.push(
        `model_calls mismatch: session=${calls.length} result.json=${result.model_calls}`,
      );
    }
    if (result.input_tokens !== null && result.input_tokens !== totals.input) {
      warnings.push(`input_tokens mismatch: session=${totals.input} result.json=${result.input_tokens}`);
    }
    if (result.output_tokens !== null && result.output_tokens !== totals.output) {
      warnings.push(
        `output_tokens mismatch: session=${totals.output} result.json=${result.output_tokens}`,
      );
    }
    if (result.cache_read_tokens !== null && result.cache_read_tokens !== totals.cacheRead) {
      warnings.push(
        `cache_read_tokens mismatch: session=${totals.cacheRead} result.json=${result.cache_read_tokens}`,
      );
    }
    if (result.cache_write_tokens !== null && result.cache_write_tokens !== totals.cacheWrite) {
      warnings.push(
        `cache_write_tokens mismatch: session=${totals.cacheWrite} result.json=${result.cache_write_tokens}`,
      );
    }
    if (result.total_tokens !== null && result.total_tokens !== totals.total) {
      warnings.push(`total_tokens mismatch: session=${totals.total} result.json=${result.total_tokens}`);
    }
  }

  const phaseMap = new Map<HeuristicPhase, { call_count: number; weighted_cost: number }>();
  for (const call of calls) {
    const bucket = phaseMap.get(call.phase_heuristic) ?? { call_count: 0, weighted_cost: 0 };
    bucket.call_count += 1;
    bucket.weighted_cost += call.weighted_cost;
    phaseMap.set(call.phase_heuristic, bucket);
  }
  const phaseHeuristic: PhaseBucket[] = [...phaseMap.entries()]
    .map(([phase, bucket]) => ({
      phase,
      call_count: bucket.call_count,
      weighted_cost: bucket.weighted_cost,
      share_of_total: cumulative > 0 ? bucket.weighted_cost / cumulative : 0,
    }))
    .sort((a, b) => b.weighted_cost - a.weighted_cost);

  return {
    run_id: runId,
    provider,
    model,
    status: result.status,
    model_calls: calls.length,
    wall_seconds: wallSeconds,
    seconds_per_call: calls.length > 0 ? wallSeconds / calls.length : null,
    input_tokens: totals.input,
    output_tokens: totals.output,
    cache_read_tokens: totals.cacheRead,
    cache_write_tokens: totals.cacheWrite,
    total_tokens: totals.total,
    reasoning_tokens: totals.reasoning,
    weighted_total: cumulative,
    time_to_first_failing_test_s: timeToFirstFailingTest,
    time_to_final_green_s: timeToFinalGreen,
    npm_test_command_count: npmTestCommandCount,
    auto_test_trigger_hits: autoTestTriggerHits,
    reconciliation: {
      matched: warnings.length === 0 && result.path !== null,
      warnings,
      result_json_path: result.path,
    },
    phase_heuristic: phaseHeuristic,
    calls,
  };
}

export function formatAnalysisTable(analysis: RunAnalysis): string {
  const lines: string[] = [];
  lines.push(
    `run=${analysis.run_id} provider=${analysis.provider ?? "?"} model=${analysis.model ?? "?"} status=${analysis.status ?? "?"}`,
  );
  lines.push(
    `calls=${analysis.model_calls} wall=${analysis.wall_seconds.toFixed(0)}s s/call=${analysis.seconds_per_call?.toFixed(1) ?? "n/a"} weighted=${analysis.weighted_total.toFixed(0)}`,
  );
  lines.push(
    `npm_test_cmds=${analysis.npm_test_command_count} auto_test_trigger_hits=${analysis.auto_test_trigger_hits} first_fail=${analysis.time_to_first_failing_test_s?.toFixed(0) ?? "n/a"}s final_green=${analysis.time_to_final_green_s?.toFixed(0) ?? "n/a"}s`,
  );
  if (analysis.reconciliation.warnings.length > 0) {
    lines.push("reconciliation warnings:");
    for (const warning of analysis.reconciliation.warnings) lines.push(`  - ${warning}`);
  } else if (analysis.reconciliation.matched) {
    lines.push("reconciliation: matched result.json");
  }
  lines.push("");
  lines.push("phase_heuristic (NOT ground truth):");
  for (const bucket of analysis.phase_heuristic) {
    lines.push(
      `  ${bucket.phase.padEnd(12)} calls=${String(bucket.call_count).padStart(3)} weighted=${bucket.weighted_cost.toFixed(0).padStart(8)} share=${(bucket.share_of_total * 100).toFixed(1)}%`,
    );
  }
  lines.push("");
  lines.push(
    `${"#".padStart(3)} ${"t+s".padStart(5)} ${"gap".padStart(5)} ${"in".padStart(6)} ${"out".padStart(5)} ${"cacheR".padStart(7)} ${"weight".padStart(8)} ${"cumul".padStart(8)}  tools / phase_heuristic`,
  );
  for (const call of analysis.calls) {
    const toolSummary =
      call.tools.length === 0
        ? "(no tools)"
        : call.tools.map((tool) => `${tool.name}:${tool.detail}`).join(" | ");
    lines.push(
      `${String(call.index).padStart(3)} ${call.seconds_since_start.toFixed(0).padStart(5)} ${call.gap_seconds.toFixed(0).padStart(5)} ${String(call.input_tokens).padStart(6)} ${String(call.output_tokens).padStart(5)} ${String(call.cache_read_tokens).padStart(7)} ${call.weighted_cost.toFixed(0).padStart(8)} ${call.cumulative_weighted.toFixed(0).padStart(8)}  [${call.phase_heuristic}] ${toolSummary.slice(0, 96)}`,
    );
  }
  return lines.join("\n");
}

export async function writeAnalysis(analysis: RunAnalysis): Promise<string> {
  await mkdir(ANALYSIS_DIRECTORY, { recursive: true });
  const target = path.join(ANALYSIS_DIRECTORY, `${analysis.run_id}.json`);
  await writeFile(target, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  return target;
}

async function listRunIds(): Promise<string[]> {
  const entries = await readdir(RUNS_DIRECTORY, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run analyze -- <run-id|--all>");
    process.exitCode = 2;
    return;
  }

  const runIds = arg === "--all" ? await listRunIds() : [arg];
  const summaries: Array<{
    run_id: string;
    provider: string | null;
    model: string | null;
    status: string | null;
    model_calls: number;
    wall_seconds: number;
    seconds_per_call: number | null;
    weighted_total: number;
    npm_test_command_count: number;
    auto_test_trigger_hits: number;
    matched: boolean;
  }> = [];

  for (const runId of runIds) {
    try {
      const analysis = await analyzeRun(runId);
      const outPath = await writeAnalysis(analysis);
      if (arg !== "--all") {
        console.log(formatAnalysisTable(analysis));
        console.log(`\nWrote ${outPath}`);
      } else {
        console.log(
          `${runId}  ${analysis.provider ?? "?"}/${analysis.model ?? "?"}  calls=${analysis.model_calls}  wall=${analysis.wall_seconds.toFixed(0)}s  weighted=${analysis.weighted_total.toFixed(0)}  trigger_hits=${analysis.auto_test_trigger_hits}/${analysis.npm_test_command_count}`,
        );
      }
      summaries.push({
        run_id: analysis.run_id,
        provider: analysis.provider,
        model: analysis.model,
        status: analysis.status,
        model_calls: analysis.model_calls,
        wall_seconds: analysis.wall_seconds,
        seconds_per_call: analysis.seconds_per_call,
        weighted_total: analysis.weighted_total,
        npm_test_command_count: analysis.npm_test_command_count,
        auto_test_trigger_hits: analysis.auto_test_trigger_hits,
        matched: analysis.reconciliation.matched,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${runId}: ${message}`);
      process.exitCode = 1;
    }
  }

  if (arg === "--all") {
    await mkdir(ANALYSIS_DIRECTORY, { recursive: true });
    const indexPath = path.join(ANALYSIS_DIRECTORY, "index.json");
    await writeFile(indexPath, `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
    console.log(`\nWrote corpus index ${indexPath} (${summaries.length} runs)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
