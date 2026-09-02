import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateHarnessOwnedVerifyBashBlock,
  evaluateVerifyRepairV1BashBlock,
  isNonCanonicalVitestCommand,
  isPipedTestCommand,
  isTestCommand,
  VERIFY_REPAIR_V1_POLICY_PROMPT,
} from "../solution/extensions/verify-command-policy.js";
import {
  buildVerifyFailureDetails,
  classifyVerifyFailure,
  formatStructuredVerifyFailureSummary,
  formatVerifyToolOutput,
  verifyRepairV1EnabledFromEnvironment,
} from "../solution/extensions/verify-failure-format.js";
import { resolveChallengeExtensions } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import path from "node:path";

const SAMPLE_AMBIGUOUS_TEXT_FAIL = [
  " FAIL  src/App.test.tsx > journeys > adds a book",
  "TestingLibraryElementError: Found multiple elements with the text: Title",
  " ❯ src/App.test.tsx:42:11",
].join("\n");

const SAMPLE_SUITE_ERROR = [
  " FAIL  src/App.test.tsx [ src/App.test.tsx ]",
  "Error: Cannot find module '@/lib/missing'",
].join("\n");

describe("verify-failure-format", () => {
  const previousRepair = process.env.HARNESS_VERIFY_REPAIR_V1;

  afterEach(() => {
    if (previousRepair === undefined) delete process.env.HARNESS_VERIFY_REPAIR_V1;
    else process.env.HARNESS_VERIFY_REPAIR_V1 = previousRepair;
  });

  it("classifies ambiguous text failures", () => {
    expect(classifyVerifyFailure(SAMPLE_AMBIGUOUS_TEXT_FAIL)).toBe("ambiguous_text");
  });

  it("classifies suite errors", () => {
    expect(classifyVerifyFailure(SAMPLE_SUITE_ERROR)).toBe("suite_error");
  });

  it("formats structured FAIL summary with class, file, and hint", () => {
    const details = buildVerifyFailureDetails(SAMPLE_AMBIGUOUS_TEXT_FAIL);
    const summary = formatStructuredVerifyFailureSummary(details);
    expect(summary).toContain("failure_class: ambiguous_text");
    expect(summary).toContain("test_name: src/App.test.tsx > journeys > adds a book");
    expect(summary).toContain("file: src/App.test.tsx:42");
    expect(summary).toContain("hint: Scope with within(...)");
    expect(summary.endsWith("---")).toBe(true);
  });

  it("keeps PASS output unchanged when repair v1 is enabled", () => {
    process.env.HARNESS_VERIFY_REPAIR_V1 = "1";
    const text = formatVerifyToolOutput(0, "PASS 3/3", true);
    expect(text).toBe("verify exit_code=0 (PASS)\n\nPASS 3/3");
    expect(text).not.toContain("failure_class:");
  });

  it("prepends structured summary on FAIL when repair v1 is enabled", () => {
    const text = formatVerifyToolOutput(1, SAMPLE_AMBIGUOUS_TEXT_FAIL, true);
    expect(text.startsWith("failure_class: ambiguous_text")).toBe(true);
    expect(text).toContain("verify exit_code=1 (FAIL)");
    expect(text).toContain("Found multiple elements with the text: Title");
  });

  it("does not prepend structured summary on FAIL when repair v1 is disabled", () => {
    const text = formatVerifyToolOutput(1, SAMPLE_AMBIGUOUS_TEXT_FAIL, false);
    expect(text).toBe(
      ["verify exit_code=1 (FAIL)", "", SAMPLE_AMBIGUOUS_TEXT_FAIL].join("\n"),
    );
  });

  it("reads HARNESS_VERIFY_REPAIR_V1 from environment", () => {
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
    expect(verifyRepairV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_VERIFY_REPAIR_V1 = "1";
    expect(verifyRepairV1EnabledFromEnvironment()).toBe(true);
  });
});

describe("verify-command-policy", () => {
  it("detects test commands", () => {
    expect(isTestCommand("npm test")).toBe(true);
    expect(isTestCommand("npx vitest run src/App.test.tsx")).toBe(true);
    expect(isTestCommand("npm run build")).toBe(false);
  });

  it("detects piped test commands", () => {
    expect(isPipedTestCommand("npm test 2>&1 | tail -40")).toBe(true);
    expect(isPipedTestCommand("npm test")).toBe(false);
  });

  it("detects non-canonical vitest invocations", () => {
    expect(isNonCanonicalVitestCommand("npx vitest run src/App.test.tsx")).toBe(true);
    expect(isNonCanonicalVitestCommand("npx vitest run -t \"filters\"")).toBe(true);
    expect(isNonCanonicalVitestCommand("npm test")).toBe(false);
  });

  it("blocks piped npm test under harness-owned VERIFY", () => {
    const result = evaluateHarnessOwnedVerifyBashBlock("npm test 2>&1 | tail -40");
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Piped test commands are blocked");
  });

  it("blocks direct npm test under harness-owned VERIFY", () => {
    const result = evaluateHarnessOwnedVerifyBashBlock("npm test");
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Use the `verify` tool");
  });

  it("blocks partial vitest with repair-specific reason under verify-repair-v1", () => {
    const result = evaluateVerifyRepairV1BashBlock("npx vitest run src/App.test.tsx");
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Partial or file-scoped vitest bash is blocked");
  });

  it("blocks piped test bash with repair-specific reason under verify-repair-v1", () => {
    const result = evaluateVerifyRepairV1BashBlock("npm test 2>&1 | tail -40");
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("before first green");
  });

  it("includes repair-first-test policy text", () => {
    expect(VERIFY_REPAIR_V1_POLICY_PROMPT).toContain("test or query problem");
    expect(VERIFY_REPAIR_V1_POLICY_PROMPT).toContain("full suite");
  });
});

describe("challenge extension wiring", () => {
  const repoRoot = path.resolve(".");
  const previousRepair = process.env.HARNESS_VERIFY_REPAIR_V1;

  afterEach(() => {
    if (previousRepair === undefined) delete process.env.HARNESS_VERIFY_REPAIR_V1;
    else process.env.HARNESS_VERIFY_REPAIR_V1 = previousRepair;
  });

  it("omits verify-repair-v1 extension when HARNESS_VERIFY_REPAIR_V1 is unset", () => {
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions).not.toContain(
      path.join(repoRoot, "solution", "extensions", "verify-repair-v1.ts"),
    );
  });

  it("includes verify-repair-v1 extension after harness-owned-verify when enabled", () => {
    process.env.HARNESS_VERIFY_REPAIR_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    const verifyIndex = extensions.indexOf(
      path.join(repoRoot, "solution", "extensions", "harness-owned-verify.ts"),
    );
    const repairIndex = extensions.indexOf(
      path.join(repoRoot, "solution", "extensions", "verify-repair-v1.ts"),
    );
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(repairIndex).toBeGreaterThan(verifyIndex);
  });
});
