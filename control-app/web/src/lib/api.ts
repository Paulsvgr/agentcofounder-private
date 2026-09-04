import type { HackathonRunRecord } from "../types/runExport.js";
import type { AppRubricScores } from "../../../shared/app-rubric.js";

export type RunStatus = "success" | "partial" | "failed" | "incomplete";

export interface RunSummary {
  run_id: string;
  status: RunStatus;
  provider: string | null;
  model: string | null;
  thinking: string | null;
  model_calls: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  weighted_cost: number | null;
  wall_ms: number | null;
  max_output_per_call: number | null;
  experiment_id: string | null;
  arm: string | null;
  rep: number | null;
  intervention: string | null;
  config_hash: string | null;
  has_manifest: boolean;
  has_result: boolean;
  has_analysis: boolean;
  has_sessions: boolean;
  can_replay: boolean;
  has_generated_app: boolean;
  generated_app_path: string | null;
  has_replay: boolean;
  replay_verdict: ReplayVerdict | null;
  mega_call_flag: boolean;
  created_at: string | null;
  author: string | null;
  display_label: string | null;
  experiment_slug: string | null;
  app_rubric: AppRubricScores | null;
  app_rating: number | null;
  app_comment: string | null;
  run_comment: string | null;
  git_branch_overlay: string | null;
  has_overlay: boolean;
  exclude_from_ranking: boolean;
}

export interface EnvProfile {
  id: string;
  path: string;
  label: string;
  is_default: boolean;
}

export interface ChallengeLaunchRequest {
  env_profile: string;
  provider?: string;
  model?: string;
  thinking?: string;
  timeout_ms?: number;
  experiment_id?: string;
  arm?: string;
  rep?: number;
  intervention?: string;
  idea_file?: string;
  /** Explicit HARNESS_* / TEMPLATE_* exports applied after sourcing the env profile. */
  env_overrides?: Record<string, string>;
}

export type ReplayVerdict = "identical" | "diverged" | "unverified";

export interface ReplayReport {
  run_id: string;
  verdict: ReplayVerdict;
  warnings: string[];
  replay_dir: string;
  writes_replayed: number;
  edits_replayed: number;
  failures: Array<{ kind: string; path: string; message: string }>;
  test: { ok: boolean } | null;
  build: { ok: boolean } | null;
  compare: {
    matches: boolean;
    files_compared: number;
    mismatched: string[];
    missing_in_replay: string[];
    extra_in_replay: string[];
  } | null;
}

export type JobKind = "analyze" | "reconcile" | "replay" | "challenge" | "app-dev";
export type JobStatus = "running" | "succeeded" | "failed" | "timed_out" | "stopped";

export interface JobRecord {
  id: string;
  kind: JobKind;
  run_id: string | null;
  status: JobStatus;
  exit_code: number | null;
  lines: string[];
  started_at: string;
  finished_at: string | null;
  detected_run_id: string | null;
}

export interface HarnessBoardFlag {
  key: string;
  label: string;
  decision: "KEEP" | "PARKED" | "OFF" | "BASELINE";
  defaultValue: "0" | "1";
  launchToggle: boolean;
  note: string;
}

export interface HarnessBoardResponse {
  flags: HarnessBoardFlag[];
  defaults: Record<string, string>;
}

export interface RunDetail {
  summary: RunSummary;
  manifest: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  ledger: Record<string, unknown> | null;
  station: Record<string, unknown> | null;
  station_html_path: string | null;
  replay: ReplayReport | null;
  replay_app_path: string | null;
  generated_app_path: string | null;
  overlay: RunOverlayEntry | null;
}

export interface RunOverlayClassification {
  line: string;
  experiment: string;
  run_index: number | null;
  display_label: string;
  legacy_approach?: string | null;
}

export interface RunOverlayHuman {
  app_rubric: AppRubricScores | null;
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
}

export interface RunOverlayFlags {
  exclude_from_ranking: boolean;
  hide_early_smoke?: boolean;
  include_in_efficiency_compare?: boolean;
}

export interface RunOverlayEntry {
  author: string | null;
  git_branch: string | null;
  git_commit: string | null;
  experiment_id: string | null;
  classification: RunOverlayClassification | null;
  human: RunOverlayHuman;
  flags: RunOverlayFlags;
  updated_at: string;
}

export interface OverlayTaxonomy {
  line: string[];
  experiment: string[];
}

export type ExperimentStatus = "active" | "archived";

export interface ExperimentSummary {
  id: string;
  title: string;
  description: string;
  status: ExperimentStatus;
  created_at: string;
  updated_at: string;
}

export type ExperimentSource = "catalog" | "used-only" | "both";

export interface ExperimentListEntry extends ExperimentSummary {
  has_catalog: boolean;
  source: ExperimentSource;
  run_count: number;
}

export interface ExperimentRecord extends ExperimentSummary {
  schema: string;
  arms: string[];
  tags: string[];
  created_by: string | null;
}

export interface CreateExperimentRequest {
  id: string;
  title?: string;
  description?: string;
  status?: ExperimentStatus;
  arms?: string[];
  tags?: string[];
  created_by?: string | null;
}

export interface PatchExperimentRequest {
  title?: string;
  description?: string;
  status?: ExperimentStatus;
  arms?: string[];
  tags?: string[];
}

export interface ExperimentDetailResponse {
  experiment: ExperimentRecord;
  list: ExperimentListEntry;
  run_ids: string[];
}

export interface RunOverlayPatch {
  author?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  experiment_id?: string | null;
  classification?: Partial<RunOverlayClassification> | null;
  human?: Partial<RunOverlayHuman>;
  flags?: Partial<RunOverlayFlags>;
}

export interface OpenRunAppResult {
  url: string;
  port: number;
  app_path: string;
  built_from_logs: boolean;
  job_id: string;
}

export interface RunAppStatus {
  running: boolean;
  url?: string;
  port?: number;
  app_path?: string | null;
  job_id?: string;
}

export interface ActivityBucket {
  activity: string;
  call_count: number;
  weighted_cost: number;
  share_of_total: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  input_share?: number;
  output_share?: number;
  cache_read_share?: number;
}

export interface StationTotals {
  model_calls: number;
  weighted_total: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export interface StationCallRow {
  index: number;
  turn: number;
  activity: string;
  weighted_cost: number;
  cumulative_weighted: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  seconds_since_start: number | null;
  tools: Array<{ name: string; detail: string; is_error?: boolean; output?: string | null }>;
}

export interface StationCumulativePoint {
  call_index: number;
  seconds_since_start: number | null;
  cumulative_weighted: number;
}

export interface StationActivityDelta {
  activity: string;
  weighted_delta: number;
  call_delta: number;
  primary_share: number;
  compare_share: number;
}

export interface StationCompareBlock {
  run_id: string;
  reconciliation_ok: boolean;
  totals: StationTotals;
  activity_summary: ActivityBucket[];
  activity_deltas: StationActivityDelta[];
  manifest?: Record<string, unknown> | null;
}

export interface StationReport {
  schema: string;
  generated_at: string;
  run_id: string;
  classifier_version: string;
  reconciliation_ok: boolean;
  totals: StationTotals;
  activity_summary: ActivityBucket[];
  cumulative_series: StationCumulativePoint[];
  calls: StationCallRow[];
  manifest: Record<string, unknown> | null;
  verification?: StationVerification;
  compare?: StationCompareBlock;
}

export interface StationTestRow {
  command: string;
  journey: string;
  result: "passed" | "failed";
  detail?: string | null;
}

export interface AgentToolErrorRow {
  call_index: number;
  tool_name: string;
  detail: string;
  seconds_since_start: number | null;
}

export interface StationVerification {
  status: "success" | "partial" | "failed" | "unknown";
  pi_exit_code: number | null;
  summary: string | null;
  source: "result.json" | "manifest.outcome" | "ledger_only";
  tests_run: StationTestRow[];
  harness_checks: StationTestRow[];
  tests_passed: number;
  tests_failed: number;
  harness_passed: number;
  harness_failed: number;
  all_journeys_passed: boolean | null;
  all_harness_passed: boolean | null;
  error_tool_count: number;
  error_call_count: number;
  repair_call_count: number;
  first_error_call_index: number | null;
  first_error_seconds: number | null;
  npm_test_command_count: number;
  npm_test_error_count: number;
  time_to_first_failing_test_s: number | null;
  agent_tool_errors?: AgentToolErrorRow[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchRuns(): Promise<{ runs: RunSummary[] }> {
  return request("/api/runs");
}

export function listRuns(): Promise<HackathonRunRecord[]> {
  return request<{ runs: HackathonRunRecord[] }>("/api/hackathon/runs").then((body) => body.runs);
}

export function fetchRunDetail(runId: string): Promise<RunDetail> {
  return request(`/api/runs/${encodeURIComponent(runId)}`);
}

export function fetchAuthors(): Promise<{ authors: string[] }> {
  return request("/api/authors");
}

export function fetchOverlayTaxonomy(): Promise<{ taxonomy: OverlayTaxonomy }> {
  return request("/api/overlay/taxonomy");
}

export function fetchRunOverlay(runId: string): Promise<{
  overlay: RunOverlayEntry | null;
  taxonomy: OverlayTaxonomy;
  authors: string[];
}> {
  return request(`/api/runs/${encodeURIComponent(runId)}/overlay`);
}

export function patchRunOverlay(runId: string, patch: RunOverlayPatch): Promise<{ overlay: RunOverlayEntry }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/overlay`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function fetchExperiments(): Promise<{ experiments: ExperimentListEntry[] }> {
  return request("/api/experiments");
}

export function fetchExperimentDetail(id: string): Promise<ExperimentDetailResponse> {
  return request(`/api/experiments/${encodeURIComponent(id)}`);
}

export function createExperiment(body: CreateExperimentRequest): Promise<{ experiment: ExperimentRecord }> {
  return request("/api/experiments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function patchExperiment(
  id: string,
  body: PatchExperimentRequest,
): Promise<{ experiment: ExperimentRecord }> {
  return request(`/api/experiments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function materializeExperiment(
  id: string,
  body: Partial<CreateExperimentRequest> = {},
): Promise<{ experiment: ExperimentRecord }> {
  return request(`/api/experiments/${encodeURIComponent(id)}/materialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchEnvProfiles(): Promise<{ profiles: EnvProfile[] }> {
  return request("/api/env-profiles");
}

export function triggerAnalyze(runId: string): Promise<{ job_id: string }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/analyze`, { method: "POST" });
}

export function triggerReconcile(runId: string): Promise<{ job_id: string }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/reconcile`, { method: "POST" });
}

export function triggerReplay(
  runId: string,
  options: { compare_only?: boolean } = {},
): Promise<{ job_id: string }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export function openRunApp(runId: string): Promise<OpenRunAppResult> {
  return request(`/api/runs/${encodeURIComponent(runId)}/app/open`, { method: "POST" });
}

export function fetchRunAppStatus(runId: string): Promise<RunAppStatus> {
  return request(`/api/runs/${encodeURIComponent(runId)}/app/status`);
}

export function killRunApp(runId: string): Promise<{ stopped: boolean }> {
  return request(`/api/runs/${encodeURIComponent(runId)}/app/kill`, { method: "POST" });
}

export function launchChallenge(body: ChallengeLaunchRequest): Promise<{ job_id: string }> {
  return request("/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchHarnessBoard(): Promise<HarnessBoardResponse> {
  return request("/api/harness-board");
}

export function fetchActiveChallenge(): Promise<{ job: JobRecord | null }> {
  return request("/api/challenge/active");
}

export function stopJob(jobId: string): Promise<JobRecord> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}/stop`, { method: "POST" });
}

export function fetchJob(jobId: string): Promise<JobRecord> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function streamJob(
  jobId: string,
  onLine: (line: string) => void,
  onDone: (status: JobStatus, exitCode: number | null) => void,
): () => void {
  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`);

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data) as {
      type: "line" | "done";
      line?: string;
      status?: JobStatus;
      exit_code?: number | null;
    };
    if (payload.type === "line" && payload.line) {
      onLine(payload.line);
    }
    if (payload.type === "done") {
      onDone(payload.status ?? "failed", payload.exit_code ?? null);
      source.close();
    }
  };

  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

const ACCESS_KEY_STORAGE = "hackathon_access_key";

export function getStoredAccessKey(): string {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setStoredAccessKey(key: string): void {
  localStorage.setItem(ACCESS_KEY_STORAGE, key);
}

export interface PublishStatus {
  available: boolean;
  has_server_access_key: boolean;
  api_base: string;
  frontend_base: string;
  message: string;
}

export interface PublishRunResponse {
  run_id: string;
  harness_run_id: string;
  view_url: string | null;
  api_status: number;
  created: boolean;
}

export function fetchPublishStatus(): Promise<PublishStatus> {
  return request("/api/publish/status");
}

export function publishRunToTeam(
  runId: string,
  accessKey?: string,
): Promise<PublishRunResponse> {
  const body: { access_key?: string } = {};
  if (accessKey?.trim()) {
    body.access_key = accessKey.trim();
  }
  return request(`/api/runs/${encodeURIComponent(runId)}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
