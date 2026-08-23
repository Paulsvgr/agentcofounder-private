import type { Reporter, TestCase, TestModule, TestSuite } from "vitest/node";

const MARKER_PREFIX = "FAILURES ";
const MAX_MESSAGE_LINES = 12;
const MAX_MATCH_SNIPPET = 240;
const MAX_RAW_FALLBACK = 1200;

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9?]*[ -/]*[@-~]/g, "");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function primaryMessage(message: string): string {
  const cleaned = stripAnsi(message).replace(/\r/g, "");
  const withoutBody = cleaned.split(/(?:Here are the matching|<body>)/i)[0] ?? cleaned;
  const lines = withoutBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_MESSAGE_LINES);
  return lines.join("\n");
}

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
  return matches.map((snippet) => truncate(snippet, MAX_MATCH_SNIPPET));
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

function formatFailure(index: number, total: number, failure: FailureRecord): string {
  const concise = primaryMessage(failure.message);
  const matches = extractMatches(failure.message);
  const blocks = [
    `[${index}/${total}]`,
    `FAIL  ${failure.moduleId}`,
    `TEST  ${failure.testName}`,
    `TYPE  ${failure.errorName}`,
    `AT    ${failure.location}`,
    "MESSAGE",
    concise || truncate(stripAnsi(failure.message), MAX_RAW_FALLBACK),
  ];
  if (matches.length > 0) {
    blocks.push("MATCHES");
    matches.forEach((snippet, i) => blocks.push(`${i + 1}. ${snippet}`));
  }
  if (failure.expected !== null) blocks.push(`EXPECTED\n${truncate(failure.expected, 400)}`);
  if (failure.actual !== null) blocks.push(`RECEIVED\n${truncate(failure.actual, 400)}`);
  if (blocks.length <= 6) {
    blocks.push("RAW");
    blocks.push(truncate(stripAnsi(failure.message), MAX_RAW_FALLBACK));
  }
  return blocks.join("\n");
}

export default class CompactFailureReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    const failures = testModules.flatMap((module) => collectFailedCases(module));
    if (failures.length === 0) return;

    const sections = failures.map((failure, index) =>
      formatFailure(index + 1, failures.length, failure),
    );
    process.stdout.write(`\n${sections.join("\n\n")}\n\n${MARKER_PREFIX}${failures.length}\n`);
  }
}
