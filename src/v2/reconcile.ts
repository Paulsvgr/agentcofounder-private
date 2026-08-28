import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { collectUsageFromJsonLines } from "../usage.js";
import type { RunResult, UsageSummary } from "../types.js";

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
  run_id: string;
  events_path: string;
  result_path: string;
  ok: boolean;
  fields: ReconcileFieldDiff[];
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
