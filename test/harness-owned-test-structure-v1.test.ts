import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HARNESS_OWNED_TEST_FILE,
  HARNESS_OWNED_TEST_SHELL,
  authoredTestCountInSnapshot,
  createEmptyTestStructureExport,
  evaluatePostToolTestStructure,
  formatTestStructureRejectionFeedback,
  readQualifyingTestSnapshot,
  restoreQualifyingTestSnapshot,
  seedHarnessOwnedTestShell,
  testStructureV1EnabledFromEnvironment,
  writeTestStructureExport,
} from "../solution/extensions/test-structure-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("test-structure-core", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  });

  function initApp(): string {
    tempDir = mkdtempSync(path.join(tmpdir(), "test-structure-app-"));
    mkdirSync(path.join(tempDir, "src"), { recursive: true });
    return tempDir;
  }

  function writeTest(relativePath: string, content: string): void {
    const target = path.join(tempDir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }

  it("seeds exactly one App.test.tsx shell with 0 authored tests", () => {
    const appRoot = initApp();
    const snapshot = seedHarnessOwnedTestShell(appRoot);
    expect(Object.keys(snapshot)).toEqual([HARNESS_OWNED_TEST_FILE]);
    expect(authoredTestCountInSnapshot(snapshot)).toBe(0);
    expect(readFileSync(path.join(appRoot, HARNESS_OWNED_TEST_FILE), "utf8")).toBe(
      HARNESS_OWNED_TEST_SHELL,
    );
  });

  it("accepts +0 edits without changing authored count", () => {
    const appRoot = initApp();
    const accepted = seedHarnessOwnedTestShell(appRoot);
    writeTest(
      HARNESS_OWNED_TEST_FILE,
      `${HARNESS_OWNED_TEST_SHELL}\n// comment-only edit\n`,
    );
    const current = readQualifyingTestSnapshot(appRoot);
    const result = evaluatePostToolTestStructure({
      lastAcceptedSnapshot: accepted,
      currentSnapshot: current,
    });
    expect(result).toEqual({ accepted: true, authored_delta: 0 });
  });

  it("accepts +1 authored test growth", () => {
    const appRoot = initApp();
    const accepted = seedHarnessOwnedTestShell(appRoot);
    writeTest(
      HARNESS_OWNED_TEST_FILE,
      `${HARNESS_OWNED_TEST_SHELL}\nit('journey one', () => {});\n`,
    );
    const current = readQualifyingTestSnapshot(appRoot);
    const result = evaluatePostToolTestStructure({
      lastAcceptedSnapshot: accepted,
      currentSnapshot: current,
    });
    expect(result).toEqual({ accepted: true, authored_delta: 1 });
  });

  it("rejects +2 or greater authored growth in one action", () => {
    const appRoot = initApp();
    const accepted = seedHarnessOwnedTestShell(appRoot);
    writeTest(
      HARNESS_OWNED_TEST_FILE,
      `${HARNESS_OWNED_TEST_SHELL}\nit('a', () => {});\nit('b', () => {});\n`,
    );
    const current = readQualifyingTestSnapshot(appRoot);
    const result = evaluatePostToolTestStructure({
      lastAcceptedSnapshot: accepted,
      currentSnapshot: current,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.violation.reason).toBe("authored_increment_exceeded");
      expect(result.violation.accepted_count).toBe(0);
      expect(result.violation.observed_count).toBe(2);
    }
  });

  it("rejects authored count decreases", () => {
    const appRoot = initApp();
    writeTest(HARNESS_OWNED_TEST_FILE, "it('keep', () => {});\n");
    const accepted = readQualifyingTestSnapshot(appRoot);
    writeTest(HARNESS_OWNED_TEST_FILE, HARNESS_OWNED_TEST_SHELL);
    const current = readQualifyingTestSnapshot(appRoot);
    const result = evaluatePostToolTestStructure({
      lastAcceptedSnapshot: accepted,
      currentSnapshot: current,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.violation.reason).toBe("authored_count_decreased");
    }
  });

  it("rejects alternate qualifying test files (tool-agnostic / filesystem)", () => {
    const appRoot = initApp();
    const accepted = seedHarnessOwnedTestShell(appRoot);
    writeTest("src/Feature.test.ts", "it('sidecar', () => {});\n");
    const current = readQualifyingTestSnapshot(appRoot);
    const result = evaluatePostToolTestStructure({
      lastAcceptedSnapshot: accepted,
      currentSnapshot: current,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.violation.reason).toBe("extra_test_file");
    }
  });

  it("rollback restores only qualifying test files and removes extra test files", () => {
    const appRoot = initApp();
    const accepted = seedHarnessOwnedTestShell(appRoot);
    writeTest(
      HARNESS_OWNED_TEST_FILE,
      `${HARNESS_OWNED_TEST_SHELL}\nit('a', () => {});\nit('b', () => {});\n`,
    );
    writeTest("src/Feature.test.ts", "it('sidecar', () => {});\n");
    writeTest("src/App.tsx", "export const APP_MARKER = 'kept';\n");

    restoreQualifyingTestSnapshot(appRoot, accepted);

    expect(readFileSync(path.join(appRoot, HARNESS_OWNED_TEST_FILE), "utf8")).toBe(
      HARNESS_OWNED_TEST_SHELL,
    );
    expect(() => readFileSync(path.join(appRoot, "src/Feature.test.ts"), "utf8")).toThrow();
    expect(readFileSync(path.join(appRoot, "src/App.tsx"), "utf8")).toBe(
      "export const APP_MARKER = 'kept';\n",
    );
  });

  it("formats compact rejection feedback per prereg", () => {
    const feedback = formatTestStructureRejectionFeedback({
      reason: "authored_increment_exceeded",
      accepted_count: 1,
      observed_count: 3,
    });
    expect(feedback).toContain("test_structure_v1: rejected");
    expect(feedback).toContain("reason: authored_increment_exceeded");
    expect(feedback).toContain("accepted_authored_count: 1");
    expect(feedback).toContain("observed_authored_count: 3");
    expect(feedback).toContain("other changes kept");
  });

  it("reads HARNESS_OWNED_TEST_STRUCTURE_V1 from environment", () => {
    const previous = process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    expect(testStructureV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = "1";
    expect(testStructureV1EnabledFromEnvironment()).toBe(true);
    if (previous === undefined) delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    else process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = previous;
  });
});

describe("test-structure OFF parity", () => {
  const previousStructure = process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
  const previousEarly = process.env.HARNESS_EARLY_VERIFY_V1;
  const previousGuard = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
  const previousRepair = process.env.HARNESS_VERIFY_REPAIR_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previousStructure === undefined) delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    else process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = previousStructure;
    if (previousEarly === undefined) delete process.env.HARNESS_EARLY_VERIFY_V1;
    else process.env.HARNESS_EARLY_VERIFY_V1 = previousEarly;
    if (previousGuard === undefined) delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    else process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = previousGuard;
    if (previousRepair === undefined) delete process.env.HARNESS_VERIFY_REPAIR_V1;
    else process.env.HARNESS_VERIFY_REPAIR_V1 = previousRepair;
  });

  it("OFF: does not load test-structure extension (v2.2 parity)", () => {
    delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-test-structure-v1.ts"))).toBe(
      false,
    );
    expect(extensions.some((entry) => entry.endsWith("early-verify-v1.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-verify.ts"))).toBe(true);
  });

  it("OFF explicit 0 matches unset for extensions and runtime env", () => {
    delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    const offUnset = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = "0";
    const offExplicit = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(offExplicit.extensions).toEqual(offUnset.extensions);

    delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    const runtimeUnset = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = "0";
    const runtimeExplicit = resolveChallengeRuntimeEnv(
      DEFAULT_TEMPLATE_OVERLAY_CONFIG,
      DEFAULT_CONFIG,
    );
    expect(runtimeExplicit.HARNESS_OWNED_TEST_STRUCTURE_V1).toBeUndefined();
    expect(runtimeUnset.HARNESS_OWNED_TEST_STRUCTURE_V1).toBeUndefined();
  });

  it("ON: loads test-structure extension when env set", () => {
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-test-structure-v1.ts"))).toBe(
      true,
    );
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_OWNED_TEST_STRUCTURE_V1).toBe("1");
  });
});

describe("test-structure dry-run fixture", () => {
  let tempDir = "";
  let exportPath = "";

  function writeTestFile(relativePath: string, content: string): void {
    const target = path.join(tempDir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
    exportPath = "";
  });

  it("writes export sidecar with skeleton count and rejection telemetry", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "test-structure-export-"));
    exportPath = path.join(tempDir, "test-structure.v1.json");
    const payload = createEmptyTestStructureExport(0);
    payload.increment_guard_rejections = 2;
    payload.increment_guard_rejection_reasons = { authored_increment_exceeded: 2 };
    payload.max_accepted_single_step_delta = 1;
    payload.first_successful_authored_test_addition_tool_result_index = 3;
    payload.rejections.push({
      tool_result_index: 2,
      violation: "authored_increment_exceeded",
      accepted_count: 0,
      observed_count: 5,
      restored_paths: [HARNESS_OWNED_TEST_FILE],
    });
    writeTestStructureExport(exportPath, payload);

    const parsed = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(parsed.schema).toBe("agentcofounder.test_structure.v1");
    expect(parsed.skeleton_authored_count_at_start).toBe(0);
    expect(parsed.increment_guard_rejections).toBe(2);
    expect(parsed.first_successful_authored_test_addition_tool_result_index).toBe(3);
  });

  it("simulates incremental +1 accept path across three tool actions", () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), "test-structure-flow-"));
    tempDir = appRoot;
    let accepted = seedHarnessOwnedTestShell(appRoot);

    const stepOne = `${HARNESS_OWNED_TEST_SHELL}\nit('one', () => {});\n`;
    writeTestFile(HARNESS_OWNED_TEST_FILE, stepOne);
    let current = readQualifyingTestSnapshot(appRoot);
    let evaluation = evaluatePostToolTestStructure({ lastAcceptedSnapshot: accepted, currentSnapshot: current });
    expect(evaluation).toEqual({ accepted: true, authored_delta: 1 });
    accepted = current;

    const stepTwo = `${stepOne}it('two', () => {});\n`;
    writeTestFile(HARNESS_OWNED_TEST_FILE, stepTwo);
    current = readQualifyingTestSnapshot(appRoot);
    evaluation = evaluatePostToolTestStructure({ lastAcceptedSnapshot: accepted, currentSnapshot: current });
    expect(evaluation).toEqual({ accepted: true, authored_delta: 1 });
    accepted = current;

    writeTestFile(HARNESS_OWNED_TEST_FILE, `${stepTwo}it('three', () => {});\nit('four', () => {});\n`);
    current = readQualifyingTestSnapshot(appRoot);
    evaluation = evaluatePostToolTestStructure({ lastAcceptedSnapshot: accepted, currentSnapshot: current });
    expect(evaluation.accepted).toBe(false);
    if (!evaluation.accepted) {
      restoreQualifyingTestSnapshot(appRoot, accepted);
      expect(authoredTestCountInSnapshot(readQualifyingTestSnapshot(appRoot))).toBe(2);
    }
  });
});
