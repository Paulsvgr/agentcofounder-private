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
  npm_test_command_count: 1,
  auto_test_trigger_hits: 0,
  reconciliation: { matched: true, warnings: [], result_json_path: null },
  phase_heuristic: [{ phase: "build", call_count: 2, weighted_cost: 80, share_of_total: 1 }],
  calls: [],
} satisfies RunAnalysis;

describe("buildRunExport", () => {
  it("emits v1 schema with meta/harness/efficiency and no human block", () => {
    const payload = buildRunExport(result, analysis, {
      approach: "base",
      recordedAt: "2026-08-21T18:00:00.000Z",
      git_branch: "setup/measure",
      git_commit: "abc123",
    });

    expect(payload.schema).toBe(RUN_EXPORT_SCHEMA);
    expect(payload.meta).toEqual({
      run_id: "2026-08-21T17-12-43-573Z",
      recorded_at: "2026-08-21T18:00:00.000Z",
      git_branch: "setup/measure",
      git_commit: "abc123",
      approach: "base",
      classification: {
        line: "A",
        experiment: "baseline",
        run_index: null,
        display_label: "A · baseline",
      },
      provider: "zai",
      model: "glm-5.2",
    });
    expect(payload.harness.status).toBe("success");
    expect(payload.harness.summary).toBe("test app");
    expect(payload.efficiency.weighted_total).toBe(80);
    expect(payload.efficiency.phase_heuristic).toHaveLength(1);
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
