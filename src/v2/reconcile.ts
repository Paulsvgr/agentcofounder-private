import { readFile } from "node:fs/promises";
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
