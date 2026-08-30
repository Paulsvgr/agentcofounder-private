import { describe, expect, it } from "vitest";
import {
  aggregateRunStats,
  cacheHitRatio,
  experimentKey,
  groupKeyForRun,
  median,
  weightedPartsOf,
} from "../web/src/lib/run-stats.js";
import type { RunSummary } from "../web/src/lib/api.js";

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    run_id: "2026-08-30T10-00-00-000Z",
    status: "success",
    provider: "zai",
    model: "glm-5.2",
    thinking: "off",
    model_calls: 30,
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_tokens: 9000,
    weighted_cost: 1000 + 500 * 3 + 9000 * 0.1,
    wall_ms: 120_000,
    max_output_per_call: 100,
    cohort: null,
    arm: null,
    rep: null,
    intervention: null,
    config_hash: null,
    has_manifest: true,
    has_result: true,
    has_analysis: false,
    has_sessions: false,
    can_replay: false,
    has_generated_app: false,
    generated_app_path: null,
    has_replay: false,
    replay_verdict: null,
    mega_call_flag: false,
    created_at: null,
    author: "alice",
    display_label: "baseline",
    experiment_slug: "baseline",
    app_rating: 7,
    app_comment: null,
    run_comment: null,
    git_branch_overlay: null,
    has_overlay: false,
    exclude_from_ranking: false,
    ...overrides,
  };
}

describe("run-stats", () => {
  it("computes median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("aggregates token stats for filtered runs", () => {
    const stats = aggregateRunStats([
      makeRun(),
      makeRun({ status: "failed", weighted_cost: 2000, model_calls: 20, wall_ms: 60_000 }),
    ]);
    expect(stats?.runCount).toBe(2);
    expect(stats?.successRate).toBe(0.5);
    expect(stats?.medianCalls).toBe(25);
    expect(stats?.tokens.input).toBe(2000);
  });

  it("computes weighted parts with official formula", () => {
    const parts = weightedPartsOf({
      input: 100,
      output: 50,
      cacheRead: 1000,
      cacheWrite: 0,
      reasoning: 0,
    });
    expect(parts.total).toBe(100 + 150 + 100);
  });

  it("computes cache hit ratio", () => {
    expect(cacheHitRatio({ input: 100, output: 0, cacheRead: 900, cacheWrite: 0, reasoning: 0 })).toBe(
      0.9,
    );
  });

  it("groups runs by experiment key", () => {
    expect(experimentKey(makeRun())).toBe("baseline");
    expect(experimentKey(makeRun({ experiment_slug: null, display_label: "legacy" }))).toBe("legacy");
    expect(groupKeyForRun(makeRun(), "author")).toBe("alice");
  });
});
