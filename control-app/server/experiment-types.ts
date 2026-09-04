export const EXPERIMENT_SCHEMA = "agentcofounder.experiment.v1" as const;

export type ExperimentStatus = "active" | "archived";

export interface ExperimentRecord {
  schema: typeof EXPERIMENT_SCHEMA;
  id: string;
  title: string;
  description: string;
  status: ExperimentStatus;
  arms: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

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

export { EXPERIMENT_ID_PATTERN } from "../shared/experiment-id.js";

export function titleFromExperimentId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
