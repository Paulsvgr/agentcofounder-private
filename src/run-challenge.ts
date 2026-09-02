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
import type { RunResult } from "./types.js";
import { validateResultObject } from "./validate-result.js";
import { portHasListener, unavailableAppVerification, verifyGeneratedApp } from "./verify-app.js";
import { analyzeRun, formatAnalyzeSummary } from "./v2/analyze-run.js";
import {
  buildPreRunManifest,
  buildRunManifestOutcome,
  finalizeRunManifest,
  resolveExperimentId,
  writeRunManifest,
} from "./v2/manifest.js";
import { ensureExperimentCatalogEntry } from "./v2/experiment-catalog.js";
import { resolveRunConfigFromEnvironment } from "./v2/config.js";
import {
  buildAppendSystemPrompt,
  buildPiArgumentsFromBundle,
  buildProductIdeaUserMessage,
  type ChallengePromptBundle,
} from "./v2/challenge-prompt.js";
import {
  cssVocabularyGuardsEnabled,
  resolveTemplateOverlayConfigFromEnvironment,
  toTemplateOverlaysManifestBlock,
} from "./v2/template-overlays.js";

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
  return missingResultPaths.length > 0 || piExitCode !== 0 || resultStatus !== "success";
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
  CHALLENGE_TIMEOUT_MS       Wall-clock limit for Pi (default: 900000)
  RUN_EXPERIMENT / RUN_ARM / RUN_REP / RUN_INTERVENTION  Optional experiment metadata
  TEMPLATE_CSS_VOCABULARY     Enable CSS vocabulary overlay (0/1, default 0)
  TEMPLATE_PERSISTENCE        Enable persistence primitive overlay (0/1, default 0)
  TEMPLATE_TEST_ISOLATION     Enable test isolation overlay (0/1, default 0)
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

export function buildPiArguments(
  idea: string,
  systemPrompt: string,
  publicJourneys: string,
  appContext: string,
  artifactDirectory: string,
  options: { harnessOwnedVerify?: boolean } = {},
): string[] {
  const harnessConfig = resolveRunConfigFromEnvironment();
  if (options.harnessOwnedVerify !== undefined) {
    harnessConfig.harness_owned_verify = options.harnessOwnedVerify;
  }
  const rawAppend = buildAppendSystemPrompt(systemPrompt, publicJourneys, appContext);
  const bundle: ChallengePromptBundle = {
    idea: idea.trim(),
    sources: { systemPrompt, publicJourneys, agentsMd: appContext },
    raw_append_system_prompt: rawAppend,
    effective_append_system_prompt: rawAppend,
    effective_full_system_prompt: rawAppend,
    pi_builtin_system_prompt: "",
    user_message: buildProductIdeaUserMessage(idea),
  };
  return buildPiArgumentsFromBundle(bundle, artifactDirectory, REPOSITORY_ROOT, harnessConfig);
}

function timeoutFromEnvironment(): number {
  const raw = process.env.CHALLENGE_TIMEOUT_MS ?? "900000";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000) {
    throw new Error("CHALLENGE_TIMEOUT_MS must be an integer of at least 1000");
  }
  return value;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const idea = await readFile(args.ideaFile, "utf8");
  const overlayConfig = resolveTemplateOverlayConfigFromEnvironment();
  const { outputDirectory, assemblyRecord } = await prepareOutput(REPOSITORY_ROOT, args.outputDirectory);
  const templateOverlays = toTemplateOverlaysManifestBlock(assemblyRecord);
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

  const [systemPrompt, publicJourneys, appContext] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, "solution", "system-prompt.md"), "utf8"),
    readFile(path.join(REPOSITORY_ROOT, "contract-public", "journeys.md"), "utf8"),
    readFile(path.join(outputDirectory, "AGENTS.md"), "utf8"),
  ]);

  const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const artifactDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", runId);
  await mkdir(path.join(artifactDirectory, "sessions"), { recursive: true });
  process.env.CHALLENGE_RUN_ARTIFACT_DIR = artifactDirectory;
  await writeFile(path.join(artifactDirectory, "idea.txt"), idea, "utf8");
  await copyAppTemplateTree(
    outputDirectory,
    path.join(artifactDirectory, "app-template"),
    { writeMarker: false },
  );

  const runConfig = resolveRunConfigFromEnvironment();
  if (runConfig.harness_owned_verify) {
    process.env.HARNESS_OWNED_VERIFY = "1";
  }
  if (process.env.HARNESS_VERIFY_REPAIR_V1 === "1" || process.env.HARNESS_VERIFY_REPAIR_V1 === "true") {
    process.env.HARNESS_VERIFY_REPAIR_V1 = "1";
  }
  if (
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 === "1" ||
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 === "true"
  ) {
    process.env.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
  }
  if (process.env.HARNESS_EARLY_VERIFY_V1 === "1" || process.env.HARNESS_EARLY_VERIFY_V1 === "true") {
    process.env.HARNESS_EARLY_VERIFY_V1 = "1";
  }
  if (
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 === "1" ||
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 === "true"
  ) {
    process.env.HARNESS_OWNED_TEST_STRUCTURE_V1 = "1";
  }
  if (
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 === "1" ||
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 === "true"
  ) {
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = "1";
  }
  if (
    process.env.HARNESS_SCOPE_SEQUENCE_V1 === "1" ||
    process.env.HARNESS_SCOPE_SEQUENCE_V1 === "true"
  ) {
    process.env.HARNESS_SCOPE_SEQUENCE_V1 = "1";
  }
  process.env.TEMPLATE_CSS_VOCABULARY = cssVocabularyGuardsEnabled(overlayConfig) ? "1" : "0";

  const manifest = await buildPreRunManifest({
    runId,
    repositoryRoot: REPOSITORY_ROOT,
    ideaFile: args.ideaFile,
    ideaText: idea,
    templateSnapshotDirectory: path.join(artifactDirectory, "app-template"),
    templateOverlays,
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
  const pi = await runPi(
    buildPiArguments(idea, systemPrompt, publicJourneys, appContext, artifactDirectory, {
      harnessOwnedVerify: runConfig.harness_owned_verify,
    }),
    outputDirectory,
    eventFile,
    stderrFile,
    timeoutFromEnvironment(),
  );
  const wallMs = Date.now() - piStartedAt;
  const portReclamation = await auditAppPortAfterPi(APP_PORT, outputDirectory, appPortHadListenerBeforePi);
  if (portReclamation.listener_after_pi) {
    const message = `${portReclamation.diagnostic}; pids=${portReclamation.process_ids.join(",") || "none"}`;
    if (portReclamation.reclaimed) console.log(message);
    else console.warn(message);
  }

  const usage = collectUsageFromJsonLines(await readFile(eventFile, "utf8"));
  const partial = await readPartialResult(outputDirectory);
  const canVerifyApp = pi.exitCode === 0 && usage.model_calls > 0;
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
    verification = await verifyGeneratedApp(outputDirectory, artifactDirectory, { displayRoot: REPOSITORY_ROOT });
    result = composeResult(partial, usage, pi.exitCode, verification, portReclamation, startCommand);
    resultPaths = await writeResult(outputDirectory, result, [rootResultPath, artifactResultPath]);
  }
  const missingResultPaths = missingRequiredResultPaths(resultPaths, requiredResultPaths);
  await writeRunManifest(
    artifactDirectory,
    finalizeRunManifest(manifest, buildRunManifestOutcome(result, usage, wallMs)),
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
  if (pi.timedOut) console.error("Pi exceeded CHALLENGE_TIMEOUT_MS and was terminated.");
  if (runRequiresFailureExit(pi.exitCode, result.status, missingResultPaths)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
