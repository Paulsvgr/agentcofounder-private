import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppVerification, UsageSummary } from "../../types.js";
import { collectUsageFromJsonLines } from "../../usage.js";
import { MILESTONE_L0_OPTIONS, verifyGeneratedApp, type VerificationOptions } from "../../verify-app.js";
import { restoreCheckpoint, sealCheckpoint } from "./checkpoint.js";
import { snapshotL0 } from "./l0.js";
import { observeWorkspace } from "./observe.js";
import { chooseNextSlice, formatWorkerPrompt } from "./orchestrator.js";
import { initialMilestoneState, type MilestoneAction, type MilestoneState } from "./state.js";
import type { HarnessDocument } from "../rhi/schema.js";

export interface CommandResult {
  exitCode: number;
  timedOut: boolean;
}

export const DEFAULT_SLICE_TIMEOUT_MS = 240_000;
/** 15-minute wall clock cannot fit 8×3-minute slices plus L0. */
export const DEFAULT_MAX_SLICES = 3;
/** Do not start a slice that cannot finish L0 before the overall deadline. */
export const MIN_SLICE_BUDGET_MS = 45_000;
/** Keep one continue/repair slice after the first implementer writes the app. */
export const RESERVE_AFTER_CORE_MS = 60_000;
export const RESERVE_AFTER_CORE_MIN_REMAINING_MS = 240_000;

export interface PiLaunchOptions {
  harnessOwnedVerify?: boolean;
  sessionDir?: string;
  userPrompt?: string;
}

export interface MilestoneRalphInput {
  idea: string;
  systemPrompt: string;
  publicJourneys: string;
  appContext: string;
  outputDirectory: string;
  artifactDirectory: string;
  repositoryRoot: string;
  harnessOwnedVerify: boolean;
  overallTimeoutMs: number;
  sliceTimeoutMs: number;
  maxSlices: number;
  harness?: HarnessDocument;
  runPi: (
    args: string[],
    cwd: string,
    eventFile: string,
    stderrFile: string,
    timeoutMs: number,
  ) => Promise<CommandResult>;
  buildPiArguments: (
    idea: string,
    systemPrompt: string,
    publicJourneys: string,
    appContext: string,
    artifactDirectory: string,
    options?: PiLaunchOptions,
  ) => string[];
  verifyApp?: (
    appDirectory: string,
    artifactDirectory: string,
    options?: VerificationOptions,
  ) => Promise<AppVerification>;
}

export interface MilestoneRalphResult {
  exitCode: number;
  timedOut: boolean;
  usage: UsageSummary;
  state: MilestoneState;
  combinedEventsPath: string;
  combinedStderrPath: string;
  lastVerification: AppVerification | null;
}

function emptyUsage(): UsageSummary {
  return {
    model_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 0,
    reasoning_tokens: 0,
    cost_total: 0,
    call_log: [],
  };
}

export function mergeUsageSummaries(summaries: UsageSummary[]): UsageSummary {
  const merged = emptyUsage();
  for (const summary of summaries) {
    merged.model_calls += summary.model_calls;
    merged.input_tokens += summary.input_tokens;
    merged.output_tokens += summary.output_tokens;
    merged.cache_read_tokens += summary.cache_read_tokens;
    merged.cache_write_tokens += summary.cache_write_tokens;
    merged.total_tokens += summary.total_tokens;
    merged.reasoning_tokens += summary.reasoning_tokens;
    merged.cost_total += summary.cost_total;
    for (const call of summary.call_log) {
      merged.call_log.push({ ...call, index: merged.call_log.length + 1 });
    }
  }
  return merged;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function concatTextFiles(sources: string[], destination: string): Promise<void> {
  const chunks: string[] = [];
  for (const source of sources) {
    try {
      chunks.push(await readFile(source, "utf8"));
    } catch {
      // A missing slice file is still recorded in the run folder layout.
    }
  }
  await writeFile(destination, chunks.join(""), "utf8");
}

export function remainingTimeoutMs(startedAt: number, overallTimeoutMs: number): number {
  return Math.max(0, overallTimeoutMs - (Date.now() - startedAt));
}

/**
 * First implementer slice (no product tests yet) uses most of the remaining wall
 * clock, reserving one later slice when there is enough time. Repair/continue
 * keep the configured cap. Splitting a 15-minute run into three 3-minute fresh
 * sessions only repeats seed reconnaissance and SIGTERM.
 */
export function sliceBudgetMs(input: {
  action: MilestoneAction;
  productTestCount: number;
  remainingMs: number;
  configuredMs: number;
}): number {
  const remaining = Math.max(0, input.remainingMs);
  if (input.action === "implement_core" && input.productTestCount === 0) {
    const reserve = remaining > RESERVE_AFTER_CORE_MIN_REMAINING_MS ? RESERVE_AFTER_CORE_MS : 0;
    return Math.max(0, remaining - reserve);
  }
  return Math.min(Math.max(0, input.configuredMs), remaining);
}

/** A green L0 is the slice verdict. Do not turn leftover wall clock into exit 124. */
export function ralphProcessExit(input: {
  lastL0Passed: boolean;
  timedOut: boolean;
  lastExit: number;
}): { exitCode: number; timedOut: boolean } {
  if (input.lastL0Passed) return { exitCode: 0, timedOut: false };
  return { exitCode: input.timedOut ? 124 : input.lastExit, timedOut: input.timedOut };
}

export function isSealedGreenCheckpoint(relativePath: string | null): relativePath is string {
  return typeof relativePath === "string" && /(?:^|\/)green-\d+$/.test(relativePath.replaceAll("\\", "/"));
}

export async function runMilestoneRalph(input: MilestoneRalphInput): Promise<MilestoneRalphResult> {
  const verifyApp = input.verifyApp ?? verifyGeneratedApp;
  const startedAt = Date.now();
  const checkpointsRoot = path.join(input.artifactDirectory, "checkpoints");
  const seedCheckpoint = path.join(checkpointsRoot, "seed");
  const slicesRoot = path.join(input.artifactDirectory, "slices");
  await sealCheckpoint(input.outputDirectory, seedCheckpoint);

  let state = initialMilestoneState();
  await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);

  const eventFiles: string[] = [];
  const stderrFiles: string[] = [];
  const usages: UsageSummary[] = [];
  let lastExit = 0;
  let timedOut = false;
  let lastVerification: AppVerification | null = null;

  while (!state.done) {
    const remaining = remainingTimeoutMs(startedAt, input.overallTimeoutMs);
    if (remaining < MIN_SLICE_BUDGET_MS) {
      if (remaining < 1_000 && state.sealed.length === 0 && lastVerification === null) {
        timedOut = true;
        lastExit = 124;
      }
      break;
    }

    const maxSlices = input.harness?.harness.control.max_slices ?? input.maxSlices;
    const observation = await observeWorkspace(input.outputDirectory);
    const next = chooseNextSlice(state, observation, maxSlices, input.harness);
    if (next.action === "done") {
      state = { ...state, done: true, last_action: "done", last_title: next.title };
      break;
    }

    const greenCheckpoint = state.last_green_checkpoint;
    if (
      next.action === "repair" &&
      isSealedGreenCheckpoint(greenCheckpoint) &&
      input.harness?.harness.control.restore_on_repair !== false
    ) {
      const checkpointDirectory = path.join(input.artifactDirectory, greenCheckpoint);
      await restoreCheckpoint(checkpointDirectory, input.outputDirectory);
      console.log(`[ralph] restored checkpoint ${greenCheckpoint}`);
    }

    const sliceIndex = state.slice;
    const sliceDir = path.join(slicesRoot, `m${String(sliceIndex).padStart(2, "0")}`);
    const sessionDir = path.join(sliceDir, "sessions");
    await mkdir(sessionDir, { recursive: true });
    const eventFile = path.join(sliceDir, "events.jsonl");
    const stderrFile = path.join(sliceDir, "pi.stderr.log");
    const configuredTimeout = input.harness?.harness.control.slice_timeout_ms ?? input.sliceTimeoutMs;
    const sliceTimeout = sliceBudgetMs({
      action: next.action,
      productTestCount: observation.productTestFiles.length,
      remainingMs: remaining,
      configuredMs: configuredTimeout,
    });

    state = {
      ...state,
      last_action: next.action,
      last_title: next.title,
      last_instruction: next.instruction,
    };
    await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);
    console.log(`[ralph] slice ${sliceIndex} ${next.action}: ${next.title} (timeout ${sliceTimeout}ms)`);

    const userPrompt = formatWorkerPrompt(input.idea, next, state, input.harness);
    await writeFile(path.join(sliceDir, "prompt.md"), userPrompt, "utf8");

    const piArgs = input.buildPiArguments(
      input.idea,
      input.systemPrompt,
      input.publicJourneys,
      input.appContext,
      input.artifactDirectory,
      {
        harnessOwnedVerify: input.harnessOwnedVerify,
        sessionDir,
        userPrompt,
      },
    );

    let pi: CommandResult;
    try {
      pi = await input.runPi(piArgs, input.outputDirectory, eventFile, stderrFile, sliceTimeout);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeFile(stderrFile, `${message}\n`, "utf8");
      pi = { exitCode: 1, timedOut: false };
      await writeFile(eventFile, "", "utf8");
    }

    eventFiles.push(eventFile);
    stderrFiles.push(stderrFile);
    try {
      usages.push(collectUsageFromJsonLines(await readFile(eventFile, "utf8")));
    } catch {
      usages.push(emptyUsage());
    }

    lastExit = pi.exitCode;
    if (pi.timedOut) timedOut = true;

    lastVerification = await verifyApp(input.outputDirectory, sliceDir, {
      displayRoot: input.repositoryRoot,
      ...MILESTONE_L0_OPTIONS,
    });
    const l0 = snapshotL0(lastVerification);
    await writeJson(path.join(sliceDir, "l0.json"), l0);

    const sealedEntry = {
      slice: sliceIndex,
      title: next.title,
      action: next.action,
      l0_passed: l0.passed,
    };
    if (l0.passed) {
      const greenRel = `checkpoints/green-${String(sliceIndex).padStart(2, "0")}`;
      await sealCheckpoint(input.outputDirectory, path.join(input.artifactDirectory, greenRel));
      state = {
        ...state,
        slice: sliceIndex + 1,
        last_l0: l0,
        last_green_checkpoint: greenRel,
        sealed: [...state.sealed, sealedEntry],
      };
      console.log(`[ralph] slice ${sliceIndex} L0 PASS — sealed ${greenRel}`);
    } else {
      state = {
        ...state,
        slice: sliceIndex + 1,
        last_l0: l0,
        sealed: [...state.sealed, sealedEntry],
      };
      console.log(`[ralph] slice ${sliceIndex} L0 FAIL`);
    }
    await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);
  }

  const combinedEventsPath = path.join(input.artifactDirectory, "events.jsonl");
  const combinedStderrPath = path.join(input.artifactDirectory, "pi.stderr.log");
  await concatTextFiles(eventFiles, combinedEventsPath);
  await concatTextFiles(stderrFiles, combinedStderrPath);

  state = { ...state, done: true };
  await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);

  const processExit = ralphProcessExit({
    lastL0Passed: state.last_l0?.passed === true,
    timedOut,
    lastExit,
  });
  return {
    exitCode: processExit.exitCode,
    timedOut: processExit.timedOut,
    usage: mergeUsageSummaries(usages),
    state,
    combinedEventsPath,
    combinedStderrPath,
    lastVerification,
  };
}
