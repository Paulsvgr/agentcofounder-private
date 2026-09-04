import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyAppTemplateTree, prepareOutput } from "./prepare-output.js";
import { snapshotGeneratedApp } from "./snapshot-generated-app.js";
import { auditAppPortAfterPi } from "./port-owner.js";
import { signalProcessTree, terminateProcessTree, usesDetachedProcessGroup } from "./process-tree.js";
import {
  composeResult,
  missingRequiredResultPaths,
  readPartialResult,
  rootStartCommand,
  writeResult,
} from "./result.js";
import { collectUsageFromJsonLines } from "./usage.js";
import type { AppVerification, RunResult } from "./types.js";
import { validateResultObject } from "./validate-result.js";
import {
  portHasListener,
  journeysFromVitestReport,
  shouldReuseSliceVerification,
  unavailableAppVerification,
  verifyGeneratedApp,
} from "./verify-app.js";
import { analyzeRun, formatAnalyzeSummary } from "./v2/analyze-run.js";
import {
  buildPreRunManifest,
  buildRunManifestOutcome,
  finalizeRunManifest,
  resolveExperimentId,
  writeRunManifest,
} from "./v2/manifest.js";
import { ensureExperimentCatalogEntry } from "./v2/experiment-catalog.js";
import { resolveRunConfigFromEnvironment, isMilestoneRalphStrategy } from "./v2/config.js";
import {
  DEFAULT_MAX_SLICES,
  DEFAULT_SLICE_TIMEOUT_MS,
  runMilestoneRalph,
} from "./v2/milestone-ralph/run.js";
import { loadHarnessFromEnvironment } from "./v2/rhi/apply.js";
import { materializeRuntimeAdditions } from "./v2/rhi/materialize.js";

interface Arguments {
  ideaFile: string;
  outputDirectory: string;
  prepareOnly: boolean;
  skipAppInstall: boolean;
}

export interface CommandResult {
  exitCode: number;
  timedOut: boolean;
}

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const APP_PORT = 3000;

export function runRequiresFailureExit(
  piExitCode: number,
  resultStatus: RunResult["status"],
  missingResultPaths: string[],
): boolean {
  if (missingResultPaths.length > 0 || resultStatus !== "success") return true;
  return piExitCode !== 0 && piExitCode !== 124;
}

function printHelp(): void {
  console.log(`Usage: npm run challenge -- [options]

Options:
  --idea-file <path>      Idea prompt file (default: contract-public/development-idea.txt)
  --output-dir <path>     Generated app directory below output/ (default: output/app)
  --prepare-only          Reset the app from the seed without invoking Pi
  --skip-app-install      Do not run npm ci in the generated app
  --help                  Show this help

Environment:
  CHALLENGE_PROVIDER         Optional Pi provider override
  CHALLENGE_MODEL            Optional Pi model override
  CHALLENGE_THINKING         Optional Pi thinking level (default: off)
  CHALLENGE_MAX_TOKENS       Optional max output tokens (recorded in run manifest)
  CHALLENGE_CONTEXT_WINDOW   Optional model context window (recorded in run manifest)
  CHALLENGE_TIMEOUT_MS       Wall-clock limit for the whole run (default: 3600000)
  EXECUTION_STRATEGY         milestone_ralph (default) or single_session
  MILESTONE_TIMEOUT_MS       Per-slice Pi limit for milestone_ralph (default: 900000)
  MILESTONE_MAX_SLICES       Max worker slices for milestone_ralph (default: 3)
  RHI_HARNESS                Optional path to an optimized harness.json (production loads this only)
  RUN_EXPERIMENT / RUN_ARM / RUN_REP / RUN_INTERVENTION  Optional experiment metadata
  RUN_COHORT                                           Legacy alias for RUN_EXPERIMENT
`);
}

export function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = {
    ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
    outputDirectory: path.join("output", "app"),
    prepareOnly: false,
    skipAppInstall: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      printHelp();
      process.exit(0);
    }
    if (argument === "--prepare-only") {
      parsed.prepareOnly = true;
      continue;
    }
    if (argument === "--skip-app-install") {
      parsed.skipAppInstall = true;
      continue;
    }
    if (argument === "--idea-file" || argument === "--output-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--idea-file") parsed.ideaFile = path.resolve(value);
      else parsed.outputDirectory = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function commandName(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function runInherited(command: string, args: string[], cwd: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env, shell: false });
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

function summarizeEventLine(line: string): void {
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    if (event.type === "tool_execution_end") {
      console.log(`[pi] completed tool: ${String(event.toolName ?? "unknown")}`);
    }
    if (event.type === "message_end") {
      const message = event.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      if (message?.role === "assistant" && usage) {
        console.log(
          `[pi] model call completed: input=${String(usage.input ?? 0)} output=${String(usage.output ?? 0)}`,
        );
      }
    }
  } catch {
    // The unmodified line remains in events.jsonl for independent inspection.
  }
}

export async function runPi(
  args: string[],
  cwd: string,
  eventFile: string,
  stderrFile: string,
  timeoutMs: number,
): Promise<CommandResult> {
  const events = createWriteStream(eventFile, { flags: "wx" });
  const errors = createWriteStream(stderrFile, { flags: "wx" });
  let lineBuffer = "";
  let piChild: ReturnType<typeof spawn> | undefined;

  try {
    return await new Promise<CommandResult>((resolve, reject) => {
      const piBinary = path.join(
        REPOSITORY_ROOT,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "pi.cmd" : "pi",
      );
      const child = spawn(piBinary, args, {
        cwd,
        detached: usesDetachedProcessGroup(),
        env: { ...process.env, PI_OFFLINE: "1" },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      piChild = child;
      let timedOut = false;
      let killTimer: NodeJS.Timeout | undefined;
      const timeout = setTimeout(() => {
        timedOut = true;
        signalProcessTree(child, "SIGTERM");
        killTimer = setTimeout(() => signalProcessTree(child, "SIGKILL"), 5_000);
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        events.write(chunk);
        lineBuffer += chunk.toString("utf8");
        const lines = lineBuffer.split(/\r?\n/u);
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) summarizeEventLine(line);
      });
      child.stderr.pipe(errors);
      child.stderr.pipe(process.stderr);
      child.once("error", (error) => {
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        if (lineBuffer !== "") summarizeEventLine(lineBuffer);
        resolve({ exitCode: timedOut ? 124 : (code ?? 1), timedOut });
      });
    });
  } finally {
    if (piChild) await terminateProcessTree(piChild);
    await Promise.all([
      new Promise<void>((resolve) => events.end(resolve)),
      new Promise<void>((resolve) => errors.end(resolve)),
    ]);
  }
}

export function composeAppendedSystemPrompt(
  systemPrompt: string,
  publicJourneys: string,
  appContext: string,
): string {
  return `${systemPrompt.trim()}\n\n${publicJourneys.trim()}\n\n${appContext.trim()}`;
}

export function buildPiArguments(
  idea: string,
  systemPrompt: string,
  publicJourneys: string,
  appContext: string,
  artifactDirectory: string,
  options: {
    harnessOwnedVerify?: boolean;
    sessionDir?: string;
    userPrompt?: string;
  } = {},
): string[] {
  const sessionDir = options.sessionDir ?? path.join(artifactDirectory, "sessions");
  const userPrompt = options.userPrompt ?? `## Product idea\n\n${idea.trim()}\n`;
  const args = [
    "--mode",
    "json",
    "--offline",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--append-system-prompt",
    composeAppendedSystemPrompt(systemPrompt, publicJourneys, appContext),
    "--session-dir",
    sessionDir,
    "--extension",
    path.join(REPOSITORY_ROOT, "solution", "extensions", "protected-paths.ts"),
  ];
  if (options.harnessOwnedVerify) {
    args.push(
      "--extension",
      path.join(REPOSITORY_ROOT, "solution", "extensions", "harness-owned-verify.ts"),
    );
  }
  args.push("--skill", path.join(REPOSITORY_ROOT, "solution", "skills", "mvp-builder"));
  if (process.env.CHALLENGE_PROVIDER) args.push("--provider", process.env.CHALLENGE_PROVIDER);
  if (process.env.CHALLENGE_MODEL) args.push("--model", process.env.CHALLENGE_MODEL);
  args.push("--thinking", process.env.CHALLENGE_THINKING ?? "off");
  args.push(userPrompt);
  return args;
}

function timeoutFromEnvironment(): number {
  const raw = process.env.CHALLENGE_TIMEOUT_MS ?? "3600000";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000) {
    throw new Error("CHALLENGE_TIMEOUT_MS must be an integer of at least 1000");
  }
  return value;
}

function optionalPositiveIntFromEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const idea = await readFile(args.ideaFile, "utf8");
  const outputDirectory = await prepareOutput(REPOSITORY_ROOT, args.outputDirectory);
  console.log(`Prepared clean application workspace: ${outputDirectory}`);

  if (!args.skipAppInstall) {
    const installCode = await runInherited(
      commandName("npm"),
      ["ci", "--ignore-scripts", "--prefer-offline"],
      outputDirectory,
    );
    if (installCode !== 0) throw new Error(`App dependency installation failed with exit code ${installCode}`);
  }
  if (args.prepareOnly) return;

  const [loadedSystemPrompt, publicJourneys, appContext] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, "solution", "system-prompt.md"), "utf8"),
    readFile(path.join(REPOSITORY_ROOT, "contract-public", "journeys.md"), "utf8"),
    readFile(path.join(outputDirectory, "AGENTS.md"), "utf8"),
  ]);
  const rhiHarness = await loadHarnessFromEnvironment();
  const runtimeAdditions = rhiHarness ? materializeRuntimeAdditions(rhiHarness) : "";
  const systemPrompt =
    runtimeAdditions === "" ? loadedSystemPrompt : `${loadedSystemPrompt.trim()}\n\n${runtimeAdditions}`;

  const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const artifactDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", runId);
  await mkdir(path.join(artifactDirectory, "sessions"), { recursive: true });
  if (process.env.RHI_RUN_POINTER) {
    await writeFile(process.env.RHI_RUN_POINTER, artifactDirectory, "utf8");
  }
  if (rhiHarness) {
    await writeFile(path.join(artifactDirectory, "rhi-harness.json"), `${JSON.stringify(rhiHarness, null, 2)}\n`, "utf8");
    console.log(`Loaded RHI harness ${rhiHarness.id} from ${process.env.RHI_HARNESS}`);
  }
  await writeFile(path.join(artifactDirectory, "idea.txt"), idea, "utf8");
  await copyAppTemplateTree(
    path.join(REPOSITORY_ROOT, "app-template"),
    path.join(artifactDirectory, "app-template"),
    { writeMarker: false },
  );

  const runConfig = resolveRunConfigFromEnvironment();
  if (runConfig.harness_owned_verify) {
    process.env.HARNESS_OWNED_VERIFY = "1";
  }

  const manifest = await buildPreRunManifest({
    runId,
    repositoryRoot: REPOSITORY_ROOT,
    ideaFile: args.ideaFile,
    ideaText: idea,
    templateSnapshotDirectory: path.join(artifactDirectory, "app-template"),
    systemPrompt,
    publicJourneys,
    agentsMd: appContext,
    config: runConfig,
  });
  await writeRunManifest(artifactDirectory, manifest);

  const eventFile = path.join(artifactDirectory, "events.jsonl");
  const stderrFile = path.join(artifactDirectory, "pi.stderr.log");
  const appPortHadListenerBeforePi = await portHasListener(APP_PORT);
  const piStartedAt = Date.now();
  const overallTimeoutMs = timeoutFromEnvironment();
  const useRalph = isMilestoneRalphStrategy(runConfig.execution_strategy);
  if (useRalph) {
    console.log("Execution strategy: milestone_ralph (fresh Pi session + L0 gate per slice)");
  }
  let pi: CommandResult;
  let ralphLastVerification: AppVerification | null = null;
  let ralphStopReason: string | null = null;
  let ralphSliceCount = 0;
  let ralphContextMetrics: Array<{
    estimated_tokens_before: number;
    estimated_tokens_after: number;
    reduction_ratio: number;
  }> = [];
  if (useRalph) {
    const ralph = await runMilestoneRalph({
      idea,
      systemPrompt,
      publicJourneys,
      appContext,
      outputDirectory,
      artifactDirectory,
      repositoryRoot: REPOSITORY_ROOT,
      harnessOwnedVerify: runConfig.harness_owned_verify,
      overallTimeoutMs,
      sliceTimeoutMs: optionalPositiveIntFromEnvironment("MILESTONE_TIMEOUT_MS", DEFAULT_SLICE_TIMEOUT_MS),
      maxSlices: optionalPositiveIntFromEnvironment("MILESTONE_MAX_SLICES", DEFAULT_MAX_SLICES),
      ...(rhiHarness ? { harness: rhiHarness } : {}),
      runPi,
      buildPiArguments,
    });
    pi = { exitCode: ralph.exitCode, timedOut: ralph.timedOut };
    ralphLastVerification = ralph.lastVerification;
    ralphStopReason = ralph.stopReason;
    ralphSliceCount = ralph.state.sealed.length;
    ralphContextMetrics = ralph.state.context_metrics ?? [];
  } else {
    pi = await runPi(
      buildPiArguments(idea, systemPrompt, publicJourneys, appContext, artifactDirectory, {
        harnessOwnedVerify: runConfig.harness_owned_verify,
      }),
      outputDirectory,
      eventFile,
      stderrFile,
      overallTimeoutMs,
    );
  }
  const wallMs = Date.now() - piStartedAt;
  const portReclamation = await auditAppPortAfterPi(APP_PORT, outputDirectory, appPortHadListenerBeforePi);
  if (portReclamation.listener_after_pi) {
    const message = `${portReclamation.diagnostic}; pids=${portReclamation.process_ids.join(",") || "none"}`;
    if (portReclamation.reclaimed) console.log(message);
    else console.warn(message);
  }

  const usage = collectUsageFromJsonLines(await readFile(eventFile, "utf8").catch(() => ""));
  const partial = await readPartialResult(outputDirectory);
  const canVerifyApp = usage.model_calls > 0 && (useRalph || pi.exitCode === 0);
  const startCommand = rootStartCommand(REPOSITORY_ROOT, outputDirectory);
  let verification = unavailableAppVerification(
    canVerifyApp ? "app verification had not completed" : "Pi did not complete with audited model usage",
  );
  let result = composeResult(partial, usage, pi.exitCode, verification, portReclamation, startCommand);
  const appResultPath = path.join(outputDirectory, "result.json");
  const rootResultPath = path.join(REPOSITORY_ROOT, "result.json");
  const requiredResultPaths = [appResultPath, rootResultPath];
  const artifactResultPath = path.join(artifactDirectory, "result.json");
  let resultPaths = await writeResult(
    outputDirectory,
    result,
    [rootResultPath, artifactResultPath],
  );
  if (canVerifyApp) {
    if (ralphLastVerification && shouldReuseSliceVerification(ralphLastVerification)) {
      verification = ralphLastVerification;
      console.log("Official app verify reused last slice L0 (skipped duplicate tests/build/HTTP)");
    } else {
      verification = await verifyGeneratedApp(outputDirectory, artifactDirectory, { displayRoot: REPOSITORY_ROOT });
    }
    const harnessJourneys =
      partial.tests_run.length === 0
        ? await journeysFromVitestReport(path.join(artifactDirectory, "app-test-results.json"))
        : [];
    result = composeResult(
      partial,
      usage,
      pi.exitCode,
      verification,
      portReclamation,
      startCommand,
      harnessJourneys,
    );
    resultPaths = await writeResult(outputDirectory, result, [rootResultPath, artifactResultPath]);
  }
  const missingResultPaths = missingRequiredResultPaths(resultPaths, requiredResultPaths);
  const avg = (values: number[]): number | null =>
    values.length === 0 ? null : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
  const manifestExtras: {
    slice_count?: number;
    stop_reason?: string | null;
    context_token_before_avg?: number | null;
    context_token_after_avg?: number | null;
    context_reduction_ratio_avg?: number | null;
  } = {
    stop_reason: ralphStopReason,
    context_token_before_avg: avg(ralphContextMetrics.map((m) => m.estimated_tokens_before)),
    context_token_after_avg: avg(ralphContextMetrics.map((m) => m.estimated_tokens_after)),
    context_reduction_ratio_avg: avg(ralphContextMetrics.map((m) => m.reduction_ratio)),
  };
  if (ralphSliceCount > 0) manifestExtras.slice_count = ralphSliceCount;
  await writeRunManifest(
    artifactDirectory,
    finalizeRunManifest(manifest, buildRunManifestOutcome(result, usage, wallMs, manifestExtras)),
  );
  const experimentId = resolveExperimentId(manifest.experiment);
  if (experimentId) {
    try {
      await ensureExperimentCatalogEntry(REPOSITORY_ROOT, experimentId, manifest.experiment.arm);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Experiment catalog update skipped: ${message}`);
    }
  }
  const validationErrors = await validateResultObject(result);
  if (validationErrors.length > 0) {
    for (const error of validationErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Result written to ${resultPaths.join(" and ")}`);
  console.log(`Audit artifacts written to ${artifactDirectory}`);
  try {
    await snapshotGeneratedApp(outputDirectory, path.join(artifactDirectory, "app"));
    console.log(`Generated app snapshot written to ${path.join(artifactDirectory, "app")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`App snapshot failed (run artifacts preserved): ${message}`);
  }
  try {
    const analysis = await analyzeRun({
      repositoryRoot: REPOSITORY_ROOT,
      runDirectory: artifactDirectory,
    });
    console.log("Analysis station written automatically:");
    for (const line of formatAnalyzeSummary(analysis)) {
      console.log(line);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Analysis failed (run artifacts preserved): ${message}`);
  }
  for (const missingResultPath of missingResultPaths) {
    console.error(`Required result destination was not written: ${missingResultPath}`);
  }
  if (pi.timedOut) {
    console.error(
      useRalph
        ? "A milestone-RALPH slice was stopped by its timeout (MILESTONE_TIMEOUT_MS or the remaining wall clock)."
        : "Pi exceeded CHALLENGE_TIMEOUT_MS and was terminated.",
    );
  }
  if (runRequiresFailureExit(pi.exitCode, result.status, missingResultPaths)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
