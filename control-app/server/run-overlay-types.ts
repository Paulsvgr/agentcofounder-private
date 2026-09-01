import type { AppRubricScores } from "../shared/app-rubric.js";

export const RUNS_OVERLAY_SCHEMA = "agentcofounder.runs_overlay.v1" as const;

export type { AppRubricScores };

export const DEFAULT_AUTHORS = ["paul", "mohammed", "ali sina", "shivam"] as const;

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

export interface RunsOverlayFile {
  schema: typeof RUNS_OVERLAY_SCHEMA;
  updated_at: string;
  authors: string[];
  taxonomy: OverlayTaxonomy;
  runs: Record<string, RunOverlayEntry>;
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

export const DEFAULT_TAXONOMY: OverlayTaxonomy = {
  line: ["A", "A-prime", "B-prime", "C", "C-prime", "D", "F", "unknown"],
  experiment: [
    "baseline",
    "no-dev-server-prompt",
    "auto-test",
    "autoverify-off",
    "autoverify-supplement",
    "autoverify-owned",
    "autoverify-gated",
    "prime-comparison",
    "exp1-rtl-control",
    "exp1-rtl-cleanup",
    "exp2-stop-control",
    "exp2-stop-treatment",
    "exp3-test-control",
    "exp3-test-treatment",
    "exp4-digest-control",
    "exp4-digest-treatment",
    "exp5-template-control",
    "exp5-template-treatment",
    "exp6-reporter-control",
    "exp6-reporter-treatment",
    "exp5b-storage-control",
    "exp5b-storage-treatment",
    "legacy",
    "legacy-smoke",
    "unknown",
  ],
};

export function emptyHuman(): RunOverlayHuman {
  return { app_rubric: null, app_rating: null, app_comment: "", run_comment: "" };
}

export function normalizeHuman(human: Partial<RunOverlayHuman> | undefined): RunOverlayHuman {
  if (!human) return emptyHuman();
  return {
    app_rubric: human.app_rubric ?? null,
    app_rating: human.app_rating ?? null,
    app_comment: human.app_comment ?? "",
    run_comment: human.run_comment ?? "",
  };
}

export function emptyFlags(): RunOverlayFlags {
  return { exclude_from_ranking: false, hide_early_smoke: false, include_in_efficiency_compare: true };
}

export function emptyOverlayEntry(): RunOverlayEntry {
  return {
    author: null,
    git_branch: null,
    git_commit: null,
    experiment_id: null,
    classification: null,
    human: emptyHuman(),
    flags: emptyFlags(),
    updated_at: new Date(0).toISOString(),
  };
}
