export const MILESTONE_STATE_SCHEMA = "agentcofounder.milestone_state.v1" as const;

export type MilestoneAction = "implement_core" | "continue_journeys" | "repair" | "done";

export interface NextSlice {
  action: MilestoneAction;
  title: string;
  instruction: string;
  /** Adaptive VOI kind when context intelligence is enabled. */
  voi_kind?: string;
  success_condition?: string;
  score?: number;
}

export interface SealedMilestone {
  slice: number;
  title: string;
  action: MilestoneAction;
  l0_passed: boolean;
  voi_kind?: string;
}

export interface L0Snapshot {
  passed: boolean;
  tests_passed: boolean;
  build_passed: boolean;
  http_passed: boolean;
  summary: string;
}

export interface ContextMetricsEntry {
  slice: number;
  estimated_tokens_before: number;
  estimated_tokens_after: number;
  reduction_ratio: number;
  compacted: boolean;
}

/** Backward-compatible milestone state; intelligence fields are optional. */
export interface MilestoneState {
  schema: typeof MILESTONE_STATE_SCHEMA;
  slice: number;
  sealed: SealedMilestone[];
  last_action: MilestoneAction | null;
  last_title: string | null;
  last_instruction: string | null;
  last_l0: L0Snapshot | null;
  last_green_checkpoint: string | null;
  done: boolean;
  stop_reason?: string | null;
  context_metrics?: ContextMetricsEntry[];
  last_workspace_fingerprint?: string | null;
  unchanged_workspace_streak?: number;
  failure_fingerprints?: string[];
  last_voi_kind?: string | null;
}

export function initialMilestoneState(): MilestoneState {
  return {
    schema: MILESTONE_STATE_SCHEMA,
    slice: 0,
    sealed: [],
    last_action: null,
    last_title: null,
    last_instruction: null,
    last_l0: null,
    last_green_checkpoint: null,
    done: false,
    stop_reason: null,
    context_metrics: [],
    last_workspace_fingerprint: null,
    unchanged_workspace_streak: 0,
    failure_fingerprints: [],
    last_voi_kind: null,
  };
}
