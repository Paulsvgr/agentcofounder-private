import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareUsage, reconcileAllRuns, reconcileRun } from "../../src/v2/reconcile.js";
import type { UsageSummary } from "../../src/types.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE_RUN = "2026-08-28T09-59-12-356Z";

describe("compareUsage", () => {
  it("reports zero delta when totals match", () => {
    const usage: UsageSummary = {
      model_calls: 2,
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 50,
      cache_write_tokens: 5,
      total_tokens: 175,
      reasoning_tokens: 7,
      cost_total: 0.01,
      call_log: [],
    };
    const fields = compareUsage(usage, usage);
    expect(fields.every((field) => field.match)).toBe(true);
  });

  it("flags mismatched fields", () => {
    const official: UsageSummary = {
      model_calls: 2,
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 50,
      cache_write_tokens: 5,
      total_tokens: 175,
      reasoning_tokens: 0,
      cost_total: 0,
      call_log: [],
    };
    const fromEvents: UsageSummary = {
      ...official,
      output_tokens: 21,
      total_tokens: 176,
    };
    const fields = compareUsage(official, fromEvents);
    expect(fields.find((field) => field.field === "output_tokens")?.match).toBe(false);
    expect(fields.find((field) => field.field === "input_tokens")?.match).toBe(true);
  });
});

describe("reconcileRun", () => {
  it(`matches events.jsonl totals for ${SAMPLE_RUN}`, async () => {
    const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", SAMPLE_RUN);
    try {
      await readFile(path.join(runDirectory, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const report = await reconcileRun(runDirectory);
    expect(report.ok).toBe(true);
    expect(report.fields.every((field) => field.match)).toBe(true);
  });
});

describe("reconcileAllRuns", () => {
  it("reports no mismatches for complete local runs", async () => {
    const runsDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs");
    try {
      await readFile(path.join(runsDirectory, SAMPLE_RUN, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const report = await reconcileAllRuns(runsDirectory);
    expect(report.mismatches).toEqual([]);
    expect(report.ok.length).toBeGreaterThan(0);
  });
});
