export const MILESTONE_STATE_SCHEMA = "agentcofounder.milestone_state.v1" as const;

export type MilestoneAction = "implement_core" | "continue_journeys" | "repair" | "done";

export interface NextSlice {
  action: MilestoneAction;
  title: string;
  instruction: string;
}

export interface SealedMilestone {
  slice: number;
  title: string;
  action: MilestoneAction;
  l0_passed: boolean;
}

export interface L0Snapshot {
  passed: boolean;
  tests_passed: boolean;
  build_passed: boolean;
  http_passed: boolean;
  summary: string;
}

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
  };
}
