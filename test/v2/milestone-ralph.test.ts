import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restoreCheckpoint, sealCheckpoint } from "../../src/v2/milestone-ralph/checkpoint.js";
import { snapshotL0 } from "../../src/v2/milestone-ralph/l0.js";
import { isProductTestFile, observeWorkspace } from "../../src/v2/milestone-ralph/observe.js";
import { chooseNextSlice, formatWorkerPrompt } from "../../src/v2/milestone-ralph/orchestrator.js";
import {
  isSealedGreenCheckpoint,
  ralphProcessExit,
  runMilestoneRalph,
  sliceBudgetMs,
} from "../../src/v2/milestone-ralph/run.js";
import { initialMilestoneState } from "../../src/v2/milestone-ralph/state.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function tempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

describe("isProductTestFile", () => {
  it("counts src journey tests and ignores setup", () => {
    expect(isProductTestFile("src/library.test.tsx")).toBe(true);
    expect(isProductTestFile("src/test/setup.ts")).toBe(false);
    expect(isProductTestFile("src/App.tsx")).toBe(false);
  });
});

describe("observeWorkspace", () => {
  it("finds product tests and report status", async () => {
    const app = await tempDir("ralph-observe-");
    await mkdir(path.join(app, "src", "test"), { recursive: true });
    await writeFile(path.join(app, "src", "App.tsx"), "export function App() { return null; }\n", "utf8");
    await writeFile(path.join(app, "src", "library.test.tsx"), "it('works', () => {});\n", "utf8");
    await writeFile(path.join(app, "src", "test", "setup.ts"), "export {};\n", "utf8");
    await writeFile(
      path.join(app, "report.partial.json"),
      `${JSON.stringify({
        status: "partial",
        summary: "wip",
        implemented_features: ["list"],
        tests_run: [{ command: "verify", journey: "list", result: "passed" }],
      })}\n`,
      "utf8",
    );

    const observation = await observeWorkspace(app);
    expect(observation.productTestFiles).toEqual(["src/library.test.tsx"]);
    expect(observation.reportStatus).toBe("partial");
    expect(observation.implementedFeatures).toEqual(["list"]);
  });
});

describe("chooseNextSlice", () => {
  const emptyObservation = {
    sourceFiles: ["src/App.tsx"],
    productTestFiles: [] as string[],
    hasReportPartial: false,
    reportStatus: null,
    implementedFeatures: [] as string[],
  };

  it("starts with one core slice instead of a waterfall plan", () => {
    const next = chooseNextSlice(initialMilestoneState(), emptyObservation, 8);
    expect(next.action).toBe("implement_core");
    expect(next.instruction).not.toMatch(/Dashboard|Campaigns|Deployment/i);
  });

  it("repairs from the L0 report after a failed slice", () => {
    const state = initialMilestoneState();
    state.last_l0 = {
      passed: false,
      tests_passed: false,
      build_passed: true,
      http_passed: true,
      summary: "L0 FAIL\n- vitest: failed",
    };
    const next = chooseNextSlice(state, { ...emptyObservation, productTestFiles: ["src/a.test.tsx"] }, 8);
    expect(next.action).toBe("repair");
    expect(next.instruction).toContain("vitest: failed");
  });

  it("retries implement_core when L0 failed and there are still no product tests", () => {
    const state = initialMilestoneState();
    state.slice = 1;
    state.last_l0 = {
      passed: false,
      tests_passed: false,
      build_passed: false,
      http_passed: false,
      summary: "L0 FAIL\n- vitest: failed",
    };
    const next = chooseNextSlice(state, emptyObservation, 8);
    expect(next.action).toBe("implement_core");
  });

  it("stops when L0 passed and the agent reported success", () => {
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
    const next = chooseNextSlice(
      state,
      {
        ...emptyObservation,
        productTestFiles: ["src/a.test.tsx"],
        hasReportPartial: true,
        reportStatus: "success",
      },
      8,
    );
    expect(next.action).toBe("done");
  });

  it("allows one continue slice then stops after a second green L0", () => {
    const afterCore = initialMilestoneState();
    afterCore.slice = 1;
    afterCore.last_action = "implement_core";
    afterCore.last_l0 = {
      passed: true,
      tests_passed: true,
      build_passed: true,
      http_passed: true,
      summary: "L0 PASS",
    };
    const continueSlice = chooseNextSlice(
      afterCore,
      { ...emptyObservation, productTestFiles: ["src/a.test.tsx"], reportStatus: "partial" },
      8,
    );
    expect(continueSlice.action).toBe("continue_journeys");

    const afterContinue = { ...afterCore, last_action: "continue_journeys" as const, slice: 2 };
    expect(chooseNextSlice(afterContinue, { ...emptyObservation, productTestFiles: ["src/a.test.tsx"] }, 8).action).toBe(
      "done",
    );
  });

  it("puts the slice instruction in a fresh-session worker prompt", () => {
    const state = initialMilestoneState();
    const prompt = formatWorkerPrompt("Track books.", chooseNextSlice(state, emptyObservation, 8), state);
    expect(prompt).toContain("## Product idea");
    expect(prompt).toContain("Track books.");
    expect(prompt).toContain("This session is fresh");
    expect(prompt).toContain("Use src/App.tsx, not output/app");
    expect(prompt).not.toContain("slice_done");
  });
});

describe("checkpoint seal/restore", () => {
  it("restores source without touching node_modules", async () => {
    const root = await tempDir("ralph-ckpt-");
    const app = path.join(root, "app");
    const checkpoint = path.join(root, "green");
    await mkdir(path.join(app, "src"), { recursive: true });
    await mkdir(path.join(app, "node_modules", "pkg"), { recursive: true });
    await writeFile(path.join(app, "src", "App.tsx"), "green\n", "utf8");
    await writeFile(path.join(app, "node_modules", "pkg", "index.js"), "keep\n", "utf8");
    await sealCheckpoint(app, checkpoint);

    await writeFile(path.join(app, "src", "App.tsx"), "broken\n", "utf8");
    await writeFile(path.join(app, "src", "Extra.tsx"), "junk\n", "utf8");
    await restoreCheckpoint(checkpoint, app);

    expect(await readFile(path.join(app, "src", "App.tsx"), "utf8")).toBe("green\n");
    await expect(readFile(path.join(app, "src", "Extra.tsx"), "utf8")).rejects.toThrow();
    expect(await readFile(path.join(app, "node_modules", "pkg", "index.js"), "utf8")).toBe("keep\n");
  });
});

describe("snapshotL0", () => {
  it("summarizes harness checks without an LLM", () => {
    const snap = snapshotL0({
      passed: false,
      checks: [
        { command: "vitest run", journey: "tests", result: "failed" },
        { command: "npm run build", journey: "build", result: "passed" },
        { command: "npm run dev", journey: "http", result: "passed" },
      ],
    });
    expect(snap.passed).toBe(false);
    expect(snap.tests_passed).toBe(false);
    expect(snap.build_passed).toBe(true);
    expect(snap.summary).toContain("L0 FAIL");
  });

  it("treats deferred HTTP as outside the slice gate", () => {
    const snap = snapshotL0({
      passed: false,
      checks: [
        { command: "vitest run", journey: "tests", result: "passed" },
        { command: "npm run build", journey: "build", result: "passed" },
        { command: "npm run dev", journey: "HTTP startup probe was not run: deferred to official final verify", result: "failed" },
      ],
    });
    expect(snap.passed).toBe(true);
    expect(snap.tests_passed).toBe(true);
    expect(snap.build_passed).toBe(true);
    expect(snap.http_passed).toBe(false);
    expect(snap.summary).toContain("L0 PASS");
  });

  it("names missing product tests in the L0 summary", () => {
    const snap = snapshotL0({
      passed: false,
      checks: [
        {
          command: "vitest run --passWithNoTests=false",
          journey: "The generated app's Vitest report contained at least one completed test and no failed, skipped, or todo tests",
          result: "failed",
        },
      ],
    });
    expect(snap.summary).toContain("no product tests");
    expect(snap.summary).toContain("src/App.tsx");
  });
});

describe("sliceBudgetMs", () => {
  it("gives most of the remaining wall clock to implement_core and reserves a later slice", () => {
    expect(
      sliceBudgetMs({
        action: "implement_core",
        productTestCount: 0,
        remainingMs: 900_000,
        configuredMs: 180_000,
      }),
    ).toBe(840_000);
  });

  it("does not reserve when the remaining wall is already short", () => {
    expect(
      sliceBudgetMs({
        action: "implement_core",
        productTestCount: 0,
        remainingMs: 200_000,
        configuredMs: 180_000,
      }),
    ).toBe(200_000);
  });

  it("does not treat leftover wall as failure after a green L0", () => {
    expect(ralphProcessExit({ lastL0Passed: true, timedOut: true, lastExit: 124 })).toEqual({
      exitCode: 0,
      timedOut: false,
    });
    expect(ralphProcessExit({ lastL0Passed: false, timedOut: true, lastExit: 124 })).toEqual({
      exitCode: 124,
      timedOut: true,
    });
  });

  it("keeps the configured cap for repair and continue slices", () => {
    expect(
      sliceBudgetMs({
        action: "repair",
        productTestCount: 2,
        remainingMs: 900_000,
        configuredMs: 180_000,
      }),
    ).toBe(180_000);
    expect(
      sliceBudgetMs({
        action: "continue_journeys",
        productTestCount: 2,
        remainingMs: 90_000,
        configuredMs: 180_000,
      }),
    ).toBe(90_000);
  });
});

describe("runMilestoneRalph", () => {
  it("runs a fresh worker, L0-gates, and stops on green success", async () => {
    const root = await tempDir("ralph-run-");
    const app = path.join(root, "app");
    const artifacts = path.join(root, "artifacts");
    await mkdir(path.join(app, "src"), { recursive: true });
    await writeFile(path.join(app, "src", "App.tsx"), "seed\n", "utf8");

    let piCalls = 0;
    const result = await runMilestoneRalph({
      idea: "Track books.",
      systemPrompt: "sys",
      publicJourneys: "journeys",
      appContext: "agents",
      outputDirectory: app,
      artifactDirectory: artifacts,
      repositoryRoot: root,
      harnessOwnedVerify: true,
      overallTimeoutMs: 60_000,
      sliceTimeoutMs: 5_000,
      maxSlices: 4,
      buildPiArguments: (_idea, _s, _j, _a, _dir, options) => {
        expect(options?.userPrompt).toContain("Current slice");
        expect(options?.sessionDir).toContain(`${path.sep}sessions`);
        return ["pi"];
      },
      runPi: async (_args, _cwd, eventFile, _stderr, timeoutMs) => {
        expect(timeoutMs).toBeGreaterThan(50_000);
        piCalls += 1;
        await mkdir(path.dirname(eventFile), { recursive: true });
        await writeFile(eventFile, "", "utf8");
        await mkdir(path.join(app, "src"), { recursive: true });
        await writeFile(path.join(app, "src", "library.test.tsx"), "it('works', () => {});\n", "utf8");
        await writeFile(
          path.join(app, "report.partial.json"),
          `${JSON.stringify({
            status: "success",
            summary: "done",
            implemented_features: ["books"],
            tests_run: [{ command: "verify", journey: "list", result: "passed" }],
          })}\n`,
          "utf8",
        );
        return { exitCode: 0, timedOut: false };
      },
      verifyApp: async (_app, _artifacts, options) => {
        expect(options?.failFast).toBe(true);
        expect(options?.runHttp).toBe(false);
        return {
          passed: true,
          checks: [
            { command: "vitest run", journey: "tests", result: "passed" },
            { command: "npm run build", journey: "build", result: "passed" },
            { command: "npm run dev", journey: "http", result: "passed" },
          ],
        };
      },
    });

    expect(piCalls).toBe(1);
    expect(result.timedOut).toBe(false);
    expect(result.state.done).toBe(true);
    expect(result.state.last_green_checkpoint).toMatch(/checkpoints\/green-00/);
    const state = JSON.parse(await readFile(path.join(artifacts, "milestone-state.json"), "utf8")) as {
      last_action: string;
    };
    expect(state.last_action).toBe("done");
  });

  it("keeps failed work on disk instead of restoring the seed", async () => {
    const root = await tempDir("ralph-repair-");
    const app = path.join(root, "app");
    const artifacts = path.join(root, "artifacts");
    await mkdir(path.join(app, "src"), { recursive: true });
    await writeFile(path.join(app, "src", "App.tsx"), "seed\n", "utf8");

    let piCalls = 0;
    await runMilestoneRalph({
      idea: "Track books.",
      systemPrompt: "sys",
      publicJourneys: "journeys",
      appContext: "agents",
      outputDirectory: app,
      artifactDirectory: artifacts,
      repositoryRoot: root,
      harnessOwnedVerify: true,
      overallTimeoutMs: 60_000,
      sliceTimeoutMs: 5_000,
      maxSlices: 2,
      buildPiArguments: () => ["pi"],
      runPi: async (_args, _cwd, eventFile) => {
        piCalls += 1;
        await mkdir(path.dirname(eventFile), { recursive: true });
        await writeFile(eventFile, "", "utf8");
        if (piCalls === 2) {
          expect(await readFile(path.join(app, "src", "App.tsx"), "utf8")).toBe("broken-1\n");
        }
        await writeFile(path.join(app, "src", "App.tsx"), `broken-${piCalls}\n`, "utf8");
        return { exitCode: 0, timedOut: false };
      },
      verifyApp: async () => ({
        passed: false,
        checks: [
          { command: "vitest run", journey: "no tests", result: "failed" },
          { command: "npm run build", journey: "build", result: "failed" },
          { command: "npm run dev", journey: "http", result: "failed" },
        ],
      }),
    });

    expect(piCalls).toBe(2);
    expect(await readFile(path.join(app, "src", "App.tsx"), "utf8")).toBe("broken-2\n");
  });

  it("restores a sealed green checkpoint before a later repair", async () => {
    const root = await tempDir("ralph-green-restore-");
    const app = path.join(root, "app");
    const artifacts = path.join(root, "artifacts");
    await mkdir(path.join(app, "src"), { recursive: true });
    await writeFile(path.join(app, "src", "App.tsx"), "seed\n", "utf8");

    let piCalls = 0;
    let verifyCalls = 0;
    await runMilestoneRalph({
      idea: "Track books.",
      systemPrompt: "sys",
      publicJourneys: "journeys",
      appContext: "agents",
      outputDirectory: app,
      artifactDirectory: artifacts,
      repositoryRoot: root,
      harnessOwnedVerify: true,
      overallTimeoutMs: 60_000,
      sliceTimeoutMs: 5_000,
      maxSlices: 3,
      buildPiArguments: () => ["pi"],
      runPi: async (_args, _cwd, eventFile) => {
        piCalls += 1;
        await mkdir(path.dirname(eventFile), { recursive: true });
        await writeFile(eventFile, "", "utf8");
        if (piCalls === 1) {
          await writeFile(path.join(app, "src", "App.tsx"), "green\n", "utf8");
          await writeFile(path.join(app, "src", "library.test.tsx"), "it('works', () => {});\n", "utf8");
          await writeFile(
            path.join(app, "report.partial.json"),
            `${JSON.stringify({
              status: "partial",
              summary: "wip",
              implemented_features: ["list"],
              tests_run: [{ command: "verify", journey: "list", result: "passed" }],
            })}\n`,
            "utf8",
          );
        }
        if (piCalls === 2) {
          expect(await readFile(path.join(app, "src", "App.tsx"), "utf8")).toBe("green\n");
          await writeFile(path.join(app, "src", "App.tsx"), "broken\n", "utf8");
        }
        if (piCalls === 3) {
          expect(await readFile(path.join(app, "src", "App.tsx"), "utf8")).toBe("green\n");
        }
        return { exitCode: 0, timedOut: false };
      },
      verifyApp: async () => {
        verifyCalls += 1;
        const passed = verifyCalls === 1;
        return {
          passed,
          checks: [
            { command: "vitest run", journey: "tests", result: passed ? "passed" : "failed" },
            { command: "npm run build", journey: "build", result: passed ? "passed" : "failed" },
            { command: "npm run dev", journey: "http", result: passed ? "passed" : "failed" },
          ],
        };
      },
    });

    expect(piCalls).toBe(3);
    expect(isSealedGreenCheckpoint("checkpoints/green-00")).toBe(true);
    expect(isSealedGreenCheckpoint("checkpoints/seed")).toBe(false);
  });
});
