import type { Reporter, TestModule, TestSuite } from "vitest/node";
import { readFileSync } from "node:fs";
import {
  compactFailureMessage,
  formatTestContextBlock,
  primaryMessageLineCount,
  resolveFailureSourcePath,
  stripAnsi,
  truncate,
  usedStructuredRtlEvidence,
  verifyTestContextEvidenceV1EnabledFromEnvironment,
} from "./compactFailureMessage.js";

const FAILURES_MARKER_PREFIX = "FAILURES ";
const PASS_MARKER_PREFIX = "PASS ";
const SUITE_ERROR_PREFIX = "SUITE_ERROR ";

type ModuleWithSuiteErrors = TestModule & {
  state(): string;
  errors(): Array<{ name?: string; message?: string; stack?: string }>;
};

function extractMatches(message: string): string[] {
  const cleaned = stripAnsi(message);
  const matches: string[] = [];
  const elementRe = /<[^>\n]{1,200}>/g;
  let match: RegExpExecArray | null;
  while ((match = elementRe.exec(cleaned)) !== null) {
    const snippet = match[0];
    if (/^<\/?(?:body|html|div)\b/i.test(snippet) && snippet.length > 80) continue;
    if (!matches.includes(snippet)) matches.push(snippet);
    if (matches.length >= 6) break;
  }
  return matches.map((snippet) => truncate(snippet, 240));
}

interface FailureRecord {
  moduleId: string;
  testName: string;
  errorName: string;
  location: string;
  message: string;
  expected: string | null;
  actual: string | null;
}

interface TestCounts {
  passed: number;
  failed: number;
  total: number;
}

function walkTests(
  testModule: TestModule,
  onTest: (state: string) => void,
): void {
  const walk = (suite: TestSuite | TestModule) => {
    for (const child of suite.children) {
      if (child.type === "test") {
        onTest(child.result().state);
      } else {
        walk(child);
      }
    }
  };
  walk(testModule);
}

function countTests(testModules: ReadonlyArray<TestModule>): TestCounts {
  let passed = 0;
  let failed = 0;
  for (const testModule of testModules) {
    walkTests(testModule, (state) => {
      if (state === "passed") passed += 1;
      else if (state === "failed") failed += 1;
    });
  }
  return { passed, failed, total: passed + failed };
}

function collectFailedCases(testModule: TestModule): FailureRecord[] {
  const failed: FailureRecord[] = [];
  const walk = (suite: TestSuite | TestModule) => {
    for (const child of suite.children) {
      if (child.type === "test") {
        const result = child.result();
        if (result.state !== "failed") continue;
        const err = result.errors[0];
        const message = err?.message ?? "Unknown failure";
        failed.push({
          moduleId: testModule.moduleId,
          testName: child.name,
          errorName: err?.name ?? "Error",
          location:
            err?.stack && typeof err.stack === "string"
              ? err.stack.split("\n").find((line) => line.includes(".test."))?.trim() ??
                testModule.moduleId
              : testModule.moduleId,
          message,
          expected: err && "expected" in err ? String(err.expected) : null,
          actual: err && "actual" in err ? String(err.actual) : null,
        });
      } else {
        walk(child);
      }
    }
  };
  walk(testModule);
  return failed;
}

function collectModuleFailures(testModules: ReadonlyArray<TestModule>): FailureRecord[] {
  const failed: FailureRecord[] = [];
  for (const testModule of testModules as ModuleWithSuiteErrors[]) {
    for (const err of testModule.errors()) {
      const message = err.message ?? "Suite failed to run.";
      failed.push({
        moduleId: testModule.moduleId,
        testName: "(suite)",
        errorName: err.name ?? "Error",
        location:
          err.stack && typeof err.stack === "string"
            ? err.stack.split("\n").find((line) => line.includes(".test."))?.trim() ??
              testModule.moduleId
            : testModule.moduleId,
        message,
        expected: null,
        actual: null,
      });
    }
    if (
      testModule.errors().length === 0 &&
      testModule.state() === "failed" &&
      countTests([testModule]).total === 0
    ) {
      failed.push({
        moduleId: testModule.moduleId,
        testName: "(suite)",
        errorName: "Error",
        location: testModule.moduleId,
        message: "Test suite failed before any tests ran.",
        expected: null,
        actual: null,
      });
    }
  }
  return failed;
}

function appendTestContext(failure: FailureRecord): string | null {
  if (!verifyTestContextEvidenceV1EnabledFromEnvironment()) return null;
  const parsed = resolveFailureSourcePath(failure.location, failure.moduleId);
  if (!parsed) return null;
  let source: string;
  try {
    source = readFileSync(parsed.filePath, "utf8");
  } catch {
    return null;
  }
  return formatTestContextBlock(source, parsed.line);
}

function formatFailure(index: number, total: number, failure: FailureRecord): string {
  const concise = compactFailureMessage(failure.message);
  const blocks = [
    `[${index}/${total}]`,
    `FAIL  ${failure.moduleId}`,
    `TEST  ${failure.testName}`,
    `TYPE  ${failure.errorName}`,
    `AT    ${failure.location}`,
    "MESSAGE",
    concise || truncate(stripAnsi(failure.message), 1200),
  ];
  // Structured RTL evidence already carries candidates; skip noisy tag-token MATCHES.
  if (!usedStructuredRtlEvidence(failure.message)) {
    const matches = extractMatches(failure.message);
    if (matches.length > 0) {
      blocks.push("MATCHES");
      matches.forEach((snippet, i) => blocks.push(`${i + 1}. ${snippet}`));
    }
  }
  if (failure.expected !== null) blocks.push(`EXPECTED\n${truncate(failure.expected, 400)}`);
  if (failure.actual !== null) blocks.push(`RECEIVED\n${truncate(failure.actual, 400)}`);
  const testContext = appendTestContext(failure);
  if (testContext) blocks.push(testContext);
  return blocks.join("\n");
}

export default class CompactFailureReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    const counts = countTests(testModules);
    const failures = [
      ...collectModuleFailures(testModules),
      ...testModules.flatMap((module) => collectFailedCases(module)),
    ];

    if (failures.length === 0 && counts.total > 0) {
      process.stdout.write(
        `\n✅ PASS ${counts.passed}/${counts.total} tests · 0 failed\n${PASS_MARKER_PREFIX}${counts.passed}/${counts.total}\n`,
      );
      return;
    }

    if (failures.length === 0 && counts.total === 0) {
      process.stdout.write(
        `\n❌ FAIL 0/0 tests · suite did not run\n${SUITE_ERROR_PREFIX}No tests completed\n${FAILURES_MARKER_PREFIX}0\n`,
      );
      return;
    }

    const sections = failures.map((failure, index) =>
      formatFailure(index + 1, failures.length, failure),
    );
    const header =
      counts.total === 0
        ? `\n❌ FAIL 0/0 tests · suite did not run\n${SUITE_ERROR_PREFIX}${primaryMessageLineCount(failures[0]?.message ?? "Suite error")}\n`
        : `\n❌ FAIL ${counts.passed}/${counts.total} tests · ${failures.length} failed\n`;
    process.stdout.write(
      `${header}${sections.join("\n\n")}\n\n${FAILURES_MARKER_PREFIX}${failures.length}\n`,
    );
  }
}

export {
  compactFailureMessage,
  formatRoleNameEvidence,
  formatMultipleElementsEvidence,
  formatTestContextBlock,
  hasParsedMultipleCandidates,
  primaryMessageLineCount,
  parseFailureFileLine,
  parseQueriedRoleName,
  parseQueriedMultiple,
  resolveFailureSourcePath,
  extractAccessibleNamesForRole,
  extractMatchingElementBlocks,
  verifyRtlEvidenceV1EnabledFromEnvironment,
  verifyRtlMultipleEvidenceV1EnabledFromEnvironment,
  verifyTestContextEvidenceV1EnabledFromEnvironment,
  usedRoleNameEvidence,
  usedMultipleElementsEvidence,
  usedStructuredRtlEvidence,
} from "./compactFailureMessage.js";
