import type { RunSummary } from "./api.js";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function experimentKey(run: RunSummary): string {
  return run.experiment_slug ?? run.display_label ?? "unknown";
}

export function formatStatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export type TokenBreakdown = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
};

export type WeightedParts = {
  input: number;
  output: number;
  cacheRead: number;
  total: number;
};

export type RunStatsSummary = {
  runCount: number;
  successRate: number | null;
  medianWeighted: number | null;
  medianCalls: number | null;
  medianWall: number | null;
  tokens: TokenBreakdown;
  totalTokens: number;
  cacheHitRatio: number | null;
  weightedParts: WeightedParts;
  tokensPerCall: number | null;
  outputToInput: number | null;
};

function n(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function tokensOf(run: RunSummary): TokenBreakdown | null {
  if (
    run.input_tokens === null &&
    run.output_tokens === null &&
    run.cache_read_tokens === null
  ) {
    return null;
  }
  return {
    input: n(run.input_tokens),
    output: n(run.output_tokens),
    cacheRead: n(run.cache_read_tokens),
    cacheWrite: 0,
    reasoning: 0,
  };
}

export function sumTokens(parts: TokenBreakdown): number {
  return parts.input + parts.output + parts.cacheRead + parts.cacheWrite + parts.reasoning;
}

/** cache_read / (input + cache_read) */
export function cacheHitRatio(parts: TokenBreakdown): number | null {
  const denom = parts.input + parts.cacheRead;
  if (denom <= 0) return null;
  return parts.cacheRead / denom;
}

/** Official scoreboard: input + output×3 + cache_read×0.1 */
export function weightedPartsOf(parts: TokenBreakdown): WeightedParts {
  const input = parts.input;
  const output = parts.output * 3;
  const cacheRead = parts.cacheRead * 0.1;
  return { input, output, cacheRead, total: input + output + cacheRead };
}

export function aggregateRunStats(runs: RunSummary[]): RunStatsSummary | null {
  if (runs.length === 0) return null;

  const tokens: TokenBreakdown = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
  };
  const weighted: number[] = [];
  const calls: number[] = [];
  const walls: number[] = [];
  let success = 0;

  for (const run of runs) {
    const t = tokensOf(run);
    if (t) {
      tokens.input += t.input;
      tokens.output += t.output;
      tokens.cacheRead += t.cacheRead;
      tokens.cacheWrite += t.cacheWrite;
      tokens.reasoning += t.reasoning;
    }
    if (run.weighted_cost !== null) weighted.push(run.weighted_cost);
    if (run.model_calls !== null) calls.push(run.model_calls);
    if (run.wall_ms !== null) walls.push(run.wall_ms / 1000);
    if (run.status === "success") success += 1;
  }

  const parts = weightedPartsOf(tokens);
  const totalTokens = sumTokens(tokens);
  const totalCalls = calls.reduce((a, b) => a + b, 0);

  return {
    runCount: runs.length,
    successRate: runs.length ? success / runs.length : null,
    medianWeighted: median(weighted),
    medianCalls: median(calls),
    medianWall: median(walls),
    tokens,
    totalTokens,
    cacheHitRatio: cacheHitRatio(tokens),
    weightedParts: parts,
    tokensPerCall: totalCalls > 0 ? totalTokens / totalCalls : null,
    outputToInput: tokens.input > 0 ? tokens.output / tokens.input : null,
  };
}

export function medianWeightedByExperiment(runs: RunSummary[]): Map<string, number> {
  return medianWeightedByGroup(runs, "experiment");
}

export function medianWeightedByGroup(
  runs: RunSummary[],
  groupBy: ChartGroupKey,
): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const run of runs) {
    const key = groupKeyForRun(run, groupBy);
    const w = run.weighted_cost;
    if (w === null) continue;
    const list = buckets.get(key) ?? [];
    list.push(w);
    buckets.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, vals] of buckets) {
    const m = median(vals);
    if (m !== null) out.set(key, m);
  }
  return out;
}

export function successRateByGroup(
  runs: RunSummary[],
  groupBy: ChartGroupKey,
): Array<{ key: string; rate: number; success: number; total: number }> {
  const buckets = new Map<string, { ok: number; n: number }>();
  for (const run of runs) {
    const key = groupKeyForRun(run, groupBy);
    const b = buckets.get(key) ?? { ok: 0, n: 0 };
    b.n += 1;
    if (run.status === "success") b.ok += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([key, { ok, n }]) => ({
      key,
      rate: n ? ok / n : 0,
      success: ok,
      total: n,
    }))
    .sort((a, b) => a.rate - b.rate);
}

export function chartPalette(key: string): string {
  const colors = [
    "#3659c9",
    "#0891b2",
    "#7c3aed",
    "#ea580c",
    "#059669",
    "#be123c",
    "#475569",
    "#9333ea",
  ];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return colors[h % colors.length]!;
}

export function shortChartLabel(name: string, max = 28): string {
  const readable = name.replace(/-/g, " ");
  if (readable.length <= max) return readable;
  return `${readable.slice(0, max - 1)}…`;
}

export type ChartGroupKey = "experiment" | "model" | "provider" | "author";

export function groupKeyForRun(run: RunSummary, groupBy: ChartGroupKey): string {
  switch (groupBy) {
    case "experiment":
      return experimentKey(run);
    case "model":
      return run.model ?? "unknown";
    case "provider":
      return run.provider ?? "unknown";
    case "author":
      return run.author ?? "unassigned";
    default: {
      const exhaustive: never = groupBy;
      return exhaustive;
    }
  }
}
