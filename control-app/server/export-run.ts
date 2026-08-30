import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveExperimentId } from "../../src/v2/experiment-metadata.js";
import type { RunSummary } from "./types.js";
import { getExperiment, titleFromExperimentId } from "./experiments.js";
import {
  getRunOverlayFromFile,
  readOverlayFile,
  type RunOverlayEntry,
  type RunOverlayClassification,
} from "./run-overlay.js";

type ActivityPhase =
  | "recon"
  | "source"
  | "css"
  | "test"
  | "build"
  | "finalize"
  | "repair"
  | "mixed"
  | "other";

type ExportPhase = "recon" | "build" | "test_debug" | "finalize" | "mixed" | "other";

type ActionStage =
  | "inspect"
  | "build_app"
  | "write_tests"
  | "diagnose"
  | "repair_loop"
  | "green_build"
  | "extra_verify"
  | "report_final";

interface ActivityBucket {
  activity: ActivityPhase;
  call_count: number;
  weighted_cost: number;
  share_of_total: number;
}

interface StationCallRow {
  index: number;
  activity: ActivityPhase;
  weighted_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  seconds_since_start: number | null;
}

interface StationReport {
  run_id: string;
  totals: {
    model_calls: number;
    weighted_total: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
  };
  activity_summary: ActivityBucket[];
  calls: StationCallRow[];
  verification?: {
    time_to_first_failing_test_s: number | null;
    npm_test_command_count: number;
  };
}

interface RunManifestFile {
  schema: string;
  run_id: string;
  created_at: string;
  git: { branch: string; commit: string; dirty: boolean };
  model: {
    provider: string;
    model: string;
    thinking: string;
  };
  config_hash: string;
  template: { id: string; tree_sha256: string };
  experiment: {
    id?: string | null;
    cohort?: string | null;
    arm: string | null;
    rep: number | null;
    intervention: string | null;
  };
  outcome: {
    status: string;
    pi_exit_code: number;
    model_calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    weighted_cost: number;
    wall_ms: number;
  } | null;
}

interface RunResultFile {
  status: string;
  summary: string;
  implemented_features: string[];
  assumptions: string[];
  tests_run: Array<{ command: string; journey: string; result: "passed" | "failed" }>;
  harness_checks: Array<{ command: string; journey: string; result: "passed" | "failed" }>;
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

export interface RunExportV2 {
  schema: "agentcofounder.run_export.v2";
  meta: {
    run_id: string;
    recorded_at: string;
    git_branch: string | null;
    git_commit: string | null;
    approach: string | null;
    provider: string | null;
    model: string | null;
    classification?: {
      line: string;
      experiment: string;
      run_index: number | null;
      display_label: string;
      legacy_approach: string;
    };
  };
  harness: {
    status: string;
    summary: string;
    implemented_features: string[];
    assumptions: string[];
    tests_run: RunResultFile["tests_run"];
    harness_checks: RunResultFile["harness_checks"];
    model_calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
    cost_total: number;
    pi_exit_code: number;
  };
  efficiency: {
    weighted_total: number;
    wall_seconds: number | null;
    seconds_per_call: number | null;
    action_flow_source: "derived";
    action_flow: Array<{
      stage: ActionStage;
      call_count: number;
      call_indexes: number[];
      wall_seconds: number;
      raw_tokens: number;
      weighted_tokens: number;
      note: string | null;
    }>;
    phase_heuristic: Array<{
      phase: ExportPhase;
      call_count: number;
      weighted_cost: number;
      share_of_total: number;
    }>;
    time_to_first_failing_test_s: number | null;
    time_to_final_green_s: number | null;
    npm_test_command_count: number | null;
    auto_test_trigger_hits: number | null;
  };
}

export interface HackathonRunRecord {
  id: string;
  created_at: string;
  updated_at: string;
  person: string;
  data: {
    run_id: string;
    git_branch: string | null;
    git_commit: string | null;
    approach_kind: string | null;
    app_rating: number | null;
    app_comment: string;
    run_comment: string;
    classification?: NonNullable<RunExportV2["meta"]["classification"]>;
    human?: {
      app_rating: number | null;
      app_comment: string;
      run_comment: string;
    };
    flags?: {
      exclude_from_ranking: boolean;
      hide_early_smoke?: boolean;
      include_in_efficiency_compare?: boolean;
    };
    export: RunExportV2;
    manifest: RunManifestFile | null;
  };
}

async function readJsonOptional<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function mapActivityToPhase(activity: ActivityPhase): ExportPhase {
  switch (activity) {
    case "recon":
      return "recon";
    case "source":
    case "css":
    case "build":
      return "build";
    case "test":
    case "repair":
      return "test_debug";
    case "finalize":
      return "finalize";
    case "mixed":
      return "mixed";
    case "other":
      return "other";
    default: {
      const _never: never = activity;
      return _never;
    }
  }
}

function mapActivityToStage(activity: ActivityPhase): ActionStage {
  switch (activity) {
    case "recon":
      return "inspect";
    case "source":
    case "css":
      return "build_app";
    case "test":
      return "write_tests";
    case "repair":
      return "repair_loop";
    case "build":
      return "green_build";
    case "finalize":
      return "report_final";
    case "mixed":
      return "build_app";
    case "other":
      return "inspect";
    default: {
      const _never: never = activity;
      return _never;
    }
  }
}

function buildPhaseHeuristic(summary: ActivityBucket[]): RunExportV2["efficiency"]["phase_heuristic"] {
  const totals = new Map<ExportPhase, { call_count: number; weighted_cost: number }>();
  for (const bucket of summary) {
    const phase = mapActivityToPhase(bucket.activity);
    const current = totals.get(phase) ?? { call_count: 0, weighted_cost: 0 };
    current.call_count += bucket.call_count;
    current.weighted_cost += bucket.weighted_cost;
    totals.set(phase, current);
  }
  const weightedTotal = [...totals.values()].reduce((sum, bucket) => sum + bucket.weighted_cost, 0) || 1;
  return [...totals.entries()]
    .map(([phase, bucket]) => ({
      phase,
      call_count: bucket.call_count,
      weighted_cost: bucket.weighted_cost,
      share_of_total: bucket.weighted_cost / weightedTotal,
    }))
    .sort((left, right) => right.weighted_cost - left.weighted_cost);
}

function buildActionFlow(calls: StationCallRow[]): RunExportV2["efficiency"]["action_flow"] {
  if (calls.length === 0) return [];

  const segments: RunExportV2["efficiency"]["action_flow"] = [];
  let currentStage = mapActivityToStage(calls[0]!.activity);
  let segmentCalls: StationCallRow[] = [calls[0]!];

  const flush = (): void => {
    if (segmentCalls.length === 0) return;
    const first = segmentCalls[0]!;
    const last = segmentCalls.at(-1)!;
    const wallSeconds =
      first.seconds_since_start !== null && last.seconds_since_start !== null
        ? Math.max(0, last.seconds_since_start - first.seconds_since_start)
        : segmentCalls.length;
    segments.push({
      stage: currentStage,
      call_count: segmentCalls.length,
      call_indexes: segmentCalls.map((call) => call.index - 1),
      wall_seconds: wallSeconds,
      raw_tokens: segmentCalls.reduce(
        (sum, call) => sum + call.input_tokens + call.output_tokens,
        0,
      ),
      weighted_tokens: segmentCalls.reduce((sum, call) => sum + call.weighted_cost, 0),
      note: null,
    });
  };

  for (let index = 1; index < calls.length; index += 1) {
    const call = calls[index]!;
    const stage = mapActivityToStage(call.activity);
    if (stage !== currentStage) {
      flush();
      currentStage = stage;
      segmentCalls = [];
    }
    segmentCalls.push(call);
  }
  flush();
  return segments;
}

async function runDirectoryExists(runDir: string): Promise<boolean> {
  try {
    await access(runDir);
    return true;
  } catch {
    return false;
  }
}

function runIdToRecordedAt(runId: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(runId);
  if (!match) return new Date().toISOString();
  const [, date, hours, minutes, seconds, millis] = match;
  return `${date}T${hours}:${minutes}:${seconds}.${millis}Z`;
}

function buildApproachLabel(manifest: RunManifestFile | null, summary?: RunSummary): string {
  const experiment = manifest?.experiment;
  const experimentId = resolveExperimentId(experiment ?? null) ?? summary?.experiment_id ?? null;
  if (experimentId && experiment?.arm) {
    const rep = experiment.rep !== null && experiment.rep !== undefined ? `-${experiment.rep}` : "";
    return `${experimentId}/${experiment.arm}${rep}`;
  }
  if (experimentId && summary?.arm) {
    const rep = summary.rep !== null && summary.rep !== undefined ? `-${summary.rep}` : "";
    return `${experimentId}/${summary.arm}${rep}`;
  }
  if (experiment?.intervention) return experiment.intervention;
  if (summary?.intervention) return summary.intervention;
  return manifest?.template.id ?? "local";
}

function experimentSlugLabel(slug: string): string {
  return slug.replace(/-/g, " ");
}

function buildClassificationFromManifest(manifest: RunManifestFile, approach: string) {
  const experiment = resolveExperimentId(manifest.experiment) ?? manifest.experiment.intervention ?? "unknown";
  const arm = manifest.experiment.arm ?? "unknown";
  return {
    line: "unknown" as const,
    experiment,
    run_index: manifest.experiment.rep ?? null,
    display_label: `${arm} · ${experiment}${manifest.experiment.rep ? ` · rep ${manifest.experiment.rep}` : ""}`,
    legacy_approach: approach,
  };
}

async function buildDisplayLabelFromOverlay(
  repoRoot: string,
  overlay: RunOverlayEntry,
  cls: RunOverlayClassification,
): Promise<string> {
  if (cls.display_label.trim()) return cls.display_label.trim();

  const slug = overlay.experiment_id ?? cls.experiment;
  const experimentRecord =
    slug && slug !== "unknown" ? await getExperiment(repoRoot, slug) : null;
  const experimentPart = experimentRecord?.title ?? experimentSlugLabel(slug || "unknown");
  const parts: string[] = [];
  if (cls.line && cls.line !== "unknown") parts.push(cls.line);
  parts.push(experimentPart);
  if (cls.run_index !== null) parts.push(`run ${cls.run_index}`);
  return parts.join(" · ");
}

async function resolveExportClassification(
  repoRoot: string,
  overlay: RunOverlayEntry | null,
  manifest: RunManifestFile | null,
  approach: string,
): Promise<RunExportV2["meta"]["classification"] | undefined> {
  if (overlay?.classification) {
    const cls = overlay.classification;
    const experiment = overlay.experiment_id ?? cls.experiment;
    return {
      line: cls.line,
      experiment,
      run_index: cls.run_index,
      display_label: await buildDisplayLabelFromOverlay(repoRoot, overlay, cls),
      legacy_approach: cls.legacy_approach ?? approach,
    };
  }

  if (overlay?.experiment_id) {
    const experimentRecord = await getExperiment(repoRoot, overlay.experiment_id);
    const title = experimentRecord?.title ?? titleFromExperimentId(overlay.experiment_id);
    const runIndex = manifest?.experiment.rep ?? null;
    const displayLabel = runIndex !== null ? `${title} · run ${runIndex}` : title;
    return {
      line: "unknown",
      experiment: overlay.experiment_id,
      run_index: runIndex,
      display_label: displayLabel,
      legacy_approach: approach,
    };
  }

  if (manifest) {
    return buildClassificationFromManifest(manifest, approach);
  }

  return undefined;
}

function repoRootFromRunsRoot(runsRoot: string): string {
  return path.resolve(runsRoot, "..", "..");
}

export async function buildRunExportFromArtifacts(
  runsRoot: string,
  analysisRoot: string,
  runId: string,
  summary?: RunSummary,
  overlayEntry?: RunOverlayEntry | null,
): Promise<{ export: RunExportV2; manifest: RunManifestFile | null }> {
  const runDir = path.join(runsRoot, runId);
  if (!(await runDirectoryExists(runDir))) {
    throw new Error(`Run directory not found: ${runId}`);
  }

  const manifest = await readJsonOptional<RunManifestFile>(path.join(runDir, "run-manifest.json"));
  const result = await readJsonOptional<RunResultFile>(path.join(runDir, "result.json"));
  const station = await readJsonOptional<StationReport>(path.join(analysisRoot, runId, "station.json"));
  const hasEvents = await runDirectoryExists(path.join(runDir, "events.jsonl"));

  const approach = buildApproachLabel(manifest, summary);
  const status =
    summary?.status ??
    result?.status ??
    manifest?.outcome?.status ??
    (hasEvents ? "incomplete" : "unknown");
  const modelCalls =
    station?.totals.model_calls ??
    summary?.model_calls ??
    result?.model_calls ??
    manifest?.outcome?.model_calls ??
    0;
  const inputTokens =
    station?.totals.input_tokens ??
    summary?.input_tokens ??
    result?.input_tokens ??
    manifest?.outcome?.input_tokens ??
    0;
  const outputTokens =
    station?.totals.output_tokens ??
    summary?.output_tokens ??
    result?.output_tokens ??
    manifest?.outcome?.output_tokens ??
    0;
  const cacheReadTokens =
    station?.totals.cache_read_tokens ??
    summary?.cache_read_tokens ??
    result?.cache_read_tokens ??
    manifest?.outcome?.cache_read_tokens ??
    0;
  const cacheWriteTokens = result?.cache_write_tokens ?? manifest?.outcome?.cache_write_tokens ?? 0;
  const weightedTotal =
    station?.totals.weighted_total ??
    summary?.weighted_cost ??
    manifest?.outcome?.weighted_cost ??
    0;
  const wallMs = summary?.wall_ms ?? manifest?.outcome?.wall_ms ?? null;
  const wallSeconds = wallMs !== null ? wallMs / 1000 : null;
  const activitySummary = station?.activity_summary ?? [];
  const calls = station?.calls ?? [];

  const repoRoot = repoRootFromRunsRoot(runsRoot);
  const overlay =
    overlayEntry !== undefined
      ? overlayEntry
      : getRunOverlayFromFile(await readOverlayFile(repoRoot), runId);

  const meta: RunExportV2["meta"] = {
    run_id: runId,
    recorded_at: manifest?.created_at ?? summary?.created_at ?? runIdToRecordedAt(runId),
    git_branch: overlay?.git_branch ?? manifest?.git.branch ?? null,
    git_commit: overlay?.git_commit ?? manifest?.git.commit ?? null,
    approach,
    provider: manifest?.model.provider ?? summary?.provider ?? null,
    model: manifest?.model.model ?? summary?.model ?? null,
  };
  const classification = await resolveExportClassification(repoRoot, overlay, manifest, approach);
  if (classification) {
    meta.classification = classification;
  }

  const exportDoc: RunExportV2 = {
    schema: "agentcofounder.run_export.v2",
    meta,
    harness: {
      status,
      summary: result?.summary ?? `${status} run ${runId}`,
      implemented_features: result?.implemented_features ?? [],
      assumptions: result?.assumptions ?? [],
      tests_run: result?.tests_run ?? [],
      harness_checks: result?.harness_checks ?? [],
      model_calls: modelCalls,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      total_tokens: result?.total_tokens ?? inputTokens + outputTokens,
      reasoning_tokens: result?.reasoning_tokens ?? 0,
      cost_total: result?.cost_total ?? 0,
      pi_exit_code: result?.pi_exit_code ?? manifest?.outcome?.pi_exit_code ?? 1,
    },
    efficiency: {
      weighted_total: weightedTotal,
      wall_seconds: wallSeconds,
      seconds_per_call: wallSeconds !== null && modelCalls > 0 ? wallSeconds / modelCalls : null,
      action_flow_source: "derived",
      action_flow: buildActionFlow(calls),
      phase_heuristic: buildPhaseHeuristic(activitySummary),
      time_to_first_failing_test_s: station?.verification?.time_to_first_failing_test_s ?? null,
      time_to_final_green_s: null,
      npm_test_command_count:
        station?.verification?.npm_test_command_count ??
        activitySummary.find((bucket) => bucket.activity === "test")?.call_count ??
        null,
      auto_test_trigger_hits: null,
    },
  };

  return { export: exportDoc, manifest };
}

export async function buildHackathonRunRecord(
  runsRoot: string,
  analysisRoot: string,
  runId: string,
  summary?: RunSummary,
): Promise<HackathonRunRecord> {
  const repoRoot = repoRootFromRunsRoot(runsRoot);
  const overlay = getRunOverlayFromFile(await readOverlayFile(repoRoot), runId);
  const built = await buildRunExportFromArtifacts(
    runsRoot,
    analysisRoot,
    runId,
    summary,
    overlay,
  );
  const createdAt = built.manifest?.created_at ?? summary?.created_at ?? runIdToRecordedAt(runId);
  const human = overlay?.human ?? { app_rating: null, app_comment: "", run_comment: "" };
  const person = overlay?.author?.trim() || "local";

  const data: HackathonRunRecord["data"] = {
    run_id: runId,
    git_branch: built.export.meta.git_branch,
    git_commit: built.export.meta.git_commit,
    approach_kind: built.export.meta.approach,
    app_rating: human.app_rating,
    app_comment: human.app_comment,
    run_comment: human.run_comment,
    export: built.export,
    manifest: built.manifest,
  };

  if (built.export.meta.classification) {
    data.classification = built.export.meta.classification;
  }
  if (overlay) {
    data.human = {
      app_rating: human.app_rating,
      app_comment: human.app_comment,
      run_comment: human.run_comment,
    };
    data.flags = {
      exclude_from_ranking: overlay.flags.exclude_from_ranking,
      include_in_efficiency_compare: overlay.flags.include_in_efficiency_compare ?? true,
      ...(overlay.flags.hide_early_smoke !== undefined
        ? { hide_early_smoke: overlay.flags.hide_early_smoke }
        : {}),
    };
  }

  return {
    id: runId,
    created_at: createdAt,
    updated_at: createdAt,
    person,
    data,
  };
}
