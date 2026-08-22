import { describe, expect, it } from "vitest";
import { buildRunExport, RUN_EXPORT_SCHEMA } from "../src/export-run.js";
import type { RunAnalysis } from "../src/analyze-run.js";
import type { RunResult } from "../src/types.js";

const result = {
  status: "success",
  app_url: "http://localhost:3000",
  start_command: "npm run dev",
  summary: "test app",
  implemented_features: ["add book"],
  assumptions: ["local only"],
  tests_run: [{ command: "npm test", journey: "add book", result: "passed" }],
  harness_checks: [{ command: "vitest", journey: "suite green", result: "passed" }],
  model_calls: 2,
  input_tokens: 10,
  output_tokens: 20,
  cache_read_tokens: 100,
  cache_write_tokens: 0,
  total_tokens: 130,
  reasoning_tokens: 0,
  cost_total: 0,
  call_log: [],
  pi_exit_code: 0,
  telemetry_source: "pi-json-event-stream",
  port_reclamation: {
    preexisting_listener: false,
    listener_after_pi: false,
    attempted: false,
    reclaimed: false,
    process_ids: [],
    diagnostic: "ok",
  },
} satisfies RunResult;

const analysis = {
  run_id: "2026-08-21T17-12-43-573Z",
  provider: "zai",
  model: "glm-5.2",
  status: "success",
  model_calls: 2,
  wall_seconds: 12,
  seconds_per_call: 6,
  input_tokens: 10,
  output_tokens: 20,
  cache_read_tokens: 100,
  cache_write_tokens: 0,
  total_tokens: 130,
  reasoning_tokens: 0,
  weighted_total: 80,
  time_to_first_failing_test_s: null,
  time_to_final_green_s: 10,
  first_test_failure_s: null,
  first_green_s: 10,
  last_green_s: 10,
  green_to_exit_s: 2,
  npm_test_command_count: 1,
  manual_test_calls: 1,
  manual_build_calls: 1,
  test_reinspection_calls: 0,
  post_green_verification_calls: 0,
  auto_test_trigger_hits: 0,
  auto_test_candidate_events: 0,
  auto_test_actual_runs: 0,
  action_flow: [
    {
      stage: "build_app",
      call_count: 1,
      call_indexes: [1],
      wall_seconds: 5,
      raw_tokens: 130,
      weighted_tokens: 80,
      note: null,
    },
  ],
  action_flow_source: "derived",
  reconciliation: { matched: true, warnings: [], result_json_path: null },
  phase_heuristic: [{ phase: "build", call_count: 2, weighted_cost: 80, share_of_total: 1 }],
  calls: [],
} satisfies RunAnalysis;

describe("buildRunExport", () => {
  it("emits v2 schema with action_flow and corrected timing metrics", () => {
    const payload = buildRunExport(result, analysis, {
      approach: "base",
      recordedAt: "2026-08-21T18:00:00.000Z",
      git_branch: "setup/measure",
      git_commit: "abc123",
    });

    expect(payload.schema).toBe(RUN_EXPORT_SCHEMA);
    expect(payload.efficiency.first_green_s).toBe(10);
    expect(payload.efficiency.green_to_exit_s).toBe(2);
    expect(payload.efficiency.action_flow).toHaveLength(1);
    expect(payload.efficiency.action_flow_source).toBe("derived");
    expect(payload.efficiency.manual_test_calls).toBe(1);
    expect(payload.efficiency.manual_build_calls).toBe(1);
    expect(payload.efficiency.auto_test_candidate_events).toBe(0);
    expect(payload.efficiency.time_to_final_green_s).toBe(10);
    expect(payload).not.toHaveProperty("human");
    expect(JSON.stringify(payload)).not.toContain("app_rating");
  });

  it("derives classification from RUN_APPROACH labels", () => {
    const payload = buildRunExport(result, analysis, {
      approach: "A-autoverify-owned-2",
      git_branch: "exp/auto-verify",
      git_commit: "1641fb4",
    });
    expect(payload.meta.classification).toEqual({
      line: "A",
      experiment: "autoverify-owned",
      run_index: 2,
      display_label: "A · autoverify owned · run 2",
    });
  });

  it("omits call_log from the paste payload", () => {
    const payload = buildRunExport(result, analysis, {
      git_branch: "main",
      git_commit: "d0f0b49",
    });
    expect(JSON.stringify(payload)).not.toContain("call_log");
  });
});
