import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepairPrompt, failedCheckNames, repairAttemptsFromEnvironment, tailOf } from "../src/repair.js";
import { RunTrace, efficiencyScore, writeSummary } from "../src/trace.js";
import { mergeUsageSummaries } from "../src/usage.js";
import type { AppVerification, RunResult, UsageSummary } from "../src/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  delete process.env.CHALLENGE_REPAIR_ATTEMPTS;
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-repair-"));
  temporaryDirectories.push(directory);
  return directory;
}

const usage = (overrides: Partial<UsageSummary> = {}): UsageSummary => ({
  model_calls: 1,
  input_tokens: 100,
  output_tokens: 10,
  cache_read_tokens: 1_000,
  cache_write_tokens: 0,
  total_tokens: 1_110,
  reasoning_tokens: 0,
  cost_total: 0.001,
  call_log: [
    {
      index: 1,
      model: "provider/model",
      input_tokens: 100,
      output_tokens: 10,
      cache_read_tokens: 1_000,
      cache_write_tokens: 0,
      total_tokens: 1_110,
    },
  ],
  ...overrides,
});

const failedVerification: AppVerification = {
  passed: false,
  checks: [
    { command: "vitest run", journey: "Tests completed", result: "failed" },
    { command: "npm run build", journey: "Production build", result: "passed" },
    { command: "npm run dev", journey: "HTTP startup", result: "passed" },
  ],
};

describe("bounded repair", () => {
  it("summarizes only the failing checks and the tail of their logs", async () => {
    const directory = await temporaryDirectory();
    await writeFile(path.join(directory, "app-test.log"), `${"noise\n".repeat(50)}AssertionError: expected 1 to be 2`, "utf8");

    const prompt = await buildRepairPrompt(failedVerification, directory);

    expect(prompt).toContain("## Repair task");
    expect(prompt).toContain("`vitest run`");
    expect(prompt).not.toContain("- `npm run build`");
    expect(prompt).toContain("AssertionError: expected 1 to be 2");
    expect(prompt).toContain("Do not weaken, skip");
    expect(failedCheckNames(failedVerification)).toEqual(["vitest run"]);
  });

  it("returns no prompt when nothing failed", async () => {
    const directory = await temporaryDirectory();
    const passed: AppVerification = {
      passed: true,
      checks: failedVerification.checks.map((check) => ({ ...check, result: "passed" as const })),
    };
    expect(await buildRepairPrompt(passed, directory)).toBeUndefined();
  });

  it("keeps the end of a long log where the failure is", () => {
    expect(tailOf("abcdefghij", 4)).toBe("…\nghij");
    expect(tailOf("short", 40)).toBe("short");
  });

  it("bounds the configured repair attempts", () => {
    expect(repairAttemptsFromEnvironment()).toBe(1);
    process.env.CHALLENGE_REPAIR_ATTEMPTS = "0";
    expect(repairAttemptsFromEnvironment()).toBe(0);
    process.env.CHALLENGE_REPAIR_ATTEMPTS = "9";
    expect(() => repairAttemptsFromEnvironment()).toThrow(/between 0 and 3/u);
  });
});

describe("multi-call usage aggregation", () => {
  it("sums every Pi invocation and re-indexes the call log", () => {
    const merged = mergeUsageSummaries(usage(), usage({ output_tokens: 5, model_calls: 1 }));
    expect(merged.model_calls).toBe(2);
    expect(merged.output_tokens).toBe(15);
    expect(merged.input_tokens).toBe(200);
    expect(merged.call_log.map((call) => call.index)).toEqual([1, 2]);
  });

  it("weights efficiency the way the contest does", () => {
    expect(efficiencyScore(usage())).toBe(100 + 30 + 100);
  });
});

describe("run artifacts", () => {
  it("writes one trace line per phase and a readable summary", async () => {
    const directory = await temporaryDirectory();
    const trace = new RunTrace(path.join(directory, "trace.jsonl"));
    await trace.phase("implement", "pi-build", async () => 1, () => ({ status: "success" }));
    await trace.phase("verify", "attempt-1", async () => 2, () => ({ status: "failure", detail: "tests" }));

    const lines = (await readFile(path.join(directory, "trace.jsonl"), "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1] ?? "{}")).toMatchObject({ step: 2, phase: "verify", status: "failure" });

    const result: RunResult = {
      ...usage(),
      status: "success",
      app_url: "http://localhost:3000",
      start_command: "npm run dev",
      summary: "A tested application",
      implemented_features: ["Add a record"],
      assumptions: ["Single user"],
      tests_run: [{ command: "npm test", journey: "Add a record", result: "passed" }],
      harness_checks: [{ command: "npm run build", journey: "Build", result: "passed" }],
      pi_exit_code: 0,
      telemetry_source: "pi-json-event-stream",
      port_reclamation: {
        preexisting_listener: false,
        listener_after_pi: false,
        attempted: false,
        reclaimed: false,
        process_ids: [],
        diagnostic: "clean",
      },
    };
    await writeSummary(path.join(directory, "summary.md"), result, {
      ideaFile: "idea.txt",
      repairAttempts: 1,
      durationMs: 1_000,
      trace: trace.list(),
    });
    const summary = await readFile(path.join(directory, "summary.md"), "utf8");
    expect(summary).toContain("Status: **success**");
    expect(summary).toContain("Repair attempts: 1");
    expect(summary).toContain("Weighted efficiency");
    expect(summary).toContain("Add a record");
  });
});
