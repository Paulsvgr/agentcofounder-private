export const MILESTONE_CONTEXT_SCHEMA = "agentcofounder.milestone_context.v1" as const;

export interface ArchitectureState {
  has_domain: boolean;
  has_storage: boolean;
  has_components: boolean;
  app_is_seed_like: boolean;
}

export interface VerificationDigest {
  passed: boolean;
  tests_passed: boolean;
  build_passed: boolean;
  summary_one_liner: string;
  artifact: string;
}

export interface ArtifactPointer {
  label: string;
  path: string;
  note: string;
}

export interface ContextMetricsSnapshot {
  slice: number;
  estimated_tokens_before: number;
  estimated_tokens_after: number;
  volatile_chars: number;
  stable_chars: number;
  compacted: boolean;
  reduction_ratio: number;
  /** Competition-weighted estimates for this slice prompt (input + 3*out + 0.1*cache). */
  estimated_weighted_cost?: number;
  estimated_output_budget?: number;
  stable_prompt_sha256?: string;
  cache_hit_assumption?: number;
}

/** Durable rules kept byte-stable across slices (referenced, not re-inlined from disk dumps). */
export interface StableContextSection {
  idea_digest: string;
  coding_rules_ref: string;
  architecture_rules: string[];
  test_budget: string;
  memory_rules: string[];
}

/** Per-slice changing state — the only part that should grow/shrink between sessions. */
export interface VolatileContextSection {
  current_objective: string;
  next_action: string;
  next_action_kind: string;
  success_condition: string;
  completed_journeys: string[];
  remaining_journeys: string[];
  architecture: ArchitectureState;
  changed_files: string[];
  known_defects: string[];
  latest_verification: VerificationDigest | null;
  top_findings: Array<{
    severity: string;
    area: string;
    evidence: string;
    recommended_action: string;
  }>;
  artifact_pointers: ArtifactPointer[];
  stop_reason: string | null;
}

export interface MilestoneContext {
  schema: typeof MILESTONE_CONTEXT_SCHEMA;
  stable: StableContextSection;
  volatile: VolatileContextSection;
  compaction_summaries: string[];
  metrics_log: ContextMetricsSnapshot[];
}

export function initialMilestoneContext(idea: string, memoryRules: string[] = []): MilestoneContext {
  const ideaDigest = idea.trim().slice(0, 280) + (idea.trim().length > 280 ? "…" : "");
  return {
    schema: MILESTONE_CONTEXT_SCHEMA,
    stable: {
      idea_digest: ideaDigest,
      coding_rules_ref: "AGENTS.md + system-prompt (appended system; do not re-read)",
      architecture_rules: [
        "src/domain/ types + pure ops",
        "src/storage/ repository only for localStorage",
        "src/components/ UI; thin App.tsx",
      ],
      test_budget: "8–10 focused UI journeys (soft max 10); no domain/repo unit suites",
      memory_rules: memoryRules.slice(0, 12),
    },
    volatile: {
      current_objective: "Build modular app with lean UI journey tests",
      next_action: "implement_core",
      next_action_kind: "implement_core",
      success_condition: "Product tests exist and L0 passes",
      completed_journeys: [],
      remaining_journeys: ["add", "edit/delete", "filter", "derived", "persist", "validation", "robustness", "+/- stability"],
      architecture: {
        has_domain: false,
        has_storage: false,
        has_components: false,
        app_is_seed_like: true,
      },
      changed_files: [],
      known_defects: [],
      latest_verification: null,
      top_findings: [],
      artifact_pointers: [],
      stop_reason: null,
    },
    compaction_summaries: [],
    metrics_log: [],
  };
}
