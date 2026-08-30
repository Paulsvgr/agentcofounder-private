import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { RunStatus, RunSummary } from "./types.js";
import { MEGA_CALL_THRESHOLD } from "./types.js";
import { weightedCost } from "./weights.js";
import { resolveRunAppDirectory } from "./run-app.js";
import { resolveRunModel } from "./run-model-inference.js";
import {
  getRunOverlayFromFile,
  readOverlayFile,
  type RunOverlayEntry,
} from "./run-overlay.js";

const RUN_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

interface CallLogEntry {
  model?: string;
  output_tokens: number;
}

interface RunResultFile {
  status: RunStatus;
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  call_log?: CallLogEntry[];
}

interface ManifestModel {
  provider: string | null;
  model: string | null;
  thinking: string;
}

interface ManifestExperiment {
  cohort: string | null;
  arm: string | null;
  rep: number | null;
  intervention: string | null;
}

interface ManifestOutcome {
  status: RunStatus;
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  weighted_cost: number;
  wall_ms: number;
}

interface RunManifestFile {
  created_at: string;
  model: ManifestModel;
  config_hash: string;
  experiment: ManifestExperiment;
  outcome: ManifestOutcome | null;
}

function maxOutputFromCallLog(callLog: CallLogEntry[] | undefined): number | null {
  if (!callLog || callLog.length === 0) return null;
  return Math.max(...callLog.map((entry) => entry.output_tokens));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOptional<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function replayRootFromAnalysis(analysisRoot: string): string {
  return path.join(path.dirname(analysisRoot), "replay");
}

async function hasSessionLogs(runDir: string): Promise<boolean> {
  try {
    const names = await readdir(path.join(runDir, "sessions"));
    return names.some((name) => name.endsWith(".jsonl"));
  } catch {
    return false;
  }
}

interface ReplayReportFile {
  verdict?: "identical" | "diverged" | "unverified";
}

function applyOverlayToSummary(summary: RunSummary, overlay: RunOverlayEntry | null): RunSummary {
  if (!overlay) {
    return {
      ...summary,
      author: null,
      display_label: null,
      experiment_slug: null,
      app_rating: null,
      app_comment: null,
      run_comment: null,
      git_branch_overlay: null,
      has_overlay: false,
      exclude_from_ranking: false,
    };
  }
  return {
    ...summary,
    author: overlay.author,
    display_label: overlay.classification?.display_label ?? null,
    experiment_slug: overlay.classification?.experiment ?? null,
    app_rating: overlay.human.app_rating,
    app_comment: overlay.human.app_comment || null,
    run_comment: overlay.human.run_comment || null,
    git_branch_overlay: overlay.git_branch,
    has_overlay: true,
    exclude_from_ranking: overlay.flags.exclude_from_ranking,
  };
}

export async function summarizeRun(
  runsRoot: string,
  analysisRoot: string,
  runId: string,
  replayRoot?: string,
  overlayEntry?: RunOverlayEntry | null,
): Promise<RunSummary> {
  const runDir = path.join(runsRoot, runId);
  const resolvedReplayRoot = replayRoot ?? replayRootFromAnalysis(analysisRoot);
  const manifest = await readJsonOptional<RunManifestFile>(path.join(runDir, "run-manifest.json"));
  const result = await readJsonOptional<RunResultFile>(path.join(runDir, "result.json"));
  const hasAnalysis = await fileExists(path.join(analysisRoot, runId, "station.json"));
  const hasSessions = await hasSessionLogs(runDir);
  const hasEvents = await fileExists(path.join(runDir, "events.jsonl"));
  const canReplay = hasSessions || hasEvents;
  const repoRoot = path.resolve(runsRoot, "..", "..");
  const generatedAppPath = await resolveRunAppDirectory(repoRoot, runId);
  const replayReportPath = path.join(resolvedReplayRoot, runId, "report.json");
  const hasReplay = await fileExists(replayReportPath);
  const replayReport = hasReplay ? await readJsonOptional<ReplayReportFile>(replayReportPath) : null;

  const hasManifest = manifest !== null;
  const hasResult = result !== null;

  let status: RunStatus = "incomplete";
  let modelCalls: number | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cacheReadTokens: number | null = null;
  let weightedCostValue: number | null = null;
  let wallMs: number | null = null;
  let maxOutput: number | null = null;

  if (result) {
    status = result.status;
    modelCalls = result.model_calls;
    inputTokens = result.input_tokens;
    outputTokens = result.output_tokens;
    cacheReadTokens = result.cache_read_tokens;
    weightedCostValue = weightedCost({
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      cache_read_tokens: result.cache_read_tokens,
      cache_write_tokens: result.cache_write_tokens ?? 0,
    });
    maxOutput = maxOutputFromCallLog(result.call_log);
  } else if (manifest?.outcome) {
    const outcome = manifest.outcome;
    status = outcome.status;
    modelCalls = outcome.model_calls;
    inputTokens = outcome.input_tokens;
    outputTokens = outcome.output_tokens;
    cacheReadTokens = outcome.cache_read_tokens;
    weightedCostValue = outcome.weighted_cost;
    wallMs = outcome.wall_ms;
  }

  if (maxOutput === null && result?.call_log) {
    maxOutput = maxOutputFromCallLog(result.call_log);
  }

  const inferredModel = await resolveRunModel({
    manifestProvider: manifest?.model.provider,
    manifestModel: manifest?.model.model,
    callLog: result?.call_log,
    eventsPath: path.join(runDir, "events.jsonl"),
  });

  return applyOverlayToSummary(
    {
      run_id: runId,
      status,
      provider: inferredModel.provider,
      model: inferredModel.model,
      thinking: manifest?.model.thinking ?? null,
      model_calls: modelCalls,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      weighted_cost: weightedCostValue,
      wall_ms: wallMs,
      max_output_per_call: maxOutput,
      cohort: manifest?.experiment.cohort ?? null,
      arm: manifest?.experiment.arm ?? null,
      rep: manifest?.experiment.rep ?? null,
      intervention: manifest?.experiment.intervention ?? null,
      config_hash: manifest?.config_hash ?? null,
      has_manifest: hasManifest,
      has_result: hasResult,
      has_analysis: hasAnalysis,
      has_sessions: hasSessions,
      can_replay: canReplay,
      has_generated_app: generatedAppPath !== null,
      generated_app_path: generatedAppPath ? path.relative(repoRoot, generatedAppPath) : null,
      has_replay: hasReplay,
      replay_verdict: replayReport?.verdict ?? null,
      mega_call_flag: maxOutput !== null && maxOutput >= MEGA_CALL_THRESHOLD,
      created_at: manifest?.created_at ?? null,
      author: null,
      display_label: null,
      experiment_slug: null,
      app_rating: null,
      app_comment: null,
      run_comment: null,
      git_branch_overlay: null,
      has_overlay: false,
      exclude_from_ranking: false,
    },
    overlayEntry ?? null,
  );
}

export interface RunDetail {
  summary: RunSummary;
  manifest: RunManifestFile | null;
  result: RunResultFile | null;
  ledger: unknown | null;
  station: unknown | null;
  station_html_path: string | null;
  replay: unknown | null;
  replay_app_path: string | null;
  generated_app_path: string | null;
  overlay: RunOverlayEntry | null;
}

export async function loadRunDetail(
  runsRoot: string,
  analysisRoot: string,
  runId: string,
  replayRoot?: string,
  repoRoot?: string,
): Promise<RunDetail> {
  const resolvedRepoRoot = repoRoot ?? path.resolve(runsRoot, "..", "..");
  const overlayFile = await readOverlayFile(resolvedRepoRoot);
  const overlay = getRunOverlayFromFile(overlayFile, runId);
  const runDir = path.join(runsRoot, runId);
  const analysisDir = path.join(analysisRoot, runId);
  const resolvedReplayRoot = replayRoot ?? replayRootFromAnalysis(analysisRoot);
  const replayDir = path.join(resolvedReplayRoot, runId);
  const manifest = await readJsonOptional<RunManifestFile>(path.join(runDir, "run-manifest.json"));
  const result = await readJsonOptional<RunResultFile>(path.join(runDir, "result.json"));
  const ledger = await readJsonOptional<unknown>(path.join(analysisDir, "ledger.json"));
  const station = await readJsonOptional<unknown>(path.join(analysisDir, "station.json"));
  const stationHtmlPath = path.join(analysisDir, "station.html");
  const hasStationHtml = await fileExists(stationHtmlPath);
  const replay = await readJsonOptional<unknown>(path.join(replayDir, "report.json"));
  const replayAppDir = path.join(replayDir, "app");
  const hasReplayApp = await fileExists(path.join(replayAppDir, "package.json"));

  const summary = await summarizeRun(runsRoot, analysisRoot, runId, resolvedReplayRoot, overlay);

  return {
    summary,
    manifest,
    result,
    ledger,
    station,
    station_html_path: hasStationHtml ? stationHtmlPath : null,
    replay,
    replay_app_path: hasReplayApp ? path.join("artifacts", "replay", runId, "app") : null,
    generated_app_path: summary.generated_app_path,
    overlay,
  };
}

interface RunsCache {
  mtimeMs: number;
  runs: RunSummary[];
}

let cache: RunsCache | null = null;

async function runsDirectoryMtime(runsRoot: string): Promise<number> {
  try {
    const entries = await readdir(runsRoot, { withFileTypes: true });
    let max = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)) continue;
      const entryStat = await stat(path.join(runsRoot, entry.name));
      max = Math.max(max, entryStat.mtimeMs);
    }
    const rootStat = await stat(runsRoot);
    return Math.max(max, rootStat.mtimeMs);
  } catch {
    return 0;
  }
}

export async function listRunSummaries(
  runsRoot: string,
  analysisRoot: string,
  replayRoot?: string,
): Promise<RunSummary[]> {
  const mtimeMs = await runsDirectoryMtime(runsRoot);
  if (cache && cache.mtimeMs === mtimeMs) {
    return cache.runs;
  }

  const resolvedReplayRoot = replayRoot ?? replayRootFromAnalysis(analysisRoot);
  const resolvedRepoRoot = path.resolve(runsRoot, "..", "..");
  const overlayFile = await readOverlayFile(resolvedRepoRoot);
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isDirectory() && RUN_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const runs = await Promise.all(
    runIds.map((runId) =>
      summarizeRun(
        runsRoot,
        analysisRoot,
        runId,
        resolvedReplayRoot,
        getRunOverlayFromFile(overlayFile, runId),
      ),
    ),
  );
  cache = { mtimeMs, runs };
  return runs;
}

export function invalidateRunsCache(): void {
  cache = null;
}
