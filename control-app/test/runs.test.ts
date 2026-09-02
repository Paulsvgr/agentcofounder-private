import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listRunSummaries, summarizeRun } from "../server/runs.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNS_ROOT = path.join(REPO_ROOT, "artifacts", "runs");
const ANALYSIS_ROOT = path.join(REPO_ROOT, "artifacts", "analysis");

describe("run summarization", () => {
  it("lists runs without reading events.jsonl", async () => {
    const runs = await listRunSummaries(RUNS_ROOT, ANALYSIS_ROOT);
    expect(runs.length).toBeGreaterThan(50);
    expect(runs[0]?.run_id).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("summarizes Z.ai success run from manifest outcome", async () => {
    const runId = "2026-08-30T07-51-15-946Z";
    const summary = await summarizeRun(RUNS_ROOT, ANALYSIS_ROOT, runId);
    expect(summary.provider).toBe("zai");
    expect(summary.model).toBe("glm-5.2");
    expect(summary.status).toBe("success");
    expect(summary.output_tokens).toBe(15117);
    expect(summary.mega_call_flag).toBe(false);
    expect(summary.has_manifest).toBe(true);
    expect(summary.has_result).toBe(false);
  });

  it("summarizes Aug 28 reference success from result.json", async () => {
    const runId = "2026-08-28T10-21-11-512Z";
    const summary = await summarizeRun(RUNS_ROOT, ANALYSIS_ROOT, runId);
    expect(summary.status).toBe("success");
    expect(summary.provider).toBe("zai");
    expect(summary.model).toBe("glm-5.2");
    expect(summary.max_output_per_call).toBe(2459);
    expect(summary.mega_call_flag).toBe(false);
  });

  it("summarizes legacy run model from events.jsonl when no manifest", async () => {
    const runId = "2026-08-18T21-06-12-451Z";
    const summary = await summarizeRun(RUNS_ROOT, ANALYSIS_ROOT, runId);
    expect(summary.provider).toBe("berget");
    expect(summary.model).toBe("Qwen/Qwen3.8-27B-FP8");
    expect(summary.has_manifest).toBe(false);
    expect(summary.has_result).toBe(false);
  });

  it("marks failed Berget runs from manifest outcome without result.json", async () => {
    const runId = "2026-08-28T22-16-41-633Z";
    const summary = await summarizeRun(RUNS_ROOT, ANALYSIS_ROOT, runId);
    expect(summary.status).toBe("failed");
    expect(summary.has_result).toBe(false);
    expect(summary.has_manifest).toBe(true);
  });
});
