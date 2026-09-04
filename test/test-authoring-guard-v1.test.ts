import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateTestAuthoringGuardBlock,
  formatGuardBlockedMessage,
  GUARD_BLOCK_MAX_CHARS,
  GUARD_HINT_MAX_CHARS,
  testAuthoringGuardV1EnabledFromEnvironment,
} from "../solution/extensions/test-authoring-guard.js";
import {
  extractTestBlocks,
  scanTestSource,
  scanTestSources,
} from "../solution/extensions/test-authoring-scan.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

function scanContent(relativePath: string, content: string) {
  return scanTestSources([{ relativePath, content }]);
}

describe("test-authoring-scan", () => {
  it("extracts it() callback bodies with brace balancing", () => {
    const content = [
      "it('a', () => {",
      "  expect(screen.getByText('title')).toBeTruthy();",
      "});",
      "it('b', async () => {",
      "  expect(true).toBe(true);",
      "});",
    ].join("\n");
    const blocks = extractTestBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.lines.join("\n")).toContain("getByText('title')");
  });

  it("F1 flags bare risky getByText literals", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.getByText('title');\n});",
    );
    expect(result.blockingHit?.patternId).toBe("F1");
  });

  it("F1 does not flag getByText inside within()", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  within(row).getByText('title');\n});",
    );
    expect(result.blockingHit).toBeNull();
  });

  it("F2 flags bare regex getByText", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.getByText(/fiction/i);\n});",
    );
    expect(result.blockingHit?.patternId).toBe("F2");
  });

  it("F3 flags document text matchers", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  getByText(document.body);\n});",
    );
    expect(result.blockingHit?.patternId).toBe("F3");
  });

  it("F4 flags screen.debug sidecars", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.debug();\n});",
    );
    expect(result.blockingHit?.patternId).toBe("F4");
  });

  it("F5 flags bare interactive getByRole without name", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.getByRole('button');\n});",
    );
    expect(result.blockingHit?.patternId).toBe("F5");
  });

  it("F5 does not flag getByRole with accessible name", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.getByRole('button', { name: 'Lend out' });\n});",
    );
    expect(result.blockingHit).toBeNull();
  });

  it("F5 does not flag getByRole scoped on the same line", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  within(row).getByRole('button');\n});",
    );
    expect(result.blockingHit).toBeNull();
  });

  it("F6 is report-only and does not become blockingHit", () => {
    const result = scanContent(
      "src/App.test.tsx",
      "it('x', () => {\n  screen.getByText('Lend out book');\n});",
    );
    expect(result.blockingHit).toBeNull();
    expect(result.reportOnlyHits.some((hit) => hit.patternId === "F6")).toBe(true);
  });

  it("prefers lower-numbered blocking patterns when multiple hits exist", () => {
    const result = scanContent(
      "src/App.test.tsx",
      [
        "it('x', () => {",
        "  screen.getByText('title');",
        "  screen.getByRole('button');",
        "});",
      ].join("\n"),
    );
    expect(result.blockingHit?.patternId).toBe("F1");
  });

  it("scanTestSource returns line numbers within the file", () => {
    const violations = scanTestSource({
      relativePath: "src/App.test.tsx",
      content: "it('x', () => {\n  screen.getByText('save');\n});",
    });
    expect(violations[0]?.line).toBe(2);
    expect(violations[0]?.file).toBe("src/App.test.tsx");
  });
});

describe("test-authoring-guard formatting", () => {
  it("formats compact BLOCKED messages with rule id, file, line, and hint", () => {
    const message = formatGuardBlockedMessage({
      patternId: "F1",
      file: "src/App.test.tsx",
      line: 12,
      hint: "Use within(container) or getByRole / getByLabelText instead of bare short getByText",
      blocking: true,
    });
    expect(message).toContain("guard_result: BLOCKED");
    expect(message).toContain("guard_violation: F1");
    expect(message).toContain("file: src/App.test.tsx:12");
    expect(message).toContain("hint:");
    expect(message.length).toBeLessThanOrEqual(GUARD_BLOCK_MAX_CHARS);
  });

  it("truncates hints longer than the frozen cap", () => {
    const longHint = "x".repeat(GUARD_HINT_MAX_CHARS + 20);
    const message = formatGuardBlockedMessage({
      patternId: "F3",
      file: "src/App.test.tsx",
      line: 3,
      hint: longHint,
      blocking: true,
    });
    expect(message.length).toBeLessThanOrEqual(GUARD_BLOCK_MAX_CHARS);
    expect(message).toContain("…");
  });

  it("reads HARNESS_TEST_AUTHORING_GUARD_V1 from environment", () => {
    const previous = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    expect(testAuthoringGuardV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    expect(testAuthoringGuardV1EnabledFromEnvironment()).toBe(true);
    if (previous === undefined) delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    else process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = previous;
  });
});

describe("test-authoring-guard OFF vs ON", () => {
  const previousGuard = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
  let tempDir = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
    if (previousGuard === undefined) delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    else process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = previousGuard;
  });

  function writeGuardFixture(content: string): string {
    tempDir = mkdtempSync(path.join(tmpdir(), "guard-app-"));
    const srcDir = path.join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(path.join(srcDir, "App.test.tsx"), content, "utf8");
    return tempDir;
  }

  it("OFF: does not block verify when F1 pattern is present", () => {
    const appRoot = writeGuardFixture("it('x', () => {\n  screen.getByText('title');\n});");
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    expect(evaluateTestAuthoringGuardBlock(appRoot)).toBeUndefined();
  });

  it("ON: blocks verify with compact feedback when F1 pattern is present", () => {
    const appRoot = writeGuardFixture("it('x', () => {\n  screen.getByText('title');\n});");
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    const block = evaluateTestAuthoringGuardBlock(appRoot);
    expect(block?.block).toBe(true);
    expect(block?.reason).toContain("guard_result: BLOCKED");
    expect(block?.reason).toContain("guard_violation: F1");
    expect(block?.reason.length).toBeLessThanOrEqual(GUARD_BLOCK_MAX_CHARS);
  });

  it("ON: allows verify when only F6 report-only pattern is present", () => {
    const appRoot = writeGuardFixture("it('x', () => {\n  screen.getByText('Lend out book');\n});");
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    expect(evaluateTestAuthoringGuardBlock(appRoot)).toBeUndefined();
  });

  it("ON: allows verify when test sources are clean", () => {
    const appRoot = writeGuardFixture(
      "it('x', () => {\n  screen.getByRole('button', { name: 'Save' });\n});",
    );
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    expect(evaluateTestAuthoringGuardBlock(appRoot)).toBeUndefined();
  });
});

describe("challenge extension wiring", () => {
  const repoRoot = path.resolve(".");
  const previousGuard = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;

  afterEach(() => {
    if (previousGuard === undefined) delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    else process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = previousGuard;
  });

  it("omits test-authoring-guard-v1 extension when env is unset", () => {
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions).not.toContain(
      path.join(repoRoot, "solution", "extensions", "test-authoring-guard-v1.ts"),
    );
  });

  it("includes test-authoring-guard-v1 after harness-owned-verify when enabled", () => {
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    const verifyIndex = extensions.indexOf(
      path.join(repoRoot, "solution", "extensions", "harness-owned-verify.ts"),
    );
    const guardIndex = extensions.indexOf(
      path.join(repoRoot, "solution", "extensions", "test-authoring-guard-v1.ts"),
    );
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeGreaterThan(verifyIndex);
  });

  it("exports HARNESS_TEST_AUTHORING_GUARD_V1 in runtime env when enabled", () => {
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_TEST_AUTHORING_GUARD_V1).toBe("1");
    expect(runtimeEnv.HARNESS_VERIFY_REPAIR_V1).toBeUndefined();
  });
});
