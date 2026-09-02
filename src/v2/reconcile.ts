import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectUsageFromJsonLines } from "../usage.js";
import type { RunResult, UsageSummary } from "../types.js";

export const RECONCILE_SCHEMA = "agentcofounder.reconcile.v1" as const;

const TOKEN_FIELDS = [
  "model_calls",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "total_tokens",
  "reasoning_tokens",
  "cost_total",
] as const;

type TokenField = (typeof TOKEN_FIELDS)[number];

export interface ReconcileFieldDiff {
  field: TokenField;
  official: number;
  from_events: number;
  delta: number;
  match: boolean;
}

export interface ReconcileReport {
  schema?: typeof RECONCILE_SCHEMA;
  generated_at?: string;
  run_id: string;
  events_path: string;
  result_path: string;
  ok: boolean;
  fields: ReconcileFieldDiff[];
}

export interface PersistedReconcileReport extends ReconcileReport {
  schema: typeof RECONCILE_SCHEMA;
  generated_at: string;
}

export interface ReconcileSkip {
  run_id: string;
  reason: "missing_events" | "missing_result";
}

export interface ReconcileBatchReport {
  runs_directory: string;
  ok: string[];
  skipped: ReconcileSkip[];
  mismatches: ReconcileReport[];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pickUsageTotals(source: UsageSummary): Record<TokenField, number> {
  return {
    model_calls: source.model_calls,
    input_tokens: source.input_tokens,
    output_tokens: source.output_tokens,
    cache_read_tokens: source.cache_read_tokens,
    cache_write_tokens: source.cache_write_tokens,
    total_tokens: source.total_tokens,
    reasoning_tokens: source.reasoning_tokens,
    cost_total: source.cost_total,
  };
}

export function compareUsage(official: UsageSummary, fromEvents: UsageSummary): ReconcileFieldDiff[] {
  const officialTotals = pickUsageTotals(official);
  const eventTotals = pickUsageTotals(fromEvents);

  return TOKEN_FIELDS.map((field) => {
    const officialValue = officialTotals[field];
    const fromEventsValue = eventTotals[field];
    const delta = fromEventsValue - officialValue;
    return {
      field,
      official: officialValue,
      from_events: fromEventsValue,
      delta,
      match: delta === 0,
    };
  });
}

export function reconcileAnalysisPath(repositoryRoot: string, runId: string): string {
  return path.join(repositoryRoot, "artifacts", "analysis", runId, "reconcile.json");
}

export function toPersistedReconcileReport(report: ReconcileReport): PersistedReconcileReport {
  return {
    schema: RECONCILE_SCHEMA,
    generated_at: new Date().toISOString(),
    run_id: report.run_id,
    events_path: report.events_path,
    result_path: report.result_path,
    ok: report.ok,
    fields: report.fields,
  };
}

export async function persistReconcileReport(
  repositoryRoot: string,
  report: ReconcileReport,
): Promise<string> {
  const outputPath = reconcileAnalysisPath(repositoryRoot, report.run_id);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(toPersistedReconcileReport(report), null, 2)}\n`, "utf8");
  return outputPath;
}

export async function readReconcileReportOptional(
  repositoryRoot: string,
  runId: string,
): Promise<PersistedReconcileReport | null> {
  try {
    const raw = await readFile(reconcileAnalysisPath(repositoryRoot, runId), "utf8");
    return JSON.parse(raw) as PersistedReconcileReport;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function reconcileRunIfPossible(runDirectory: string): Promise<ReconcileReport | null> {
  const runId = path.basename(runDirectory);
  const eventsPath = path.join(runDirectory, "events.jsonl");
  const resultPath = path.join(runDirectory, "result.json");

  const hasEvents = await pathExists(eventsPath);
  const hasResult = await pathExists(resultPath);
  if (!hasEvents || !hasResult) return null;

  return reconcileRun(runDirectory);
}

export async function reconcileRun(runDirectory: string): Promise<ReconcileReport> {
  const runId = path.basename(runDirectory);
  const eventsPath = path.join(runDirectory, "events.jsonl");
  const resultPath = path.join(runDirectory, "result.json");

  const [eventsContent, resultContent] = await Promise.all([
    readFile(eventsPath, "utf8"),
    readFile(resultPath, "utf8"),
  ]);

  const official = JSON.parse(resultContent) as RunResult;
  const fromEvents = collectUsageFromJsonLines(eventsContent);
  const fields = compareUsage(official, fromEvents);

  return {
    run_id: runId,
    events_path: eventsPath,
    result_path: resultPath,
    ok: fields.every((field) => field.match),
    fields,
  };
}

export async function reconcileAllRuns(runsDirectory: string): Promise<ReconcileBatchReport> {
  const entries = await readdir(runsDirectory, { withFileTypes: true });
  const runIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  const ok: string[] = [];
  const skipped: ReconcileSkip[] = [];
  const mismatches: ReconcileReport[] = [];

  for (const runId of runIds) {
    const runDirectory = path.join(runsDirectory, runId);
    const eventsPath = path.join(runDirectory, "events.jsonl");
    const resultPath = path.join(runDirectory, "result.json");

    const hasEvents = await pathExists(eventsPath);
    const hasResult = await pathExists(resultPath);

    if (!hasEvents) {
      skipped.push({ run_id: runId, reason: "missing_events" });
      continue;
    }
    if (!hasResult) {
      skipped.push({ run_id: runId, reason: "missing_result" });
      continue;
    }

    const report = await reconcileRun(runDirectory);
    if (report.ok) {
      ok.push(runId);
    } else {
      mismatches.push(report);
    }
  }

  return {
    runs_directory: runsDirectory,
    ok,
    skipped,
    mismatches,
  };
}
