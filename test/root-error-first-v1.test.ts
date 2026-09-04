import { afterEach, describe, expect, it } from "vitest";
import {
  applyRootErrorFirstFormatting,
  isRootRuntimeFailure,
  parseCompactFailureBlocks,
  processCanonicalVerifyForRootErrorFirst,
  rootErrorFirstV1EnabledFromEnvironment,
} from "../solution/extensions/root-error-first-core.js";
import { resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const MIXED_FAIL = [
  "❌ FAIL 1/8 tests · 7 failed",
  "[1/7]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  adds a book and shows it in the collection list",
  "TYPE  TestingLibraryElementError",
  "AT    at /tmp/app/src/App.test.tsx:31:31",
  "MESSAGE",
  'Unable to find role="list" and name "Books"',
  "MATCHES",
  "1. <body>",
  "",
  "[2/7]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  lends a book",
  "TYPE  ReferenceError",
  "AT    at /tmp/app/src/App.test.tsx:11:3",
  "MESSAGE",
  "vi is not defined",
  "",
  "[3/7]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  filters lent-out books",
  "TYPE  TestingLibraryElementError",
  "AT    at /tmp/app/src/App.test.tsx:86:26",
  "MESSAGE",
  'Unable to find an accessible element with the role "listitem"',
  "",
  "FAILURES 7",
].join("\n");

const RTL_ONLY_FAIL = [
  "❌ FAIL 0/2 tests · 2 failed",
  "[1/2]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  adds a book",
  "TYPE  TestingLibraryElementError",
  "AT    at /tmp/app/src/App.test.tsx:20:10",
  "MESSAGE",
  "Found multiple elements with the role \"button\" and name \"Lend out\"",
  "",
  "[2/2]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  filters",
  "TYPE  TestingLibraryElementError",
  "AT    at /tmp/app/src/App.test.tsx:40:10",
  "MESSAGE",
  "Unable to find an accessible element with the role \"button\" and name \"Edit\"",
  "",
  "FAILURES 2",
].join("\n");

const CSS_PERSISTENCE_IMPORT_FAIL = [
  "❌ FAIL 7/7 tests · 1 failed",
  "[1/1]",
  "FAIL  /home/codemaster/hackathon/agentcofounder/output/app/src/App.test.tsx",
  "TEST  (suite)",
  "TYPE  Error",
  "AT    /home/codemaster/hackathon/agentcofounder/output/app/src/App.test.tsx",
  "MESSAGE",
  'Failed to resolve import "./collectionStore" from "src/bookStore.ts". Does the file exist?',
  "",
  "FAILURES 1",
].join("\n");

const MIXED_IMPORT_THEN_RTL = [
  "❌ FAIL 0/2 tests · 2 failed",
  "[1/2]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  adds a book",
  "TYPE  TestingLibraryElementError",
  "AT    at /tmp/app/src/App.test.tsx:20:10",
  "MESSAGE",
  'Unable to find role="list" and name "Books"',
  "",
  "[2/2]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  (suite)",
  "TYPE  Error",
  "AT    /tmp/app/src/App.test.tsx",
  "MESSAGE",
  'Failed to resolve import "./collectionStore" from "src/bookStore.ts". Does the file exist?',
  "",
  "FAILURES 2",
].join("\n");

const TYPEERROR_IN_MESSAGE = [
  "❌ FAIL 0/1 tests · 1 failed",
  "[1/1]",
  "FAIL  /tmp/app/src/App.test.tsx",
  "TEST  adds a book",
  "TYPE  Error",
  "AT    at /tmp/app/src/lib/text.ts:4:5",
  "MESSAGE",
  "TypeError: normalizeText is not a function",
  "",
  "FAILURES 1",
].join("\n");

describe("root-error-first-core", () => {
  const previous = process.env.HARNESS_ROOT_ERROR_FIRST_V1;

  afterEach(() => {
    if (previous === undefined) delete process.env.HARNESS_ROOT_ERROR_FIRST_V1;
    else process.env.HARNESS_ROOT_ERROR_FIRST_V1 = previous;
  });

  it("reads HARNESS_ROOT_ERROR_FIRST_V1 from environment", () => {
    delete process.env.HARNESS_ROOT_ERROR_FIRST_V1;
    expect(rootErrorFirstV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
    expect(rootErrorFirstV1EnabledFromEnvironment()).toBe(true);
  });

  it("parses compact failure blocks", () => {
    const blocks = parseCompactFailureBlocks(MIXED_FAIL);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.type).toBe("TestingLibraryElementError");
    expect(blocks[1]?.type).toBe("ReferenceError");
    expect(blocks[1]?.message).toContain("vi is not defined");
  });

  it("classifies ReferenceError/TypeError as root and RTL as secondary", () => {
    const blocks = parseCompactFailureBlocks(MIXED_FAIL);
    expect(isRootRuntimeFailure(blocks[0]!)).toBe(false);
    expect(isRootRuntimeFailure(blocks[1]!)).toBe(true);
    expect(isRootRuntimeFailure(blocks[2]!)).toBe(false);
  });

  it("treats Error + TypeError message as root", () => {
    const blocks = parseCompactFailureBlocks(TYPEERROR_IN_MESSAGE);
    expect(isRootRuntimeFailure(blocks[0]!)).toBe(true);
  });

  it("treats css-persistence Vite import-resolution suite Error as root", () => {
    const blocks = parseCompactFailureBlocks(CSS_PERSISTENCE_IMPORT_FAIL);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.testName).toBe("(suite)");
    expect(isRootRuntimeFailure(blocks[0]!)).toBe(true);
    const result = applyRootErrorFirstFormatting(CSS_PERSISTENCE_IMPORT_FAIL);
    expect(result.changed).toBe(true);
    expect(result.rootCount).toBe(1);
    expect(result.secondaryCount).toBe(0);
    expect(result.text).toContain("ROOT / RUNTIME ERROR");
    expect(result.text).toContain('Failed to resolve import "./collectionStore"');
    expect(result.text).not.toContain("SECONDARY TEST FAILURES");
  });

  it("elevates Vite import-resolution above RTL symptoms", () => {
    const result = applyRootErrorFirstFormatting(MIXED_IMPORT_THEN_RTL);
    expect(result.changed).toBe(true);
    const importIdx = result.text.indexOf("Failed to resolve import");
    const rtlIdx = result.text.indexOf('Unable to find role="list"');
    expect(importIdx).toBeGreaterThan(result.text.indexOf("ROOT / RUNTIME ERROR"));
    expect(rtlIdx).toBeGreaterThan(result.text.indexOf("SECONDARY TEST FAILURES"));
    expect(importIdx).toBeLessThan(rtlIdx);
  });

  it("elevates root runtime errors above RTL symptoms", () => {
    const result = applyRootErrorFirstFormatting(MIXED_FAIL);
    expect(result.changed).toBe(true);
    expect(result.rootCount).toBe(1);
    expect(result.secondaryCount).toBe(2);
    expect(result.text).toContain("ROOT / RUNTIME ERROR");
    expect(result.text).toContain("SECONDARY TEST FAILURES");
    const rootIdx = result.text.indexOf("ROOT / RUNTIME ERROR");
    const secondaryIdx = result.text.indexOf("SECONDARY TEST FAILURES");
    const refIdx = result.text.indexOf("vi is not defined");
    const rtlIdx = result.text.indexOf('Unable to find role="list"');
    expect(rootIdx).toBeGreaterThanOrEqual(0);
    expect(secondaryIdx).toBeGreaterThan(rootIdx);
    expect(refIdx).toBeGreaterThan(rootIdx);
    expect(refIdx).toBeLessThan(secondaryIdx);
    expect(rtlIdx).toBeGreaterThan(secondaryIdx);
  });

  it("leaves RTL-only FAIL output unchanged", () => {
    const result = applyRootErrorFirstFormatting(RTL_ONLY_FAIL);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(RTL_ONLY_FAIL);
    expect(result.text).not.toContain("ROOT / RUNTIME ERROR");
  });

  it("processCanonicalVerifyForRootErrorFirst is a no-op when flag is off", () => {
    delete process.env.HARNESS_ROOT_ERROR_FIRST_V1;
    const input = `verify exit_code=1 (FAIL)\n\n${MIXED_FAIL}`;
    expect(processCanonicalVerifyForRootErrorFirst(input, 1)).toBe(input);
  });

  it("processCanonicalVerifyForRootErrorFirst rewrites FAIL when flag is on", () => {
    process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
    const input = `verify exit_code=1 (FAIL)\n\n${MIXED_FAIL}`;
    const out = processCanonicalVerifyForRootErrorFirst(input, 1);
    expect(out.startsWith("verify exit_code=1 (FAIL)")).toBe(true);
    expect(out).toContain("ROOT / RUNTIME ERROR");
    expect(out).toContain("vi is not defined");
  });

  it("does not rewrite PASS results", () => {
    process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
    const input = "verify exit_code=0 (PASS)\n\n✅ PASS 3/3 tests · 0 failed";
    expect(processCanonicalVerifyForRootErrorFirst(input, 0)).toBe(input);
  });

  it("wires HARNESS_ROOT_ERROR_FIRST_V1 into runtime env", () => {
    process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
    const env = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, {
      ...DEFAULT_CONFIG,
      harness_owned_verify: true,
    });
    expect(env.HARNESS_ROOT_ERROR_FIRST_V1).toBe("1");
  });
});
