import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { AppVerification, UsageSummary } from "../../types.js";
import { collectUsageFromJsonLines } from "../../usage.js";
import { MILESTONE_L0_OPTIONS, verifyGeneratedApp, type VerificationOptions } from "../../verify-app.js";
import { restoreCheckpoint, sealCheckpoint } from "./checkpoint.js";
import { snapshotL0 } from "./l0.js";
import { observeWorkspace, qualityGapLines } from "./observe.js";
import { chooseNextSliceIntelligent, formatWorkerPrompt } from "./orchestrator.js";
import { initialMilestoneState, type MilestoneAction, type MilestoneState } from "./state.js";
import type { HarnessDocument } from "../rhi/schema.js";
import {
  createContextWithMemory,
  estimateLegacyPromptTokens,
  formatVolatileWorkerPrompt,
  measureContextPrompt,
  applyDecisionToContext,
  verificationDigest,
  workspaceFingerprint,
  failureFingerprint,
  estimateTokens,
  type MilestoneContext,
} from "../context/index.js";
import { observeAndDiagnose } from "../sensors/index.js";
import { loadEnabledMemoryRules, promoteRunIntoMemory, ensureHarnessMemory } from "../harness-memory/store.js";
import { highValueGapExists } from "../quality/matrix.js";

export interface CommandResult {
  exitCode: number;
  timedOut: boolean;
}

export const DEFAULT_SLICE_TIMEOUT_MS = 900_000;
/** Prefer finishing in few slices; long walls with many retries burn tokens on polish. */
export const DEFAULT_MAX_SLICES = 3;
/** Do not start a slice that cannot finish L0 before the overall deadline. */
export const MIN_SLICE_BUDGET_MS = 45_000;
/** Keep budget for a later continue/repair after the first implementer attempt. */
export const RESERVE_AFTER_CORE_MS = 120_000;
export const RESERVE_AFTER_CORE_MIN_REMAINING_MS = 300_000;

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
  /** When false, use classic hop selection + legacy prompts. Default true. */
  contextIntelligence?: boolean;
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
  stopReason: string | null;
  context: MilestoneContext | null;
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
 * Cap each slice at the configured timeout so a long wall yields multiple full
 * attempts. Reserve a later slice when the remaining wall is long enough.
 */
export function sliceBudgetMs(input: {
  action: MilestoneAction;
  productTestCount: number;
  remainingMs: number;
  configuredMs: number;
}): number {
  const remaining = Math.max(0, input.remainingMs);
  const configured = Math.max(0, input.configuredMs);
  if (input.action === "implement_core" && input.productTestCount === 0) {
    const reserve = remaining > RESERVE_AFTER_CORE_MIN_REMAINING_MS ? RESERVE_AFTER_CORE_MS : 0;
    return Math.min(configured, Math.max(0, remaining - reserve));
  }
  return Math.min(configured, remaining);
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

function intelligenceEnabled(input: MilestoneRalphInput): boolean {
  if (input.contextIntelligence === false) return false;
  if (process.env.CONTEXT_INTELLIGENCE === "0") return false;
  return true;
}

export async function runMilestoneRalph(input: MilestoneRalphInput): Promise<MilestoneRalphResult> {
  const verifyApp = input.verifyApp ?? verifyGeneratedApp;
  const startedAt = Date.now();
  const checkpointsRoot = path.join(input.artifactDirectory, "checkpoints");
  const seedCheckpoint = path.join(checkpointsRoot, "seed");
  const slicesRoot = path.join(input.artifactDirectory, "slices");
  await sealCheckpoint(input.outputDirectory, seedCheckpoint);

  const useIntel = intelligenceEnabled(input);
  await ensureHarnessMemory(input.repositoryRoot);
  const memoryRules = useIntel ? await loadEnabledMemoryRules(input.repositoryRoot) : [];
  let context: MilestoneContext | null = useIntel ? createContextWithMemory(input.idea, memoryRules) : null;

  let state = initialMilestoneState();
  await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);
  if (context) {
    await writeJson(path.join(input.artifactDirectory, "milestone-context.json"), context);
  }

  const eventFiles: string[] = [];
  const stderrFiles: string[] = [];
  const usages: UsageSummary[] = [];
  let lastExit = 0;
  let timedOut = false;
  let lastVerification: AppVerification | null = null;
  let stopReason: string | null = null;
  const stableSystem = `${input.systemPrompt.trim()}\n\n${input.publicJourneys.trim()}\n\n${input.appContext.trim()}`;
  const stableSystemSha = createHash("sha256").update(stableSystem).digest("hex");
  const stableSystemTokens = estimateTokens(stableSystem);
  const allDiagnosisCodes: string[] = [];
  let lastStableSha: string | null = null;

  while (!state.done) {
    const remaining = remainingTimeoutMs(startedAt, input.overallTimeoutMs);
    if (remaining < MIN_SLICE_BUDGET_MS) {
      if (remaining < 1_000 && state.sealed.length === 0 && lastVerification === null) {
        timedOut = true;
        lastExit = 124;
      }
      stopReason = stopReason ?? "wall_clock_exhausted";
      break;
    }

    const maxSlices = input.harness?.harness.control.max_slices ?? input.maxSlices;
    const observation = await observeWorkspace(input.outputDirectory);

    const fp = workspaceFingerprint(observation);
    const unchanged =
      state.last_workspace_fingerprint && state.last_workspace_fingerprint === fp
        ? (state.unchanged_workspace_streak ?? 0) + 1
        : 0;
    state = {
      ...state,
      last_workspace_fingerprint: fp,
      unchanged_workspace_streak: unchanged,
    };

    const { findings, diagnosis, sensorContext } = useIntel
      ? await observeAndDiagnose(input.outputDirectory, observation, {
          lastL0Summary: state.last_l0?.summary ?? null,
          lastL0Passed: state.last_l0?.passed ?? null,
          recentFailureFingerprints: state.failure_fingerprints ?? [],
        })
      : { findings: [], diagnosis: [], sensorContext: null };

    for (const d of diagnosis) {
      if (d.code) allDiagnosisCodes.push(d.code);
    }

    // Quality gate before agent: avoid Pi when L0 is green and sensors show no high-value gap.
    if (
      useIntel &&
      state.last_l0?.passed &&
      observation.productTestFiles.length > 0 &&
      !highValueGapExists(diagnosis) &&
      (observation.reportStatus === "success" || state.last_action === "continue_journeys")
    ) {
      stopReason = "pre_agent_quality_gate_no_high_value_gap";
      state = {
        ...state,
        done: true,
        last_action: "done",
        last_title: "Stop (pre-agent gate)",
        stop_reason: stopReason,
      };
      console.log(`[ralph] pre-agent gate: stop (${stopReason})`);
      break;
    }

    const { slice: next, decision } = chooseNextSliceIntelligent({
      state,
      observation,
      diagnosis,
      maxSlices,
      adaptive: useIntel,
      stableSystemTokens,
      volatileTokens: 350,
      ...(input.harness ? { harness: input.harness } : {}),
    });

    if (decision?.stop_reason) {
      stopReason = decision.stop_reason;
    }

    if (next.action === "done") {
      state = {
        ...state,
        done: true,
        last_action: "done",
        last_title: next.title,
        stop_reason: stopReason ?? decision?.stop_reason ?? "done",
      };
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
    const sliceRel = `slices/m${String(sliceIndex).padStart(2, "0")}`;
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

    if (useIntel && context && decision) {
      if (lastStableSha && lastStableSha !== stableSystemSha) {
        console.warn(
          `[ralph] STABLE PROMPT DRIFT detected — cache efficiency will drop (was ${lastStableSha.slice(0, 12)}… now ${stableSystemSha.slice(0, 12)}…)`,
        );
      }
      lastStableSha = stableSystemSha;

      const sliceContract = decision.selected.contract;
      const applied = applyDecisionToContext({
        context,
        observation,
        diagnosis,
        candidate: decision.selected,
        stopReason: null,
        changedFiles: observation.sourceFiles.filter((f) => f.startsWith("src/")).slice(0, 40),
        appIsSeedLike: /Welcome to the challenge starter/i.test(sensorContext?.appTsxSnippet ?? ""),
        sourceSample: sensorContext?.sourceTextSample ?? "",
        sliceDirRelative: sliceRel,
      });
      context = applied.context;

      const legacyTokens = estimateLegacyPromptTokens({
        idea: input.idea,
        instruction: next.instruction,
        sealedSummary: state.sealed.map((s) => `${s.title}:${s.l0_passed}`).join(","),
        lastL0Summary: state.last_l0?.summary ?? "",
        qualityGaps: qualityGapLines(observation),
      });
      const volatilePrompt = formatVolatileWorkerPrompt(context, sliceContract);
      const metrics = measureContextPrompt({
        slice: sliceIndex,
        stableSystemChars: stableSystem.length,
        volatilePrompt,
        context,
        legacyEstimateTokens: legacyTokens,
        compacted: applied.compacted,
        stablePromptSha256: stableSystemSha,
        outputBudget: sliceContract.output_budget_tokens,
      });
      context = {
        ...context,
        metrics_log: [...context.metrics_log, metrics],
      };
      state = {
        ...state,
        context_metrics: [
          ...(state.context_metrics ?? []),
          {
            slice: metrics.slice,
            estimated_tokens_before: metrics.estimated_tokens_before,
            estimated_tokens_after: metrics.estimated_tokens_after,
            reduction_ratio: metrics.reduction_ratio,
            compacted: metrics.compacted,
          },
        ],
      };
      await writeJson(path.join(sliceDir, "sensors.json"), { findings });
      await writeJson(path.join(sliceDir, "diagnosis.json"), { diagnosis, voi: decision });
      await writeJson(path.join(sliceDir, "slice-contract.json"), sliceContract);
      await writeJson(path.join(sliceDir, "context-metrics.json"), metrics);
      await writeJson(path.join(sliceDir, "quality-gate.json"), {
        pre_agent: "proceed",
        high_value_gap: highValueGapExists(diagnosis),
        matrix_points_at_risk: decision.selected.breakdown.matrix_points_at_risk,
        expected_weighted_cost: decision.selected.breakdown.expected_weighted_cost,
        action_score: decision.selected.score,
      });
    }

    state = {
      ...state,
      last_action: next.action,
      last_title: next.title,
      last_instruction: next.instruction,
      last_voi_kind: next.voi_kind ?? null,
    };
    await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);
    if (context) {
      await writeJson(path.join(input.artifactDirectory, "milestone-context.json"), context);
    }

    console.log(
      `[ralph] slice ${sliceIndex} ${next.action}${next.voi_kind ? `/${next.voi_kind}` : ""}: ${next.title} (timeout ${sliceTimeout}ms)`,
    );

    const userPrompt = formatWorkerPrompt(
      input.idea,
      next,
      state,
      input.harness,
      observation,
      context ?? undefined,
      decision?.selected.contract,
    );
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

    const failFp = failureFingerprint(l0);
    const failureFingerprints = [...(state.failure_fingerprints ?? [])];
    if (failFp) failureFingerprints.push(failFp);

    const sealedEntry = {
      slice: sliceIndex,
      title: next.title,
      action: next.action,
      l0_passed: l0.passed,
      ...(next.voi_kind ? { voi_kind: next.voi_kind } : {}),
    };

    if (context) {
      context = {
        ...context,
        volatile: {
          ...context.volatile,
          latest_verification: verificationDigest(l0, `${sliceRel}/l0.json`),
          known_defects: l0.passed
            ? context.volatile.known_defects.filter((d) => !/L0/i.test(d))
            : [...context.volatile.known_defects, l0.summary.split("\n")[0] ?? "L0 FAIL"].slice(-8),
        },
      };
    }

    if (l0.passed) {
      const greenRel = `checkpoints/green-${String(sliceIndex).padStart(2, "0")}`;
      await sealCheckpoint(input.outputDirectory, path.join(input.artifactDirectory, greenRel));
      state = {
        ...state,
        slice: sliceIndex + 1,
        last_l0: l0,
        last_green_checkpoint: greenRel,
        sealed: [...state.sealed, sealedEntry],
        failure_fingerprints: failureFingerprints.slice(-12),
      };
      console.log(`[ralph] slice ${sliceIndex} L0 PASS — sealed ${greenRel}`);
    } else {
      state = {
        ...state,
        slice: sliceIndex + 1,
        last_l0: l0,
        sealed: [...state.sealed, sealedEntry],
        failure_fingerprints: failureFingerprints.slice(-12),
      };
      console.log(`[ralph] slice ${sliceIndex} L0 FAIL`);
    }
    await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);
    if (context) {
      await writeJson(path.join(input.artifactDirectory, "milestone-context.json"), context);
    }
  }

  const combinedEventsPath = path.join(input.artifactDirectory, "events.jsonl");
  const combinedStderrPath = path.join(input.artifactDirectory, "pi.stderr.log");
  await concatTextFiles(eventFiles, combinedEventsPath);
  await concatTextFiles(stderrFiles, combinedStderrPath);

  stopReason = stopReason ?? state.stop_reason ?? "loop_complete";
  state = { ...state, done: true, stop_reason: stopReason };
  await writeJson(path.join(input.artifactDirectory, "milestone-state.json"), state);

  if (useIntel) {
    const runId = path.basename(input.artifactDirectory);
    await promoteRunIntoMemory({
      repositoryRoot: input.repositoryRoot,
      runId,
      diagnosisCodes: [...new Set(allDiagnosisCodes)],
      l0Passed: state.last_l0?.passed === true,
      productTestCount: (await observeWorkspace(input.outputDirectory)).productTestFiles.length,
      stopReason,
    });
  }

  if (context) {
    context = {
      ...context,
      volatile: { ...context.volatile, stop_reason: stopReason },
    };
    await writeJson(path.join(input.artifactDirectory, "milestone-context.json"), context);
  }

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
    stopReason,
    context,
  };
}
