import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult, TestRun } from "../types.js";
import { isNpmTestCommand } from "./classify.js";
import type { RunManifest } from "./manifest.js";
import type { CallLedgerEntry } from "./normalize.js";

export interface StationTestRow {
  command: string;
  journey: string;
  result: "passed" | "failed";
  detail: string | null;
}

export interface AgentToolErrorRow {
  call_index: number;
  tool_name: string;
  detail: string;
  seconds_since_start: number | null;
}

export type StationVerificationSource = "result.json" | "manifest.outcome" | "ledger_only";

export interface StationVerification {
  status: "success" | "partial" | "failed" | "unknown";
  pi_exit_code: number | null;
  summary: string | null;
  source: StationVerificationSource;
  tests_run: StationTestRow[];
  harness_checks: StationTestRow[];
  tests_passed: number;
  tests_failed: number;
  harness_passed: number;
  harness_failed: number;
  all_journeys_passed: boolean | null;
  all_harness_passed: boolean | null;
  error_tool_count: number;
  error_call_count: number;
  repair_call_count: number;
  first_error_call_index: number | null;
  first_error_seconds: number | null;
  npm_test_command_count: number;
  npm_test_error_count: number;
  time_to_first_failing_test_s: number | null;
  agent_tool_errors: AgentToolErrorRow[];
}

export async function readRunResultOptional(runDirectory: string): Promise<RunResult | null> {
  try {
    const raw = await readFile(path.join(runDirectory, "result.json"), "utf8");
    return JSON.parse(raw) as RunResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function normalizeTestRows(rows: TestRun[] | undefined): StationTestRow[] {
  if (!rows) return [];
  return rows.map((row) => ({
    command: row.command,
    journey: row.journey,
    result: row.result,
    detail: null,
  }));
}

function deriveAgentToolErrors(calls: CallLedgerEntry[]): AgentToolErrorRow[] {
  const errors: AgentToolErrorRow[] = [];
  for (const call of calls) {
    for (const tool of call.tools) {
      if (!tool.is_error) continue;
      errors.push({
        call_index: call.index,
        tool_name: tool.name,
        detail: tool.detail,
        seconds_since_start: call.seconds_since_start,
      });
    }
  }
  return errors;
}

interface VitestAssertionFailure {
  title: string;
  fullName: string;
  message: string;
}

function tokenizeJourney(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 3);
}

function truncateDetail(text: string, maxLength = 480): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

async function readLogTail(runDirectory: string, fileName: string, maxLines = 12): Promise<string | null> {
  try {
    const raw = await readFile(path.join(runDirectory, fileName), "utf8");
    const lines = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;
    return truncateDetail(lines.slice(-maxLines).join("\n"), 480);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readVitestFailures(runDirectory: string): Promise<VitestAssertionFailure[]> {
  try {
    const raw = await readFile(path.join(runDirectory, "app-test-results.json"), "utf8");
    const report = JSON.parse(raw) as {
      testResults?: Array<{
        assertionResults?: Array<{
          title?: string;
          fullName?: string;
          status?: string;
          failureMessages?: string[];
        }>;
      }>;
    };
    const failures: VitestAssertionFailure[] = [];
    for (const suite of report.testResults ?? []) {
      for (const assertion of suite.assertionResults ?? []) {
        if (assertion.status !== "failed") continue;
        const message = assertion.failureMessages?.find((entry) => entry.trim().length > 0)?.trim();
        if (!message) continue;
        failures.push({
          title: assertion.title ?? "",
          fullName: assertion.fullName ?? assertion.title ?? "",
          message: truncateDetail(message, 480),
        });
      }
    }
    return failures;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function matchVitestFailure(journey: string, failures: VitestAssertionFailure[]): string | null {
  const journeyTokens = tokenizeJourney(journey);
  if (journeyTokens.length === 0) return null;

  let best: { score: number; message: string } | null = null;
  for (const failure of failures) {
    const haystack = `${failure.fullName} ${failure.title}`.toLowerCase();
    const score = journeyTokens.filter((token) => haystack.includes(token)).length;
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { score, message: failure.message };
    }
  }
  return best?.message ?? null;
}

function summarizeVitestFailures(failures: VitestAssertionFailure[]): string | null {
  if (failures.length === 0) return null;
  return truncateDetail(
    failures.map((failure) => `${failure.fullName}: ${failure.message}`).join("\n"),
    480,
  );
}

async function harnessFailureDetail(
  row: StationTestRow,
  runDirectory: string,
  vitestFailures: VitestAssertionFailure[],
  logTails: { test: string | null; build: string | null; dev: string | null },
): Promise<string | null> {
  const journey = row.journey.toLowerCase();
  if (journey.includes("pi did not complete")) {
    return truncateDetail(row.journey, 480);
  }
  if (journey.includes("vitest report")) {
    return summarizeVitestFailures(vitestFailures) ?? logTails.test;
  }
  if (journey.includes("production build")) {
    return logTails.build;
  }
  if (journey.includes("http server") || row.command.includes("dev")) {
    return logTails.dev;
  }
  if (journey.includes("internal error") || journey.includes("could not be verified")) {
    return truncateDetail(row.journey, 480);
  }
  return logTails.test ?? logTails.build ?? logTails.dev;
}

async function journeyFailureDetail(
  row: StationTestRow,
  vitestFailures: VitestAssertionFailure[],
  testLogTail: string | null,
): Promise<string | null> {
  return matchVitestFailure(row.journey, vitestFailures) ?? testLogTail;
}

export async function enrichVerificationDetails(
  runDirectory: string,
  verification: StationVerification,
): Promise<StationVerification> {
  const hasFailures =
    verification.tests_failed > 0 ||
    verification.harness_failed > 0 ||
    verification.tests_run.some((row) => row.result === "failed") ||
    verification.harness_checks.some((row) => row.result === "failed");
  if (!hasFailures) return verification;

  const vitestFailures = await readVitestFailures(runDirectory);
  const logTails = {
    test: await readLogTail(runDirectory, "app-test.log"),
    build: await readLogTail(runDirectory, "app-build.log"),
    dev: await readLogTail(runDirectory, "app-dev.log"),
  };

  const testsRun = await Promise.all(
    verification.tests_run.map(async (row) => {
      if (row.result !== "failed") return row;
      const detail = await journeyFailureDetail(row, vitestFailures, logTails.test);
      return { ...row, detail };
    }),
  );

  const harnessChecks = await Promise.all(
    verification.harness_checks.map(async (row) => {
      if (row.result !== "failed") return row;
      const detail = await harnessFailureDetail(row, runDirectory, vitestFailures, logTails);
      return { ...row, detail: detail ?? row.journey };
    }),
  );

  return {
    ...verification,
    tests_run: testsRun,
    harness_checks: harnessChecks,
  };
}

function countResults(rows: StationTestRow[]): { passed: number; failed: number } {
  return rows.reduce(
    (acc, row) => {
      if (row.result === "passed") acc.passed += 1;
      else acc.failed += 1;
      return acc;
    },
    { passed: 0, failed: 0 },
  );
}

function deriveLedgerSignals(calls: CallLedgerEntry[]): Pick<
  StationVerification,
  | "error_tool_count"
  | "error_call_count"
  | "repair_call_count"
  | "first_error_call_index"
  | "first_error_seconds"
  | "npm_test_command_count"
  | "npm_test_error_count"
  | "time_to_first_failing_test_s"
> {
  let errorToolCount = 0;
  let errorCallCount = 0;
  let repairCallCount = 0;
  let firstErrorCallIndex: number | null = null;
  let firstErrorSeconds: number | null = null;
  let npmTestCommandCount = 0;
  let npmTestErrorCount = 0;
  let timeToFirstFailingTestS: number | null = null;

  for (const call of calls) {
    const hasError = call.tools.some((tool) => tool.is_error);
    if (call.activity === "repair") repairCallCount += 1;
    if (hasError) {
      errorCallCount += 1;
      if (firstErrorCallIndex === null) {
        firstErrorCallIndex = call.index;
        firstErrorSeconds = call.seconds_since_start;
      }
    }

    for (const tool of call.tools) {
      if (tool.is_error) errorToolCount += 1;
      if (tool.name === "bash" && isNpmTestCommand(tool.detail)) {
        npmTestCommandCount += 1;
        if (tool.is_error) {
          npmTestErrorCount += 1;
          if (timeToFirstFailingTestS === null) {
            timeToFirstFailingTestS = call.seconds_since_start;
          }
        }
      }
    }
  }

  return {
    error_tool_count: errorToolCount,
    error_call_count: errorCallCount,
    repair_call_count: repairCallCount,
    first_error_call_index: firstErrorCallIndex,
    first_error_seconds: firstErrorSeconds,
    npm_test_command_count: npmTestCommandCount,
    npm_test_error_count: npmTestErrorCount,
    time_to_first_failing_test_s: timeToFirstFailingTestS,
  };
}

export function buildStationVerification(
  calls: CallLedgerEntry[],
  options: {
    runResult?: RunResult | null;
    manifest?: RunManifest | null;
  } = {},
): StationVerification {
  const ledgerSignals = deriveLedgerSignals(calls);
  const { runResult = null, manifest = null } = options;

  if (runResult) {
    const testsRun = normalizeTestRows(runResult.tests_run);
    const harnessChecks = normalizeTestRows(runResult.harness_checks);
    const testCounts = countResults(testsRun);
    const harnessCounts = countResults(harnessChecks);
    return {
      ...ledgerSignals,
      status: runResult.status,
      pi_exit_code: runResult.pi_exit_code,
      summary: runResult.summary ?? null,
      source: "result.json",
      tests_run: testsRun,
      harness_checks: harnessChecks,
      tests_passed: testCounts.passed,
      tests_failed: testCounts.failed,
      harness_passed: harnessCounts.passed,
      harness_failed: harnessCounts.failed,
      all_journeys_passed: testsRun.length > 0 ? testCounts.failed === 0 : null,
      all_harness_passed: harnessChecks.length > 0 ? harnessCounts.failed === 0 : null,
      agent_tool_errors: deriveAgentToolErrors(calls),
    };
  }

  if (manifest?.outcome) {
    return {
      ...ledgerSignals,
      status: manifest.outcome.status,
      pi_exit_code: manifest.outcome.pi_exit_code,
      summary: null,
      source: "manifest.outcome",
      tests_run: [],
      harness_checks: [],
      tests_passed: 0,
      tests_failed: 0,
      harness_passed: 0,
      harness_failed: 0,
      all_journeys_passed: null,
      all_harness_passed: null,
      agent_tool_errors: deriveAgentToolErrors(calls),
    };
  }

  return {
    ...ledgerSignals,
    status: "unknown",
    pi_exit_code: null,
    summary: null,
    source: "ledger_only",
    tests_run: [],
    harness_checks: [],
    tests_passed: 0,
    tests_failed: 0,
    harness_passed: 0,
    harness_failed: 0,
    all_journeys_passed: null,
    all_harness_passed: null,
    agent_tool_errors: deriveAgentToolErrors(calls),
  };
}
