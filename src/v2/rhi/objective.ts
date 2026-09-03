import type { RunResult, TestRun } from "../../types.js";
import type { ExecutionTrace } from "./trace.js";

export interface ObjectiveSignals {
  tests_passed: boolean;
  build_success: boolean;
  http_success: boolean;
  journeys_passed: number;
  journeys_failed: number;
  required_files_present: boolean;
  status_score: number;
  quality_score: number;
  token_cost: number;
  agent_calls: number;
  tool_calls: number;
  quality_per_1k_tokens: number;
  quality_per_agent_call: number;
  quality_per_cost: number;
}

function checkPassed(checks: TestRun[] | undefined, needle: string): boolean {
  return (checks ?? []).some(
    (check) => check.result === "passed" && check.command.toLowerCase().includes(needle),
  );
}

export function scoreOutput(result: RunResult | null, trace: ExecutionTrace, hasAppSource: boolean): ObjectiveSignals {
  const checks = result?.harness_checks ?? [];
  const tests_passed = checkPassed(checks, "vitest") || checkPassed(checks, "test");
  const build_success = checkPassed(checks, "build");
  const http_success = checkPassed(checks, "dev") || checkPassed(checks, "http");
  const journeys = result?.tests_run ?? [];
  const journeys_passed = journeys.filter((row) => row.result === "passed").length;
  const journeys_failed = journeys.filter((row) => row.result === "failed").length;
  const status_score = result?.status === "success" ? 3 : result?.status === "partial" ? 1 : 0;

  const quality_score =
    (tests_passed ? 40 : 0) +
    (build_success ? 15 : 0) +
    (http_success ? 15 : 0) +
    Math.min(20, journeys_passed * 5) +
    status_score * 5 +
    (hasAppSource ? 5 : 0) -
    Math.min(10, journeys_failed * 2);

  const token_cost = trace.usage.total_tokens;
  const agent_calls = Math.max(1, trace.agent_calls);
  const tool_calls = trace.tool_calls;
  const safeQuality = Math.max(0, quality_score);

  return {
    tests_passed,
    build_success,
    http_success,
    journeys_passed,
    journeys_failed,
    required_files_present: hasAppSource,
    status_score,
    quality_score: safeQuality,
    token_cost,
    agent_calls,
    tool_calls,
    quality_per_1k_tokens: token_cost > 0 ? safeQuality / (token_cost / 1000) : safeQuality,
    quality_per_agent_call: safeQuality / agent_calls,
    quality_per_cost: token_cost > 0 ? safeQuality / token_cost : safeQuality,
  };
}

export function costRatio(current: ObjectiveSignals, previous: ObjectiveSignals): number {
  if (previous.token_cost <= 0) return current.token_cost > 0 ? Number.POSITIVE_INFINITY : 1;
  return current.token_cost / previous.token_cost;
}
