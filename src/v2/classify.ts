import type { LedgerTool } from "./normalize.js";
import { isCssPath, isReportWrite, isSourceFilePath, isTestFilePath } from "./source-paths.js";

/** Heuristic activity label for one model call — a turn may mix work. */
export type ActivityPhase =
  | "recon"
  | "source"
  | "css"
  | "test"
  | "build"
  | "finalize"
  | "repair"
  | "mixed"
  | "other";

export const ACTIVITY_CLASSIFIER_VERSION = "v2-activity-paths" as const;

export function isNpmTestCommand(detail: string): boolean {
  if (/\bnpm\s+(?:run\s+)?test\b/i.test(detail)) return true;
  return /(?:^|[;&|]\s*|\/)\.?\/?vitest(?:\s|$)/i.test(detail) || /\bnpx\s+vitest\b/i.test(detail);
}

export function isBuildCommand(detail: string): boolean {
  return /\bnpm\s+run\s+build\b/i.test(detail);
}

export function isDevServerCommand(detail: string): boolean {
  return /\bnpm\s+run\s+dev\b/i.test(detail) || /(?:^|[;&|]\s*)vite(?:\s|$)/i.test(detail);
}

function toolSignals(tool: LedgerTool): Set<ActivityPhase> {
  const signals = new Set<ActivityPhase>();
  const details = [tool.detail, ...tool.paths];

  if (tool.is_error) {
    signals.add("repair");
  }

  if (tool.name === "write" || tool.name === "edit") {
    for (const detail of details) {
      if (isCssPath(detail)) signals.add("css");
      else if (isSourceFilePath(detail) || isTestFilePath(detail)) signals.add("source");
    }
  }

  if (tool.name === "bash") {
    for (const detail of details) {
      if (isNpmTestCommand(detail)) signals.add("test");
      if (isBuildCommand(detail)) signals.add("build");
      if (isDevServerCommand(detail)) signals.add("finalize");
      if (isReportWrite(detail)) signals.add("finalize");
      if (/\bsed\s+-i\b/.test(detail) || /\bperl\s+-pi/.test(detail)) {
        if (isCssPath(detail)) signals.add("css");
        else if (isSourceFilePath(detail)) signals.add("source");
      }
    }
  }

  if (tool.name === "read") {
    for (const detail of details) {
      if (isTestFilePath(detail)) signals.add("test");
      else if (isCssPath(detail)) signals.add("css");
      else if (isSourceFilePath(detail)) signals.add("recon");
      else signals.add("recon");
    }
  }

  return signals;
}

function collapseActivities(categories: Set<ActivityPhase>): ActivityPhase {
  if (categories.size === 0) return "other";
  if (categories.has("repair") && categories.size > 1) return "mixed";
  if (categories.size > 1) return "mixed";

  const only = [...categories][0];
  if (only === undefined) return "other";
  switch (only) {
    case "recon":
    case "source":
    case "css":
    case "test":
    case "build":
    case "finalize":
    case "repair":
    case "mixed":
    case "other":
      return only;
    default: {
      const _exhaustive: never = only;
      return _exhaustive;
    }
  }
}

/** Classify one call from its tools and paths. Heuristic only — not ground truth. */
export function classifyCallActivity(tools: LedgerTool[]): ActivityPhase {
  if (tools.length === 0) return "finalize";

  const categories = new Set<ActivityPhase>();
  for (const tool of tools) {
    for (const signal of toolSignals(tool)) {
      categories.add(signal);
    }
  }

  const names = new Set(tools.map((tool) => tool.name));
  const details = tools.map((tool) => tool.detail);
  const hasTest = details.some((detail) => isNpmTestCommand(detail) || isTestFilePath(detail));
  const hasBuild = details.some(isBuildCommand);
  const hasDev = details.some(isDevServerCommand);
  const hasReport = details.some(isReportWrite);
  const hasWrite = names.has("write") || names.has("edit");
  const onlyReadish =
    [...names].every((name) => name === "read" || name === "bash") &&
    !hasTest &&
    !hasBuild &&
    !hasDev &&
    !hasReport &&
    !hasWrite;

  if (onlyReadish && categories.size === 0) {
    categories.add("recon");
  }

  if (hasWrite && !hasReport) {
    const hasCss = details.some(isCssPath);
    const hasSource = details.some(isSourceFilePath);
    if (hasCss) categories.add("css");
    if (hasSource) categories.add("source");
    if (!hasCss && !hasSource) categories.add("source");
  }

  if (hasTest) categories.add("test");
  if (hasBuild || hasDev || hasReport) categories.add("finalize");

  return collapseActivities(categories);
}

export interface ActivityBucket {
  activity: ActivityPhase;
  call_count: number;
  weighted_cost: number;
  share_of_total: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  /** Share of this bucket's input+output+cache_read tokens. */
  input_share: number;
  output_share: number;
  cache_read_share: number;
}

export function summarizeActivities(
  calls: Array<{
    activity: ActivityPhase;
    weighted_cost: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens?: number;
  }>,
): ActivityBucket[] {
  const totals = new Map<
    ActivityPhase,
    {
      call_count: number;
      weighted_cost: number;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
    }
  >();
  let grandTotal = 0;

  for (const call of calls) {
    grandTotal += call.weighted_cost;
    const bucket = totals.get(call.activity) ?? {
      call_count: 0,
      weighted_cost: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    };
    bucket.call_count += 1;
    bucket.weighted_cost += call.weighted_cost;
    bucket.input_tokens += call.input_tokens;
    bucket.output_tokens += call.output_tokens;
    bucket.cache_read_tokens += call.cache_read_tokens;
    bucket.cache_write_tokens += call.cache_write_tokens ?? 0;
    totals.set(call.activity, bucket);
  }

  return [...totals.entries()]
    .map(([activity, bucket]) => {
      const tokenTotal = bucket.input_tokens + bucket.output_tokens + bucket.cache_read_tokens;
      return {
        activity,
        call_count: bucket.call_count,
        weighted_cost: bucket.weighted_cost,
        share_of_total: grandTotal > 0 ? bucket.weighted_cost / grandTotal : 0,
        input_tokens: bucket.input_tokens,
        output_tokens: bucket.output_tokens,
        cache_read_tokens: bucket.cache_read_tokens,
        cache_write_tokens: bucket.cache_write_tokens,
        input_share: tokenTotal > 0 ? bucket.input_tokens / tokenTotal : 0,
        output_share: tokenTotal > 0 ? bucket.output_tokens / tokenTotal : 0,
        cache_read_share: tokenTotal > 0 ? bucket.cache_read_tokens / tokenTotal : 0,
      };
    })
    .sort((left, right) => right.weighted_cost - left.weighted_cost);
}
