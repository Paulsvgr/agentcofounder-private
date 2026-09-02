import type { HackathonRunRecord } from "../types/runExport";
import { experimentKey } from "./classification";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function approachKey(run: HackathonRunRecord): string {
  const d = run.data;
  return (
    d.approach_kind ||
    d.export?.meta?.approach ||
    d.git_branch ||
    d.export?.meta?.git_branch ||
    "unknown"
  );
}

export function weightedOf(run: HackathonRunRecord): number | null {
  const w = run.data.export?.efficiency?.weighted_total;
  return typeof w === "number" ? w : null;
}

/** Median weighted_total grouped by structured experiment. */
export function medianWeightedByExperiment(
  runs: HackathonRunRecord[],
): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const run of runs) {
    const key = experimentKey(run);
    const w = weightedOf(run);
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

/** Median weighted_total for runs sharing the same approach / branch. */
export function medianWeightedByApproach(
  runs: HackathonRunRecord[],
): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const run of runs) {
    const key = approachKey(run);
    const w = weightedOf(run);
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

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function shortCommit(sha: string | null | undefined): string {
  if (!sha) return "—";
  return sha.slice(0, 7);
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

export type TokenStatsSummary = {
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

export function tokensOf(run: HackathonRunRecord): TokenBreakdown | null {
  const h = run.data.export?.harness;
  if (!h) return null;
  return {
    input: n(h.input_tokens),
    output: n(h.output_tokens),
    cacheRead: n(h.cache_read_tokens),
    cacheWrite: n(h.cache_write_tokens),
    reasoning: n(h.reasoning_tokens),
  };
}

export function sumTokens(parts: TokenBreakdown): number {
  return parts.input + parts.output + parts.cacheRead + parts.cacheWrite + parts.reasoning;
}

/** cache_read / (input + cache_read) — how much context came from cache. */
export function cacheHitRatio(parts: TokenBreakdown): number | null {
  const denom = parts.input + parts.cacheRead;
  if (denom <= 0) return null;
  return parts.cacheRead / denom;
}

/** Official scoreboard parts: input + output×3 + cache_read×0.1 */
export function weightedPartsOf(parts: TokenBreakdown): WeightedParts {
  const input = parts.input;
  const output = parts.output * 3;
  const cacheRead = parts.cacheRead * 0.1;
  return { input, output, cacheRead, total: input + output + cacheRead };
}

export function aggregateTokenStats(runs: HackathonRunRecord[]): TokenStatsSummary | null {
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
  let withStatus = 0;

  for (const run of runs) {
    const t = tokensOf(run);
    if (t) {
      tokens.input += t.input;
      tokens.output += t.output;
      tokens.cacheRead += t.cacheRead;
      tokens.cacheWrite += t.cacheWrite;
      tokens.reasoning += t.reasoning;
    }
    const w = weightedOf(run);
    if (w !== null) weighted.push(w);
    const c = run.data.export?.harness?.model_calls;
    if (typeof c === "number") calls.push(c);
    const wall = run.data.export?.efficiency?.wall_seconds;
    if (typeof wall === "number") walls.push(wall);
    const st = (run.data.export?.harness?.status || "").toLowerCase();
    if (st) {
      withStatus += 1;
      if (st === "success") success += 1;
    }
  }

  const parts = weightedPartsOf(tokens);
  const totalTokens = sumTokens(tokens);
  const totalCalls = calls.reduce((a, b) => a + b, 0);

  return {
    runCount: runs.length,
    successRate: withStatus ? success / withStatus : null,
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
