/**
 * Recursive Harness Self-Improvement — development-only optimizer.
 * Production `npm run challenge` does not run this unless you pass RHI_HARNESS.
 *
 * Usage:
 *   npm run rhi -- --dump-baseline
 *   npm run rhi -- --from-run artifacts/runs/<id> --max-iterations 3
 *   npm run rhi -- --idea-file contract-public/development-idea.txt --max-iterations 2
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baselineHarness } from "../src/v2/rhi/baseline.js";
import { runRhiLoop, type AgentRunner } from "../src/v2/rhi/loop.js";
import { assertHarnessDocument } from "../src/v2/rhi/schema.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");

function printHelp(): void {
  console.log(`Usage: npm run rhi -- [options]

Recursive Harness Self-Improvement. Runs one agent execution per iteration,
compares against the previous output, and keeps the candidate only if it wins
the regression gate. The production challenge path does not include this loop.

Options:
  --dump-baseline           Write harness v0 JSON and exit (no model calls)
  --idea-file <path>        Task/idea file (default: contract-public/development-idea.txt)
  --from-run <dir>          Use an existing artifacts/runs/<id> as iteration 0
  --history-dir <path>      Preference history root (default: harness_history/<timestamp>)
  --max-iterations <n>      Optimizer iterations after the baseline (default: 3)
  --help
`);
}

interface CliOptions {
  dumpBaseline: boolean;
  ideaFile: string;
  fromRun?: string;
  historyDir?: string;
  maxIterations: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dumpBaseline: false,
    ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
    maxIterations: 3,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      printHelp();
      process.exit(0);
    }
    if (argument === "--dump-baseline") {
      options.dumpBaseline = true;
      continue;
    }
    if (argument === "--idea-file" || argument === "--from-run" || argument === "--history-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--idea-file") options.ideaFile = path.resolve(value);
      if (argument === "--from-run") options.fromRun = path.resolve(value);
      if (argument === "--history-dir") options.historyDir = path.resolve(value);
      continue;
    }
    if (argument === "--max-iterations") {
      const value = Number(argv[index + 1]);
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("max-iterations must be a positive integer");
      options.maxIterations = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

const challengeRunner: AgentRunner = async (input) => {
  const pointerDirectory = await mkdtemp(path.join(os.tmpdir(), "rhi-pointer-"));
  const pointer = path.join(pointerDirectory, "run-path.txt");
  const started = Date.now();
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      commandName("npm"),
      ["run", "challenge", "--", "--idea-file", input.ideaFile],
      {
        cwd: REPOSITORY_ROOT,
        env: { ...process.env, RHI_HARNESS: input.harnessPath, RHI_RUN_POINTER: pointer },
        stdio: "inherit",
        shell: false,
      },
    );
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  const artifactDirectory = (await readFile(pointer, "utf8")).trim();
  return {
    artifactDirectory,
    outputDirectory: path.join(REPOSITORY_ROOT, "output", "app"),
    wallMs: Date.now() - started,
    timedOut: exitCode === 124,
  };
};

function commandName(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.dumpBaseline) {
    const document = baselineHarness();
    assertHarnessDocument(document);
    console.log(JSON.stringify(document, null, 2));
    return;
  }

  const task = await readFile(options.ideaFile, "utf8");
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const historyRoot = options.historyDir ?? path.join(REPOSITORY_ROOT, "harness_history", stamp);
  const fromRun = options.fromRun
    ? {
        artifactDirectory: options.fromRun,
        outputDirectory: path.join(REPOSITORY_ROOT, "output", "app"),
        wallMs: 0,
      }
    : undefined;

  console.log(`RHI history: ${historyRoot}`);
  const result = await runRhiLoop({
    task,
    ideaFile: options.ideaFile,
    historyRoot,
    maxIterations: options.maxIterations,
    runner: challengeRunner,
    ...(fromRun ? { fromRun } : {}),
  });
  await writeFile(
    path.join(historyRoot, "README.txt"),
    [
      "Optimized harness for production:",
      `  export RHI_HARNESS=${result.optimized_harness_path}`,
      "  npm run challenge",
      "",
      "This directory is optimizer history. Do not load evaluator/optimizer into production.",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`Optimized harness: ${result.optimized_harness_path} (${result.optimized_harness.id})`);
  console.log(`Evaluations: ${result.evaluations.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
