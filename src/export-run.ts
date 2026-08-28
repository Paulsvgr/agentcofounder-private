import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ActionSegment } from "./action-flow.js";
import { analyzeRun, writeAnalysis, type RunAnalysis } from "./analyze-run.js";
import {
  classificationFromEnv,
  type RunClassification,
} from "./run-classification.js";
import { loadRunManifestForExport, type RunManifest } from "./run-manifest.js";
import type { RunResult, TestRun } from "./types.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");
const EXPORTS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "exports");
const SAVED_APPS_DIRECTORY = path.join(REPOSITORY_ROOT, "saved-apps");

export const RUN_EXPORT_SCHEMA_V1 = "agentcofounder.run_export.v1" as const;
export const RUN_EXPORT_SCHEMA = "agentcofounder.run_export.v2" as const;

export interface RunExportMeta {
  run_id: string;
  recorded_at: string;
  git_branch: string | null;
  git_commit: string | null;
  /** Legacy label; prefer meta.classification.display_label in the UI. */
  approach: string | null;
  classification: RunClassification;
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

export interface RunExportEfficiencyV2 {
  weighted_total: number;
  wall_seconds: number;
  seconds_per_call: number | null;
  first_test_failure_s: number | null;
  first_green_s: number | null;
  last_green_s: number | null;
  green_to_exit_s: number | null;
  manual_test_calls: number;
  full_suite_test_calls: number;
  manual_build_calls: number;
  test_reinspection_calls: number;
  same_generation_test_reruns: number;
  same_generation_full_suite_reruns: number;
  same_generation_partial_suite_reruns: number;
  first_failure_tool_output_chars: number | null;
  next_call_input_tokens_after_failure: number | null;
  post_failure_input_tokens: number;
  post_failure_cache_read_tokens: number;
  post_green_verification_calls: number;
  multiple_element_failures_total: number;
  rtl_dom_leak_failures: number;
  query_ambiguity_failures: number;
  harness_green_but_no_first_green: boolean;
  auto_test_candidate_events: number;
  auto_test_actual_runs: number;
  action_flow: ActionSegment[];
  action_flow_source: "derived" | "derived+override";
  /** Heuristic per-call rollup — not the action-flow movie. */
  phase_heuristic: RunAnalysis["phase_heuristic"];
  /** @deprecated v1 alias for first_test_failure_s */
  time_to_first_failing_test_s: number | null;
  /** @deprecated v1 alias for last_green_s */
  time_to_final_green_s: number | null;
  /** @deprecated v1 alias for manual_test_calls */
  npm_test_command_count: number;
  /** @deprecated v1 alias for auto_test_candidate_events */
  auto_test_trigger_hits: number;
}

/** Measurement paste body — meta, harness, efficiency only. */
export interface RunExportBody {
  schema: typeof RUN_EXPORT_SCHEMA;
  meta: RunExportMeta;
  harness: RunExportHarness;
  efficiency: RunExportEfficiencyV2;
}

/** Paste contract for the runs UI. Human rating/comments are frontend-only — not in this file. */
export interface RunExport extends RunExportBody {
  /** V2 provenance transport field; Django stores as data.manifest sibling. */
  manifest: RunManifest | null;
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function synthesizeResultFromAnalysis(analysis: RunAnalysis): RunResult {
  const status =
    analysis.status === "success" || analysis.status === "partial" || analysis.status === "failed"
      ? analysis.status
      : "partial";

  return {
    status,
    app_url: "http://localhost:3000",
    start_command: "npm run dev",
    summary: "",
    implemented_features: [],
    assumptions: [],
    tests_run: [],
    harness_checks: [],
    model_calls: analysis.model_calls,
    input_tokens: analysis.input_tokens,
    output_tokens: analysis.output_tokens,
    cache_read_tokens: analysis.cache_read_tokens,
    cache_write_tokens: analysis.cache_write_tokens,
    total_tokens: analysis.total_tokens,
    reasoning_tokens: analysis.reasoning_tokens,
    cost_total: 0,
    call_log: [],
    pi_exit_code: 0,
    telemetry_source: "pi-json-event-stream",
    port_reclamation: {
      preexisting_listener: false,
      listener_after_pi: false,
      attempted: false,
      reclaimed: false,
      process_ids: [],
      diagnostic: "synthesized-from-analysis",
    },
  };
}

async function loadResultForRun(runId: string, analysis: RunAnalysis): Promise<RunResult> {
  const inRun = path.join(RUNS_DIRECTORY, runId, "result.json");
  if (await pathExists(inRun)) {
    return JSON.parse(await readFile(inRun, "utf8")) as RunResult;
  }

  if (await pathExists(SAVED_APPS_DIRECTORY)) {
    const entries = await readdir(SAVED_APPS_DIRECTORY, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.includes(runId)) continue;
      const candidate = path.join(SAVED_APPS_DIRECTORY, entry.name, "result.json");
      if (await pathExists(candidate)) {
        return JSON.parse(await readFile(candidate, "utf8")) as RunResult;
      }
    }
  }

  return synthesizeResultFromAnalysis(analysis);
}

export function buildRunExport(
  result: RunResult,
  analysis: RunAnalysis,
  options: ExportRunOptions & {
    git_branch?: string | null;
    git_commit?: string | null;
  } = {},
): RunExportBody {
  const gitBranch = options.git_branch !== undefined ? options.git_branch : resolveGitMeta().git_branch;
  const gitCommit = options.git_commit !== undefined ? options.git_commit : resolveGitMeta().git_commit;
  const approach =
    options.approach ??
    process.env.RUN_APPROACH ??
    gitBranch;

  const classification = classificationFromEnv(approach, gitBranch, gitCommit);

  return {
    schema: RUN_EXPORT_SCHEMA,
    meta: {
      run_id: analysis.run_id,
      recorded_at: options.recordedAt ?? new Date().toISOString(),
      git_branch: gitBranch,
      git_commit: gitCommit,
      approach,
      classification,
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
      first_test_failure_s: analysis.first_test_failure_s,
      first_green_s: analysis.first_green_s,
      last_green_s: analysis.last_green_s,
      green_to_exit_s: analysis.green_to_exit_s,
      manual_test_calls: analysis.manual_test_calls,
      full_suite_test_calls: analysis.full_suite_test_calls,
      manual_build_calls: analysis.manual_build_calls,
      test_reinspection_calls: analysis.test_reinspection_calls,
      same_generation_test_reruns: analysis.same_generation_test_reruns,
      same_generation_full_suite_reruns: analysis.same_generation_full_suite_reruns,
      same_generation_partial_suite_reruns: analysis.same_generation_partial_suite_reruns,
      first_failure_tool_output_chars: analysis.first_failure_tool_output_chars,
      next_call_input_tokens_after_failure: analysis.next_call_input_tokens_after_failure,
      post_failure_input_tokens: analysis.post_failure_input_tokens,
      post_failure_cache_read_tokens: analysis.post_failure_cache_read_tokens,
      post_green_verification_calls: analysis.post_green_verification_calls,
      multiple_element_failures_total: analysis.multiple_element_failures_total,
      rtl_dom_leak_failures: analysis.rtl_dom_leak_failures,
      query_ambiguity_failures: analysis.query_ambiguity_failures,
      harness_green_but_no_first_green: analysis.harness_green_but_no_first_green,
      auto_test_candidate_events: analysis.auto_test_candidate_events,
      auto_test_actual_runs: analysis.auto_test_actual_runs,
      action_flow: analysis.action_flow,
      action_flow_source: analysis.action_flow_source,
      phase_heuristic: analysis.phase_heuristic,
      time_to_first_failing_test_s: analysis.first_test_failure_s,
      time_to_final_green_s: analysis.last_green_s,
      npm_test_command_count: analysis.manual_test_calls,
      auto_test_trigger_hits: analysis.auto_test_candidate_events,
    },
  };
}

export async function exportRun(runId: string, options: ExportRunOptions = {}): Promise<{
  exportPath: string;
  analysisPath: string;
  payload: RunExport;
}> {
  const analysis = await analyzeRun(runId);
  const result = await loadResultForRun(runId, analysis);
  const analysisPath = await writeAnalysis(analysis);
  const exportBody = buildRunExport(result, analysis, options);
  const manifest = await loadRunManifestForExport(RUNS_DIRECTORY, runId);
  const payload: RunExport = { ...exportBody, manifest };

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
