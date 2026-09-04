import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppVerification,
  PartialRunResult,
  PortReclamationAudit,
  RunResult,
  TestRun,
  UsageSummary,
} from "./types.js";
import { competitionWeightedTokens, weightedEfficiencyScore } from "./v2/cost-model.js";

const FALLBACK_PARTIAL: PartialRunResult = {
  status: "failed",
  app_url: "http://localhost:3000",
  start_command: "npm run dev",
  summary: "The harness did not produce a valid report.partial.json file.",
  implemented_features: [],
  assumptions: [],
  tests_run: [],
  status_was_explicit: false,
};

/** Default when report.partial.json omits `summary` — not an intentional agent claim. */
const PLACEHOLDER_SUMMARY = "Pi completed without a valid summary.";

const APP_DIRECTORY_START_COMMAND = "npm run dev";

function quotePosixShellArgument(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function rootStartCommand(repositoryRoot: string, appDirectory: string): string {
  const relativeAppDirectory = path.relative(repositoryRoot, appDirectory).split(path.sep).join("/");
  return `npm --prefix ${quotePosixShellArgument(relativeAppDirectory)} run dev`;
}

function filteredStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeTestRun(value: unknown): TestRun | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.command === "string" &&
    typeof candidate.journey === "string" &&
    ["passed", "failed"].includes(String(candidate.result))
  ) {
    return {
      command: candidate.command,
      journey: candidate.journey,
      result: candidate.result as TestRun["result"],
    };
  }
  if (
    typeof candidate.name === "string" &&
    ["passed", "failed"].includes(String(candidate.status ?? candidate.result))
  ) {
    const result = String(candidate.status ?? candidate.result) as TestRun["result"];
    return {
      command: "verify",
      journey: candidate.name,
      result,
    };
  }
  return undefined;
}

export function normalizePartialResult(value: unknown): PartialRunResult | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result = value as Record<string, unknown>;
  const statusWasExplicit = ["success", "partial", "failed"].includes(String(result.status));
  const status = statusWasExplicit
    ? (result.status as PartialRunResult["status"])
    : "partial";
  const testsRun = Array.isArray(result.tests_run)
    ? result.tests_run.map(normalizeTestRun).filter((test): test is TestRun => test !== undefined)
    : [];

  return {
    status,
    app_url: "http://localhost:3000",
    start_command: "npm run dev",
    summary: typeof result.summary === "string" ? result.summary : PLACEHOLDER_SUMMARY,
    implemented_features: filteredStrings(result.implemented_features),
    assumptions: filteredStrings(result.assumptions),
    tests_run: testsRun,
    status_was_explicit: statusWasExplicit,
  };
}

export async function readPartialResult(appDirectory: string): Promise<PartialRunResult> {
  try {
    const raw = await readFile(path.join(appDirectory, "report.partial.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return normalizePartialResult(parsed) ?? FALLBACK_PARTIAL;
  } catch {
    return FALLBACK_PARTIAL;
  }
}

export function isMissingAgentReport(partial: PartialRunResult): boolean {
  return partial.status === "failed" && partial.tests_run.length === 0 && partial.summary === FALLBACK_PARTIAL.summary;
}

/**
 * Incomplete or absent agent report. Intentional `status: "partial"` (explicit field)
 * is NOT incomplete — even when verify is green.
 */
export function isIncompleteAgentReport(partial: PartialRunResult): boolean {
  if (isMissingAgentReport(partial)) return true;
  if (partial.status === "success") return false;
  if (partial.status === "failed" && partial.status_was_explicit) return false;
  // Explicit partial means the agent chose that outcome.
  if (partial.status === "partial" && partial.status_was_explicit) return false;
  // Missing/invalid status (defaulted to partial), or placeholder-only report.
  return (
    partial.status_was_explicit !== true ||
    partial.summary === PLACEHOLDER_SUMMARY ||
    partial.summary === FALLBACK_PARTIAL.summary
  );
}

function hasUsableAgentSummary(partial: PartialRunResult): boolean {
  return (
    partial.summary.length > 0 &&
    partial.summary !== PLACEHOLDER_SUMMARY &&
    partial.summary !== FALLBACK_PARTIAL.summary
  );
}

/**
 * When official verify is green, fill missing tests_run from Vitest and upgrade
 * missing/incomplete report.partial.json to success. Intentional status:"partial"
 * with a real summary is preserved.
 */
export function salvageAgentReport(
  partial: PartialRunResult,
  verification: AppVerification,
  harnessJourneys: TestRun[] = [],
): PartialRunResult {
  const tests = partial.tests_run.length > 0 ? partial.tests_run : harnessJourneys;
  if (!verification.passed || tests.length === 0) {
    return tests === partial.tests_run ? partial : { ...partial, tests_run: tests };
  }

  const allPassed = tests.every((test) => test.result === "passed");
  if (!allPassed) {
    return tests === partial.tests_run ? partial : { ...partial, tests_run: tests };
  }

  const shouldUpgrade =
    isIncompleteAgentReport(partial) ||
    isMissingAgentReport(partial) ||
    partial.status === "failed";
  if (!shouldUpgrade) {
    return tests === partial.tests_run ? partial : { ...partial, tests_run: tests };
  }

  return {
    ...partial,
    status: "success",
    summary: hasUsableAgentSummary(partial)
      ? partial.summary
      : "Generated application passed harness verification.",
    implemented_features:
      partial.implemented_features.length > 0 ? partial.implemented_features : tests.map((test) => test.journey),
    tests_run: tests,
  };
}

export function composeResult(
  partial: PartialRunResult,
  usage: UsageSummary,
  piExitCode: number,
  verification: AppVerification,
  portReclamation: PortReclamationAudit,
  startCommand: string,
  harnessJourneys: TestRun[] = [],
): RunResult {
  const report = salvageAgentReport(partial, verification, harnessJourneys);
  const timeoutAfterGreenVerify = piExitCode === 124 && verification.passed;
  const runFailed =
    usage.model_calls === 0 ||
    (piExitCode !== 0 && !timeoutAfterGreenVerify) ||
    (report.status === "failed" && !verification.passed);
  const productJourneysPassed =
    report.tests_run.length > 0 && report.tests_run.every((test) => test.result === "passed");
  const status = runFailed
    ? "failed"
    : verification.passed && productJourneysPassed
      ? report.status === "failed"
        ? "success"
        : report.status
      : "partial";
  const journeysPassed = report.tests_run.filter((t) => t.result === "passed").length;
  const competitionWeighted = competitionWeightedTokens(usage);
  const { status_was_explicit: _statusWasExplicit, ...reportFields } = report;
  return {
    ...reportFields,
    status,
    app_url: "http://localhost:3000",
    start_command: startCommand,
    tests_run: report.tests_run,
    harness_checks: verification.checks,
    ...usage,
    pi_exit_code: timeoutAfterGreenVerify && status !== "failed" ? 0 : piExitCode,
    telemetry_source: "pi-json-event-stream",
    port_reclamation: portReclamation,
    competition_weighted_tokens: competitionWeighted,
    weighted_efficiency_score: weightedEfficiencyScore({
      journeys_passed: journeysPassed,
      usage,
    }),
  };
}

export async function writeResult(
  appDirectory: string,
  result: RunResult,
  mirrorPaths: string[] = [],
): Promise<string[]> {
  const resultPath = path.join(appDirectory, "result.json");
  const writtenPaths: string[] = [];
  const destinations = [
    { path: resultPath, value: { ...result, start_command: APP_DIRECTORY_START_COMMAND } },
    ...mirrorPaths.map((destination) => ({ path: destination, value: result })),
  ];
  for (const destination of destinations) {
    try {
      await writeFile(destination.path, `${JSON.stringify(destination.value, null, 2)}\n`, "utf8");
      writtenPaths.push(destination.path);
    } catch (error) {
      console.warn(`Unable to write result destination ${destination.path}: ${String(error)}`);
    }
  }
  if (writtenPaths.length === 0) throw new Error("Unable to write result.json to any configured destination");
  return writtenPaths;
}

export function missingRequiredResultPaths(writtenPaths: string[], requiredPaths: string[]): string[] {
  const written = new Set(writtenPaths.map((destination) => path.resolve(destination)));
  return requiredPaths.filter((destination) => !written.has(path.resolve(destination)));
}
