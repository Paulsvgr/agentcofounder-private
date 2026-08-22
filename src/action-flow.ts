import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CallLedgerEntry } from "./analyze-run.js";
import {
  isBuildCommand,
  isDevServerCommand,
  isFullSuiteTestCommand,
  isNpmTestCommand,
  isReportWrite,
  isTestFilePath,
} from "./analyze-run.js";

export type ActionStage =
  | "inspect"
  | "build_app"
  | "write_tests"
  | "diagnose"
  | "repair_loop"
  | "green_build"
  | "extra_verify"
  | "report_final";

export const ACTION_STAGE_ORDER: readonly ActionStage[] = [
  "inspect",
  "build_app",
  "write_tests",
  "diagnose",
  "repair_loop",
  "green_build",
  "extra_verify",
  "report_final",
] as const;

export interface ActionSegment {
  stage: ActionStage;
  call_count: number;
  call_indexes: number[];
  wall_seconds: number;
  raw_tokens: number;
  weighted_tokens: number;
  note: string | null;
}

export interface CallActionSignals {
  hasTest: boolean;
  hasBuild: boolean;
  hasDev: boolean;
  hasReport: boolean;
  writesTestFile: boolean;
  writesAppFile: boolean;
  testFailed: boolean;
  testPassed: boolean;
  isInspectOnly: boolean;
  isTerminalSummary: boolean;
  isProcessCheck: boolean;
}

export interface ActionFlowOverrides {
  call_stage?: Record<string, ActionStage>;
  notes?: Partial<Record<ActionStage, string>>;
}

export interface ActionFlowOverridesFile {
  schema: string;
  runs: Record<string, ActionFlowOverrides>;
}

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_PATH = path.join(REPOSITORY_ROOT, "artifacts", "action-flow-overrides.json");

function isWriteOrEdit(name: string): boolean {
  return name === "write" || name === "edit";
}

function isProcessCheckCommand(detail: string): boolean {
  return /\b(pgrep|pkill)\b/i.test(detail) || /\bcurl\b.*localhost/i.test(detail);
}

export function extractCallActionSignals(call: CallLedgerEntry): CallActionSignals {
  const details = call.tools.map((tool) => tool.detail);

  let writesTest = false;
  let writesApp = false;
  for (const tool of call.tools) {
    if (!isWriteOrEdit(tool.name)) continue;
    if (isTestFilePath(tool.detail)) writesTest = true;
    else if (/[/\\]src[/\\]/i.test(tool.detail) || /\.tsx?\b/i.test(tool.detail)) writesApp = true;
  }

  const hasTest = details.some(isNpmTestCommand);
  const hasBuild = details.some(isBuildCommand);
  const hasDev = details.some(isDevServerCommand);
  const hasReport = details.some(isReportWrite);
  const isProcessCheck = details.some(isProcessCheckCommand);

  const testFailed = call.tools.some(
    (tool) => tool.name === "bash" && isNpmTestCommand(tool.detail) && tool.is_error,
  );
  const testPassed = call.tools.some(
    (tool) =>
      tool.name === "bash" &&
      isFullSuiteTestCommand(tool.detail) &&
      tool.test_passed === true,
  );

  const isInspectOnly =
    call.tools.length > 0 &&
    call.tools.every(
      (tool) =>
        tool.name === "read" ||
        (tool.name === "bash" &&
          !isNpmTestCommand(tool.detail) &&
          !isBuildCommand(tool.detail) &&
          !isDevServerCommand(tool.detail) &&
          !isProcessCheckCommand(tool.detail)),
    );

  const isTerminalSummary = call.tools.length === 0 && call.stop_reason === "stop";

  return {
    hasTest,
    hasBuild,
    hasDev,
    hasReport,
    writesTestFile: writesTest,
    writesAppFile: writesApp,
    testFailed,
    testPassed,
    isInspectOnly,
    isTerminalSummary,
    isProcessCheck,
  };
}

interface Milestones {
  firstAppWrite: number | null;
  firstTestWrite: number | null;
  firstFailingTest: number | null;
  firstGreen: number | null;
  firstReport: number | null;
  firstBuildAfterGreen: number | null;
}

function findMilestones(
  calls: CallLedgerEntry[],
  signals: CallActionSignals[],
): Milestones {
  let firstAppWrite: number | null = null;
  let firstTestWrite: number | null = null;
  let firstFailingTest: number | null = null;
  let firstGreen: number | null = null;
  let firstReport: number | null = null;

  for (const call of calls) {
    const signal = signals[call.index - 1]!;
    if (signal.writesAppFile && firstAppWrite === null) firstAppWrite = call.index;
    if (signal.writesTestFile && firstTestWrite === null) firstTestWrite = call.index;
    if (signal.hasTest && signal.testFailed && firstFailingTest === null) {
      firstFailingTest = call.index;
    }
    if (signal.hasTest && signal.testPassed && firstGreen === null) firstGreen = call.index;
    if (signal.hasReport && firstReport === null) firstReport = call.index;
  }

  let firstBuildAfterGreen: number | null = null;
  if (firstGreen !== null) {
    for (const call of calls) {
      if (call.index <= firstGreen) continue;
      const signal = signals[call.index - 1]!;
      if (signal.hasBuild) {
        firstBuildAfterGreen = call.index;
        break;
      }
    }
  }

  return {
    firstAppWrite,
    firstTestWrite,
    firstFailingTest,
    firstGreen,
    firstReport,
    firstBuildAfterGreen,
  };
}

function assignCallStage(
  call: CallLedgerEntry,
  signal: CallActionSignals,
  milestones: Milestones,
): ActionStage {
  const {
    firstAppWrite,
    firstTestWrite,
    firstFailingTest,
    firstGreen,
    firstReport,
    firstBuildAfterGreen,
  } = milestones;
  const index = call.index;

  if (signal.hasReport || signal.isTerminalSummary) return "report_final";
  if (firstReport !== null && index >= firstReport) return "report_final";

  if (firstGreen !== null && index > firstGreen) {
    if (index === firstBuildAfterGreen && signal.hasBuild) return "green_build";
    if (signal.hasDev || signal.hasTest || signal.hasBuild || signal.isProcessCheck) {
      return "extra_verify";
    }
    if (call.tools.length === 0) return "report_final";
    return "extra_verify";
  }

  if (firstGreen !== null && index === firstGreen) return "green_build";

  if (firstFailingTest !== null && index >= firstFailingTest) {
    if (firstGreen === null || index < firstGreen) {
      if (index === firstFailingTest) return "diagnose";
      return "repair_loop";
    }
  }

  if (signal.writesTestFile && (firstFailingTest === null || index < firstFailingTest)) {
    return "write_tests";
  }

  if (
    firstTestWrite !== null &&
    index >= firstTestWrite &&
    (firstFailingTest === null || index < firstFailingTest)
  ) {
    return "write_tests";
  }

  if (signal.writesAppFile || (firstAppWrite !== null && index >= firstAppWrite)) {
    return "build_app";
  }

  if (signal.isInspectOnly || firstAppWrite === null) return "inspect";

  return "build_app";
}

function rollupSegments(
  calls: CallLedgerEntry[],
  stages: Map<number, ActionStage>,
  stageNotes: Partial<Record<ActionStage, string>>,
): ActionSegment[] {
  const buckets = new Map<ActionStage, ActionSegment>();

  for (const call of calls) {
    const stage = stages.get(call.index) ?? "inspect";
    const bucket =
      buckets.get(stage) ??
      ({
        stage,
        call_count: 0,
        call_indexes: [],
        wall_seconds: 0,
        raw_tokens: 0,
        weighted_tokens: 0,
        note: stageNotes[stage] ?? null,
      } satisfies ActionSegment);

    bucket.call_count += 1;
    bucket.call_indexes.push(call.index);
    bucket.wall_seconds += call.gap_seconds;
    bucket.raw_tokens += call.input_tokens + call.output_tokens + call.cache_read_tokens;
    bucket.weighted_tokens += call.weighted_cost;
    buckets.set(stage, bucket);
  }

  return ACTION_STAGE_ORDER.filter((stage) => buckets.has(stage)).map(
    (stage) => buckets.get(stage)!,
  );
}

export async function loadActionFlowOverrides(runId: string): Promise<ActionFlowOverrides | null> {
  try {
    const raw = await readFile(OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw) as ActionFlowOverridesFile;
    return parsed.runs[runId] ?? null;
  } catch {
    return null;
  }
}

export function deriveActionFlow(
  calls: CallLedgerEntry[],
  overrides: ActionFlowOverrides | null = null,
): { segments: ActionSegment[]; source: "derived" | "derived+override"; callStages: Map<number, ActionStage> } {
  const signals = calls.map((call) => extractCallActionSignals(call));
  const milestones = findMilestones(calls, signals);

  const callStages = new Map<number, ActionStage>();
  for (const call of calls) {
    callStages.set(call.index, assignCallStage(call, signals[call.index - 1]!, milestones));
  }

  let source: "derived" | "derived+override" = "derived";
  const stageNotes: Partial<Record<ActionStage, string>> = { ...overrides?.notes };

  if (overrides?.call_stage) {
    for (const [indexText, stage] of Object.entries(overrides.call_stage)) {
      const index = Number(indexText);
      if (!Number.isFinite(index)) continue;
      callStages.set(index, stage);
      source = "derived+override";
    }
  }

  // Mega-call hint: app + tests in one turn still in build_app.
  for (const call of calls) {
    const signal = signals[call.index - 1]!;
    if (
      callStages.get(call.index) === "build_app" &&
      signal.writesAppFile &&
      signal.writesTestFile
    ) {
      stageNotes.build_app ??= "app and tests generated in the same call";
    }
  }

  return {
    segments: rollupSegments(calls, callStages, stageNotes),
    source,
    callStages,
  };
}
