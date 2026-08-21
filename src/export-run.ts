import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRun, writeAnalysis, type RunAnalysis } from "./analyze-run.js";
import type { RunResult, TestRun } from "./types.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");
const EXPORTS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "exports");

export const RUN_EXPORT_SCHEMA = "agentcofounder.run_export.v1" as const;

export interface RunExportMeta {
  run_id: string;
  recorded_at: string;
  git_branch: string | null;
  git_commit: string | null;
  approach: string | null;
  provider: string | null;
  model: string | null;
}

export interface RunExportHarness {
  status: string;
  summary: string;
  implemented_features: string[];
  assumptions: string[];
  tests_run: TestRun[];
  harness_checks: TestRun[];
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cost_total: number;
  pi_exit_code: number;
}

export interface RunExportEfficiency {
  weighted_total: number;
  wall_seconds: number;
  seconds_per_call: number | null;
  time_to_final_green_s: number | null;
  time_to_first_failing_test_s: number | null;
  npm_test_command_count: number;
  auto_test_trigger_hits: number;
  phase_heuristic: RunAnalysis["phase_heuristic"];
}

/** Paste contract for the runs UI. Human rating/comments are frontend-only — not in this file. */
export interface RunExport {
  schema: typeof RUN_EXPORT_SCHEMA;
  meta: RunExportMeta;
  harness: RunExportHarness;
  efficiency: RunExportEfficiency;
}

export interface ExportRunOptions {
  approach?: string | null;
  recordedAt?: string;
}

function gitValue(args: string[]): string | null {
  try {
    const value = execFileSync("git", args, {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function resolveGitMeta(): { git_branch: string | null; git_commit: string | null } {
  return {
    git_branch: gitValue(["branch", "--show-current"]),
    git_commit: gitValue(["rev-parse", "HEAD"]),
  };
}

export function buildRunExport(
  result: RunResult,
  analysis: RunAnalysis,
  options: ExportRunOptions & {
    git_branch?: string | null;
    git_commit?: string | null;
  } = {},
): RunExport {
  const gitBranch = options.git_branch !== undefined ? options.git_branch : resolveGitMeta().git_branch;
  const gitCommit = options.git_commit !== undefined ? options.git_commit : resolveGitMeta().git_commit;
  const approach =
    options.approach ??
    process.env.RUN_APPROACH ??
    gitBranch;

  return {
    schema: RUN_EXPORT_SCHEMA,
    meta: {
      run_id: analysis.run_id,
      recorded_at: options.recordedAt ?? new Date().toISOString(),
      git_branch: gitBranch,
      git_commit: gitCommit,
      approach,
      provider: analysis.provider,
      model: analysis.model,
    },
    harness: {
      status: result.status,
      summary: result.summary,
      implemented_features: result.implemented_features,
      assumptions: result.assumptions,
      tests_run: result.tests_run,
      harness_checks: result.harness_checks,
      model_calls: result.model_calls,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      cache_read_tokens: result.cache_read_tokens,
      cache_write_tokens: result.cache_write_tokens,
      total_tokens: result.total_tokens,
      reasoning_tokens: result.reasoning_tokens,
      cost_total: result.cost_total,
      pi_exit_code: result.pi_exit_code,
    },
    efficiency: {
      weighted_total: analysis.weighted_total,
      wall_seconds: analysis.wall_seconds,
      seconds_per_call: analysis.seconds_per_call,
      time_to_final_green_s: analysis.time_to_final_green_s,
      time_to_first_failing_test_s: analysis.time_to_first_failing_test_s,
      npm_test_command_count: analysis.npm_test_command_count,
      auto_test_trigger_hits: analysis.auto_test_trigger_hits,
      phase_heuristic: analysis.phase_heuristic,
    },
  };
}

export async function exportRun(runId: string, options: ExportRunOptions = {}): Promise<{
  exportPath: string;
  analysisPath: string;
  payload: RunExport;
}> {
  const resultPath = path.join(RUNS_DIRECTORY, runId, "result.json");
  const result = JSON.parse(await readFile(resultPath, "utf8")) as RunResult;
  const analysis = await analyzeRun(runId);
  const analysisPath = await writeAnalysis(analysis);
  const payload = buildRunExport(result, analysis, options);

  await mkdir(EXPORTS_DIRECTORY, { recursive: true });
  const exportPath = path.join(EXPORTS_DIRECTORY, `${runId}.json`);
  await writeFile(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { exportPath, analysisPath, payload };
}

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId || runId.startsWith("-")) {
    console.error("Usage: npm run export:run -- <run-id> [--approach <name>]");
    process.exitCode = 2;
    return;
  }

  let approach: string | null = null;
  for (let index = 3; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === "--approach") {
      approach = process.argv[index + 1] ?? null;
      index += 1;
    }
  }

  const { exportPath, payload } = await exportRun(runId, { approach });
  console.log(JSON.stringify(payload, null, 2));
  console.error(`\nWrote ${exportPath}`);
  console.error("Paste this JSON into the runs UI (ratings/comments are UI-only).");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
