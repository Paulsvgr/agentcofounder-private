import type { RunManifest } from "./runManifest";

/** Paste contract from harness: run_export v1 (legacy) or v2 (action-flow). */

export const RUN_EXPORT_SCHEMA_V1 = "agentcofounder.run_export.v1" as const;
export const RUN_EXPORT_SCHEMA_V2 = "agentcofounder.run_export.v2" as const;

export const RUN_EXPORT_SCHEMA = RUN_EXPORT_SCHEMA_V1;

export type RunExportSchema =
  | typeof RUN_EXPORT_SCHEMA_V1
  | typeof RUN_EXPORT_SCHEMA_V2;

export type TestRun = {
  command: string;
  journey: string;
  result: "passed" | "failed";
};

export type PhaseBucket = {
  phase: "recon" | "build" | "test_debug" | "finalize" | "mixed" | "other";
  call_count: number;
  weighted_cost: number;
  share_of_total: number;
};

export type ActionStage =
  | "inspect"
  | "build_app"
  | "write_tests"
  | "diagnose"
  | "repair_loop"
  | "green_build"
  | "extra_verify"
  | "report_final";

export const ACTION_STAGE_ORDER: ActionStage[] = [
  "inspect",
  "build_app",
  "write_tests",
  "diagnose",
  "repair_loop",
  "green_build",
  "extra_verify",
  "report_final",
];

export type ActionSegment = {
  stage: ActionStage;
  call_count: number;
  call_indexes: number[];
  wall_seconds: number;
  raw_tokens: number;
  weighted_tokens: number;
  note: string | null;
};

export type ClassificationLine = "A" | "A-prime" | "B-prime" | "C" | "C-prime" | "D" | "F" | "unknown";

export type ClassificationExperiment =
  | "baseline"
  | "no-dev-server-prompt"
  | "auto-test"
  | "autoverify-off"
  | "autoverify-supplement"
  | "autoverify-owned"
  | "autoverify-gated"
  | "prime-comparison"
  | "exp1-rtl-control"
  | "exp1-rtl-cleanup"
  | "exp2-stop-control"
  | "exp2-stop-treatment"
  | "exp3-test-control"
  | "exp3-test-treatment"
  | "exp4-digest-control"
  | "exp4-digest-treatment"
  | "exp5-template-control"
  | "exp5-template-treatment"
  | "exp6-reporter-control"
  | "exp6-reporter-treatment"
  | "exp5b-storage-control"
  | "exp5b-storage-treatment"
  | "legacy"
  | "legacy-smoke"
  | "unknown";

export type RunClassification = {
  line: ClassificationLine;
  experiment: ClassificationExperiment;
  run_index: number | null;
  display_label: string;
  legacy_approach?: string;
};

export type RunFlags = {
  exclude_from_ranking: boolean;
  hide_early_smoke: boolean;
  include_in_efficiency_compare: boolean;
};

export type RunHuman = {
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
};

export type RunExportEfficiency = {
  weighted_total: number;
  wall_seconds: number | null;
  seconds_per_call: number | null;
  first_test_failure_s?: number | null;
  first_green_s?: number | null;
  last_green_s?: number | null;
  green_to_exit_s?: number | null;
  manual_test_calls?: number;
  manual_build_calls?: number;
  test_reinspection_calls?: number;
  post_green_verification_calls?: number;
  full_suite_test_calls?: number;
  multiple_element_failures_total?: number;
  rtl_dom_leak_failures?: number;
  query_ambiguity_failures?: number;
  harness_green_but_no_first_green?: boolean;
  auto_test_candidate_events?: number;
  auto_test_actual_runs?: number;
  action_flow?: ActionSegment[];
  action_flow_source?: "derived" | "derived+override";
  phase_heuristic: PhaseBucket[];
  time_to_first_failing_test_s: number | null;
  time_to_final_green_s: number | null;
  npm_test_command_count: number | null;
  auto_test_trigger_hits: number | null;
};

export type RunExport = {
  schema: RunExportSchema;
  meta: {
    run_id: string;
    recorded_at: string;
    git_branch: string | null;
    git_commit: string | null;
    approach: string | null;
    provider: string | null;
    model: string | null;
    classification?: RunClassification;
  };
  harness: {
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
  };
  efficiency: RunExportEfficiency;
};

/** Meta fields the user can fill after a legacy result.json paste. */
export type PasteOverrides = {
  approach?: string;
  provider?: string;
  model?: string;
  run_id?: string;
  git_branch?: string | null;
  git_commit?: string | null;
};

export type PasteKind = "run_export_v2" | "run_export_v1" | "result_json";

/** Human fields — UI / DB only, never part of paste schema. */
export type HumanFields = {
  author: string;
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
};

/**
 * Stored in HackathonRun.data on webeditor.
 * Top-level git_* keys keep server filters working.
 */
export type HackathonRunData = {
  run_id?: string | null;
  git_branch: string | null;
  git_commit: string | null;
  approach_kind: string | null;
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
  paste_kind?: string;
  classification?: RunClassification;
  human?: RunHuman;
  flags?: RunFlags;
  export: RunExport;
  /** Provenance sibling — not nested inside export. */
  manifest?: RunManifest | null;
};

export type HackathonRunRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  person: string;
  data: HackathonRunData;
};

export const HACKATHON_AUTHORS = [
  "paul",
  "mohammed",
  "ali sina",
  "shivam",
] as const;

export type HackathonAuthor = (typeof HACKATHON_AUTHORS)[number];

export function isExportV2(exportDoc: RunExport | undefined): boolean {
  return exportDoc?.schema === RUN_EXPORT_SCHEMA_V2;
}

export function hasActionFlow(exportDoc: RunExport | undefined): boolean {
  const flow = exportDoc?.efficiency?.action_flow;
  return isExportV2(exportDoc) && Array.isArray(flow) && flow.length > 0;
}
