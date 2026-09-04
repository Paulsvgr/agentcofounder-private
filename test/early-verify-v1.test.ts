import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  countAuthoredTestsFromSources,
  countAuthoredTestsInApp,
  detectFilesystemTestMutation,
  earlyVerifyV1EnabledFromEnvironment,
  formatAutoEarlyVerifyOutput,
  hashFileContent,
  snapshotQualifyingTestFileHashes,
  writeEarlyVerifyExport,
  createEmptyEarlyVerifyExport,
} from "../solution/extensions/early-verify-core.js";
import {
  buildEarlyVerifyRunMetrics,
  findFirstPostMutationCanonicalVerify,
  inferFirstTestMutationCallFromLedger,
  mergeAutoEarlyVerifyIntoTrajectory,
} from "../src/v2/early-verify-metrics.js";
import { buildCallLedgerFromEvents } from "../src/v2/normalize.js";
import { buildTrajectoryMetrics } from "../src/v2/trajectory-metrics.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("early-verify-core", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  });

  function writeAppTest(relativePath: string, content: string): string {
    tempDir = mkdtempSync(path.join(tmpdir(), "early-verify-app-"));
    const target = path.join(tempDir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    return tempDir;
  }

  it("detects first filesystem mutation independent of tool type (bash heredoc)", () => {
    const appRoot = writeAppTest("src/App.test.tsx", "it('a', () => {});\n");
    const baseline = snapshotQualifyingTestFileHashes(appRoot);
    const mutated = detectFilesystemTestMutation({
      baseline,
      previous: baseline,
      current: {
        ...baseline,
        "src/Feature.test.ts": hashFileContent("test('b', () => {});\n"),
      },
      firstMutationAlreadyRecorded: false,
    });
    expect(mutated.isFirstMutation).toBe(true);
    expect(mutated.mutatedPaths).toEqual(["src/Feature.test.ts"]);
  });

  it("does not re-trigger first mutation after latch", () => {
    const baseline = {};
    const current = { "src/App.test.tsx": hashFileContent("it('a', () => {});\n") };
    const second = detectFilesystemTestMutation({
      baseline,
      previous: current,
      current: { "src/App.test.tsx": hashFileContent("it('a', () => {});\nit('b', () => {});\n") },
      firstMutationAlreadyRecorded: true,
    });
    expect(second.isFirstMutation).toBe(false);
  });

  it("counts authored tests from source blocks, not vitest totals", () => {
    const sourceCount = countAuthoredTestsFromSources([
      {
        relativePath: "src/App.test.tsx",
        content: [
          "it('one', () => { expect(true).toBe(true); });",
          "test('two', () => { expect(1).toBe(1); });",
        ].join("\n"),
      },
    ]);
    expect(sourceCount.authored_test_count).toBe(2);
    expect(sourceCount.authored_test_count).not.toBe(7);
  });

  it("formats auto early verify output with verify_source tag", () => {
    const formatted = formatAutoEarlyVerifyOutput(1, "❌ FAIL 1/2 tests · 1 failed");
    expect(formatted.startsWith("verify_source: auto_early_v1")).toBe(true);
    expect(formatted).toContain("verify exit_code=1 (FAIL)");
  });

  it("reads HARNESS_EARLY_VERIFY_V1 from environment", () => {
    const previous = process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    expect(earlyVerifyV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_EARLY_VERIFY_V1 = "1";
    expect(earlyVerifyV1EnabledFromEnvironment()).toBe(true);
    if (previous === undefined) delete process.env.HARNESS_EARLY_VERIFY_V1;
    else process.env.HARNESS_EARLY_VERIFY_V1 = previous;
  });
});

describe("early-verify OFF parity", () => {
  const previousEarly = process.env.HARNESS_EARLY_VERIFY_V1;
  const previousGuard = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previousEarly === undefined) delete process.env.HARNESS_EARLY_VERIFY_V1;
    else process.env.HARNESS_EARLY_VERIFY_V1 = previousEarly;
    if (previousGuard === undefined) delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    else process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = previousGuard;
  });

  it("OFF: does not load early-verify extension (v2.2 parity)", () => {
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("early-verify-v1.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-verify.ts"))).toBe(true);
  });

  it("ON: loads early-verify extension when env set", () => {
    process.env.HARNESS_EARLY_VERIFY_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("early-verify-v1.ts"))).toBe(true);
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_EARLY_VERIFY_V1).toBe("1");
  });
});

describe("early-verify metrics anchoring", () => {
  function ledgerFromEvents(runId: string, lines: object[]) {
    return buildCallLedgerFromEvents(
      lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
      runId,
      `/tmp/${runId}/events.jsonl`,
    );
  }

  let turnSeq = 0;

  function assistantEnd(): object {
    turnSeq += 1;
    return {
      type: "message_end",
      message: {
        role: "assistant",
        timestamp: turnSeq * 1000,
        stopReason: "toolUse",
        usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150 },
      },
    };
  }

  function verifyTurn(output: string): object[] {
    const id = `verify-${turnSeq + 1}`;
    return [
      { type: "turn_start" },
      { type: "tool_execution_start", toolCallId: id, toolName: "verify", args: {} },
      {
        type: "tool_execution_end",
        toolCallId: id,
        toolName: "verify",
        isError: false,
        result: { content: [{ type: "text", text: output }] },
      },
      assistantEnd(),
    ];
  }

  function writeTurn(relativePath: string): object[] {
    const id = `write-${turnSeq + 1}`;
    return [
      { type: "turn_start" },
      {
        type: "tool_execution_start",
        toolCallId: id,
        toolName: "write",
        args: { path: relativePath, content: "it('a', () => {});\n" },
      },
      {
        type: "tool_execution_end",
        toolCallId: id,
        toolName: "write",
        isError: false,
        result: { content: [{ type: "text", text: "ok" }] },
      },
      assistantEnd(),
    ];
  }

  function primeTurn(): object[] {
    return [{ type: "turn_start" }, assistantEnd()];
  }

  it("anchors to first post-mutation VERIFY, not pre-mutation VERIFY", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("anchor-test", [
      ...primeTurn(),
      ...verifyTurn("verify exit_code=1 (FAIL)\n\n❌ FAIL 0/7 tests"),
      ...writeTurn("src/App.test.tsx"),
      ...verifyTurn("verify exit_code=1 (FAIL)\n\n❌ FAIL 1/2 tests"),
    ]);
    const trajectory = buildTrajectoryMetrics(ledger);
    const mutation = inferFirstTestMutationCallFromLedger(ledger);
    expect(mutation.call_index).toBe(2);

    const firstAny = trajectory.verification_runs.find((run) => run.canonical);
    expect(firstAny?.call_index).toBe(1);

    const firstPost = findFirstPostMutationCanonicalVerify(trajectory, mutation.call_index);
    expect(firstPost?.call_index).toBe(3);
    expect(firstPost?.call_index).not.toBe(firstAny?.call_index);
  });

  it("merges exactly one auto early verify export into trajectory", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("auto-merge", [...primeTurn(), ...writeTurn("src/App.test.tsx")]);
    const base = buildTrajectoryMetrics(ledger);
    const exportData = createEmptyEarlyVerifyExport();
    exportData.auto_early_verify_fired = true;
    exportData.auto_early_verify = {
      verify_source: "auto_early_v1",
      tool_result_index: 1,
      mutated_paths: ["src/App.test.tsx"],
      authored_test_count_at_mutation: 1,
      test_loc_at_mutation: 2,
      exit_code: 1,
      output: formatAutoEarlyVerifyOutput(1, "❌ FAIL 0/1 tests · 1 failed"),
      error: null,
    };

    const mergedOnce = mergeAutoEarlyVerifyIntoTrajectory(base, exportData, ledger);
    const mergedTwice = mergeAutoEarlyVerifyIntoTrajectory(mergedOnce, exportData, ledger);
    const autoRuns = mergedTwice.verification_runs.filter((run) =>
      run.raw_summary?.includes("verify_source: auto_early_v1"),
    );
    expect(autoRuns).toHaveLength(1);
  });

  it("reports first test mutation call from ledger paths", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("metrics", [...primeTurn(), ...writeTurn("src/App.test.tsx")]);
    const trajectory = buildTrajectoryMetrics(ledger);
    const metrics = buildEarlyVerifyRunMetrics({
      ledger,
      trajectory,
      runDirectory: "/nonexistent",
      runEndJourneyTestCount: 7,
      runEndAuthoredTestCount: 2,
    });
    expect(metrics.run_end_journey_test_count).toBe(7);
    expect(metrics.run_end_authored_test_count).toBe(2);
    expect(metrics.first_test_mutation_call).toBe(1);
  });
});

describe("early-verify dry-run fixture", () => {
  let tempDir = "";
  let exportPath = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  });

  it("writes export fixture with source-derived authored count after simulated mutation", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "early-verify-export-"));
    exportPath = path.join(tempDir, "early-verify.v1.json");
    const appRoot = path.join(tempDir, "app");
    mkdirSync(path.join(appRoot, "src"), { recursive: true });
    writeFileSync(
      path.join(appRoot, "src/App.test.tsx"),
      "it('a', () => {});\nit('b', () => {});\n",
      "utf8",
    );

    const metrics = countAuthoredTestsInApp(appRoot);
    const payload = createEmptyEarlyVerifyExport();
    payload.auto_early_verify_fired = true;
    payload.first_test_mutation_tool_result_index = 1;
    payload.first_test_mutation_paths = ["src/App.test.tsx"];
    payload.auto_early_verify = {
      verify_source: "auto_early_v1",
      tool_result_index: 1,
      mutated_paths: ["src/App.test.tsx"],
      authored_test_count_at_mutation: metrics.authored_test_count,
      test_loc_at_mutation: metrics.test_loc,
      exit_code: 1,
      output: formatAutoEarlyVerifyOutput(1, "❌ FAIL 0/1 tests · 1 failed"),
      error: null,
    };
    writeEarlyVerifyExport(exportPath, payload);

    const parsed = JSON.parse(readFileSync(exportPath, "utf8")) as {
      auto_early_verify_fired: boolean;
      auto_early_verify: { authored_test_count_at_mutation: number } | null;
    };
    expect(parsed.auto_early_verify_fired).toBe(true);
    expect(parsed.auto_early_verify?.authored_test_count_at_mutation).toBe(2);
    expect(metrics.authored_test_count).not.toBe(
      payload.auto_early_verify?.output.match(/FAIL \d+\/(\d+)/)?.[1],
    );
  });
});
