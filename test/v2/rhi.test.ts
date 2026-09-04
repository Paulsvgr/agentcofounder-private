import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chooseNextSlice, formatWorkerPrompt } from "../../src/v2/milestone-ralph/orchestrator.js";
import { initialMilestoneState } from "../../src/v2/milestone-ralph/state.js";
import { baselineHarness } from "../../src/v2/rhi/baseline.js";
import { extractJson } from "../../src/v2/rhi/complete.js";
import { evaluateCondition } from "../../src/v2/rhi/conditions.js";
import { combineWinners, objectiveWinner } from "../../src/v2/rhi/evaluator.js";
import { improvementHasConverged, regressionGate } from "../../src/v2/rhi/gate.js";
import { runRhiLoop } from "../../src/v2/rhi/loop.js";
import { applyOptimizerChanges } from "../../src/v2/rhi/optimizer.js";
import { assertHarnessDocument, parseHarnessDocument } from "../../src/v2/rhi/schema.js";
import { inferTaskKind } from "../../src/v2/rhi/task-kind.js";
import { buildExecutionTrace, type ExecutionTrace } from "../../src/v2/rhi/trace.js";
import type { RunResult } from "../../src/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function tempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

const emptyObservation = {
  sourceFiles: ["src/App.tsx"],
  productTestFiles: [] as string[],
  hasReportPartial: false,
  reportStatus: null,
  implementedFeatures: [] as string[],
  hasDomainModule: false,
  hasStorageModule: false,
  hasComponentModules: false,
};

function usageEvent(): string {
  return `${JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      provider: "test",
      model: "dummy",
      usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15 },
    },
  })}\n`;
}

function failedResult(): RunResult {
  return {
    status: "failed",
    app_url: "http://localhost:3000",
    start_command: "npm run dev",
    summary: "no tests",
    implemented_features: [],
    assumptions: [],
    tests_run: [],
    harness_checks: [
      { command: "vitest run", journey: "tests", result: "failed" },
      { command: "npm run build", journey: "not run", result: "failed" },
      { command: "npm run dev", journey: "not run", result: "failed" },
    ],
    model_calls: 1,
    input_tokens: 10,
    output_tokens: 5,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 15,
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
      diagnostic: "",
    },
  };
}

function passedResult(): RunResult {
  const result = failedResult();
  result.status = "success";
  result.summary = "library tracker";
  result.implemented_features = ["list"];
  result.tests_run = [{ command: "npm test", journey: "add book", result: "passed" }];
  result.harness_checks = [
    { command: "vitest run", journey: "tests", result: "passed" },
    { command: "npm run build", journey: "build", result: "passed" },
    { command: "npm run dev", journey: "http", result: "passed" },
  ];
  result.total_tokens = 20;
  return result;
}

async function writeRun(directory: string, result: RunResult, tests: boolean): Promise<void> {
  await mkdir(path.join(directory, "src"), { recursive: true });
  await writeFile(path.join(directory, "events.jsonl"), usageEvent(), "utf8");
  await writeFile(path.join(directory, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(directory, "milestone-state.json"),
    `${JSON.stringify({
      schema: "agentcofounder.milestone_state.v1",
      slice: 1,
      sealed: [{ slice: 0, title: "Core product + tests", action: "implement_core", l0_passed: tests }],
      last_action: "implement_core",
      last_title: "Core product + tests",
      last_instruction: "go",
      last_l0: { passed: tests, tests_passed: tests, build_passed: tests, http_passed: tests, summary: tests ? "L0 PASS" : "L0 FAIL" },
      last_green_checkpoint: tests ? "checkpoints/green-00" : "checkpoints/seed",
      done: true,
    })}\n`,
    "utf8",
  );
  await writeFile(path.join(directory, "src", "App.tsx"), "export function App() { return null; }\n", "utf8");
  if (tests) {
    await writeFile(path.join(directory, "src", "library.test.tsx"), "it('works', () => {});\n", "utf8");
  }
}

describe("RHI harness document", () => {
  it("parses the production baseline", () => {
    const parsed = parseHarnessDocument(baselineHarness());
    expect(parsed.errors).toEqual([]);
    expect(parsed.document?.harness.agents.map((agent) => agent.id)).toEqual([
      "orchestrator",
      "implementer",
      "continuer",
      "repairer",
      "l0_verifier",
      "done",
    ]);
    expect(assertHarnessDocument(baselineHarness()).id).toBe("v0");
  });

  it("keeps v0 hops equivalent to the coded orchestrator", () => {
    const next = chooseNextSlice(initialMilestoneState(), emptyObservation, 8);
    expect(next.action).toBe("implement_core");
    expect(next.instruction).toContain("This is one slice");
    expect(next.instruction).toContain("src/domain/");
    expect(next.instruction).toContain("aria-invalid");
    expect(next.instruction).toMatch(/≤10|8–10|high-information/);
    expect(next.instruction).toContain("OUTPUT GOVERNANCE");
  });

  it("does not put contracts into the v0 worker prompt", () => {
    const prompt = formatWorkerPrompt("Track books.", chooseNextSlice(initialMilestoneState(), emptyObservation, 8), initialMilestoneState());
    expect(prompt).toContain("## Product idea");
    expect(prompt).not.toContain("## Input contract");
  });

  it("surfaces modular quality gaps on continue when tests exist but layout is flat", () => {
    const afterCore = {
      ...emptyObservation,
      productTestFiles: ["src/library.test.tsx"],
      hasDomainModule: false,
      hasStorageModule: false,
      hasComponentModules: false,
    };
    const state = initialMilestoneState();
    state.slice = 1;
    state.last_action = "implement_core";
    state.last_l0 = {
      passed: true,
      tests_passed: true,
      build_passed: true,
      http_passed: true,
      summary: "L0 PASS",
    };
    const slice = chooseNextSlice(state, afterCore, 8);
    expect(slice.action).toBe("continue_journeys");
    const prompt = formatWorkerPrompt("Track books.", slice, state, undefined, afterCore);
    expect(prompt).toContain("## Quality gaps to close this slice");
    expect(prompt).toContain("Missing src/domain/");
    expect(prompt).toContain("Missing src/storage/");
    expect(prompt).toContain("Missing src/components/");
    expect(prompt).toContain("aria-invalid");
  });

  it("uses explicit contracts once the harness is no longer v0", () => {
    const harness = baselineHarness("v1");
    const prompt = formatWorkerPrompt(
      "Track books.",
      chooseNextSlice(initialMilestoneState(), emptyObservation, 8, harness),
      initialMilestoneState(),
      harness,
    );
    expect(prompt).toContain("## Input contract");
    expect(prompt).toContain("## Output contract");
  });
});

describe("RHI conditions", () => {
  const ctx = {
    done: false,
    slice: 1,
    max_slices: 8,
    last_action: "continue_journeys",
    last_l0_exists: true,
    last_l0_passed: true,
    product_test_count: 2,
    report_status: "success" as const,
    has_report: true,
    last_agent: "continuer",
    task_kind: "coding",
  };

  it("evaluates hop predicates without eval()", () => {
    expect(evaluateCondition("done || slice >= max_slices", ctx)).toBe(false);
    expect(evaluateCondition('last_l0_passed == true && report_status == "success"', ctx)).toBe(true);
    expect(evaluateCondition("product_test_count == 0", { ...ctx, product_test_count: 0 })).toBe(true);
    expect(evaluateCondition("last_l0_passed == true", { ...ctx, last_l0_passed: null })).toBe(false);
  });
});

describe("RHI evaluator and gate", () => {
  const low = {
    tests_passed: false,
    build_success: false,
    http_success: false,
    journeys_passed: 0,
    journeys_failed: 0,
    required_files_present: false,
    status_score: 0,
    quality_score: 0,
    token_cost: 1000,
    agent_calls: 5,
    tool_calls: 20,
    quality_per_1k_tokens: 0,
    quality_per_agent_call: 0,
    quality_per_cost: 0,
  };
  const high = { ...low, tests_passed: true, quality_score: 40, token_cost: 1100 };

  it("prefers objective wins and rejects expensive empty wins", () => {
    expect(objectiveWinner(high, low)).toBe("current");
    expect(combineWinners("tie", "current", { ...high, token_cost: 3000, quality_score: 6 }, low)).toBe("tie");
    const accepted = regressionGate({
      iteration: 1,
      previous_harness: "v0",
      current_harness: "v1",
      winner: "current",
      improvements: ["tests"],
      regressions: [],
      missing_requirements: [],
      root_causes: [],
      harness_recommendations: [],
      objective: { previous: low, current: high, quality_delta: 40, cost_ratio: 1.1 },
      dimensions: {},
    });
    expect(accepted.accept).toBe(true);
    const rejected = regressionGate({
      iteration: 1,
      previous_harness: "v0",
      current_harness: "v1",
      winner: "previous",
      improvements: [],
      regressions: ["worse tests"],
      missing_requirements: [],
      root_causes: [],
      harness_recommendations: [],
      objective: { previous: high, current: low, quality_delta: -40, cost_ratio: 0.9 },
      dimensions: {},
    });
    expect(rejected.accept).toBe(false);
  });

  it("stops after consecutive non-wins", () => {
    const tie = {
      iteration: 1,
      previous_harness: "v0",
      current_harness: "v1",
      winner: "tie" as const,
      improvements: [],
      regressions: [],
      missing_requirements: [],
      root_causes: ["worker exited without a passing Vitest suite"],
      harness_recommendations: [],
      objective: { previous: low, current: low, quality_delta: 0, cost_ratio: 1 },
      dimensions: {},
    };
    expect(improvementHasConverged([tie, { ...tie, iteration: 2 }])).toBe(true);
  });
});

describe("RHI optimizer patches", () => {
  it("applies a small evidence-driven edit and refuses a giant rewrite", () => {
    const result = applyOptimizerChanges(baselineHarness(), "v1", [
      {
        path: "harness.agents[id=implementer].output_contract",
        value: ["source_changes", "product_tests", "findings", "constraints"],
        reason: "worker omitted tests",
      },
    ]);
    expect(result.changes).toHaveLength(1);
    expect(result.harness.id).toBe("v1");
    const implementer = result.harness.harness.agents.find((agent) => agent.id === "implementer");
    expect(implementer?.output_contract).toContain("constraints");
  });
});

describe("RHI loop", () => {
  it("runs one candidate per iteration, accepts a better output, and keeps production independent", async () => {
    const root = await tempDir("rhi-loop-");
    let runs = 0;
    const result = await runRhiLoop({
      task: "Track books I own.",
      ideaFile: path.join(root, "idea.txt"),
      historyRoot: path.join(root, "history"),
      maxIterations: 1,
      complete: async (system) => {
        if (system.includes("harness optimizer")) {
          return {
            change_summary: "require tests in the implementer output contract",
            changes: [
              {
                path: "harness.agents[id=implementer].instructions",
                value: `${baselineHarness().harness.agents[1]?.instructions}\nWrite the tests before exiting.`,
                reason: "trace shows zero Vitest tests",
              },
            ],
          };
        }
        return {
          winner: "current",
          improvements: ["requirement coverage", "testing"],
          regressions: [],
          missing_requirements: [],
          root_causes: ["implementer output contract omitted tests"],
          harness_recommendations: ["keep L0 fail-fast"],
        };
      },
      runner: async ({ harness }) => {
        runs += 1;
        const artifactDirectory = path.join(root, `artifacts-${runs}`);
        const outputDirectory = path.join(root, `app-${runs}`);
        await mkdir(artifactDirectory, { recursive: true });
        await mkdir(outputDirectory, { recursive: true });
        const better = harness.id !== "v0";
        await writeRun(artifactDirectory, better ? passedResult() : failedResult(), better);
        await writeRun(outputDirectory, better ? passedResult() : failedResult(), better);
        return { artifactDirectory, outputDirectory, wallMs: 50, timedOut: false };
      },
    });

    expect(runs).toBe(2);
    expect(result.optimized_harness.id).toBe("v1");
    expect(result.evaluations[0]?.winner).toBe("current");
    const saved = JSON.parse(await readFile(path.join(root, "history", "optimized_harness.json"), "utf8")) as {
      id: string;
    };
    expect(saved.id).toBe("v1");
    expect(await readFile(path.join(root, "history", "iteration_0", "harness.json"), "utf8")).toContain('"id": "v0"');
  });
});

describe("RHI helpers", () => {
  it("classifies tasks and extracts JSON", () => {
    expect(inferTaskKind("The tests crash with a stack trace")).toBe("debugging");
    expect(inferTaskKind("Build a library tracker app")).toBe("coding");
    expect(extractJson("notes\n{\"winner\":\"tie\"}\n")).toEqual({ winner: "tie" });
  });

  it("records agents, tools, and termination in a trace", async () => {
    const root = await tempDir("rhi-trace-");
    await writeRun(root, failedResult(), false);
    await writeFile(
      path.join(root, "events.jsonl"),
      `${usageEvent()}${JSON.stringify({ type: "tool_execution_end", toolName: "bash", isError: false })}\n`,
      "utf8",
    );
    const trace: ExecutionTrace = await buildExecutionTrace({
      task: "books",
      harness: baselineHarness(),
      artifactDirectory: root,
      executionTimeMs: 10,
    });
    expect(trace.agents_called[0]?.id).toBe("implementer");
    expect(trace.tools_used.some((tool) => tool.name === "bash")).toBe(true);
    expect(trace.termination_reason).toBe("l0_failed");
  });
});
