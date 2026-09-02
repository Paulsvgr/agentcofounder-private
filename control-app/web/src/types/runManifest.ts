/** Provenance contract — stored as HackathonRun.data.manifest (sibling to data.export). */

export const RUN_MANIFEST_SCHEMA = "agentcofounder.run_manifest.v1" as const;

export type RunManifestGit = {
  branch?: string | null;
  commit?: string | null;
  dirty?: boolean;
};

export type RunManifestTemplate = {
  id?: string;
  tree_sha256?: string;
  tree_hash?: string;
  [key: string]: unknown;
};

export type RunManifestExperiment = {
  /** Primary experiment identifier (replaces legacy `cohort`). */
  id?: string | null;
  /** @deprecated use `id` — read via resolveManifestExperimentId() */
  cohort?: string | null;
  arm?: string | null;
  rep?: number | null;
  intervention?: string | null;
  [key: string]: unknown;
};

export type RunManifest = {
  schema: typeof RUN_MANIFEST_SCHEMA;
  run_id: string;
  created_at?: string;
  git?: RunManifestGit;
  idea?: Record<string, unknown>;
  model?: Record<string, unknown>;
  config?: Record<string, unknown>;
  config_schema_version?: string;
  config_hash?: string;
  template?: RunManifestTemplate;
  prompt?: Record<string, unknown>;
  versions?: Record<string, unknown>;
  experiment?: RunManifestExperiment;
  outcome?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function isRunManifest(value: unknown): value is RunManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return o.schema === RUN_MANIFEST_SCHEMA && typeof o.run_id === "string";
}
