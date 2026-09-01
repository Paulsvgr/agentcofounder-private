import type { AppRubricScores } from "../shared/app-rubric.js";

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
  replay_verdict: "identical" | "diverged" | "unverified" | null;
  mega_call_flag: boolean;
  created_at: string | null;
  /** User overlay — author who ran/reviewed */
  author: string | null;
  display_label: string | null;
  experiment_slug: string | null;
  app_rating: number | null;
  app_rubric: AppRubricScores | null;
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
}

export interface ReplayLaunchRequest {
  compare_only?: boolean;
}

export type ReplayVerdict = "identical" | "diverged" | "unverified";

export type JobKind = "analyze" | "reconcile" | "replay" | "challenge" | "app-dev";

export type JobStatus = "running" | "succeeded" | "failed";

export interface JobRecord {
  id: string;
  kind: JobKind;
  run_id: string | null;
  status: JobStatus;
  exit_code: number | null;
  lines: string[];
  started_at: string;
  finished_at: string | null;
}

export const MEGA_CALL_THRESHOLD = 5000;
