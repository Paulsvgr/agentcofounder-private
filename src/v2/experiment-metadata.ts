import { assertValidExperimentId } from "./experiment-id.js";

/** Per-run experiment metadata stamped into run-manifest.json. */
export interface ExperimentMetadata {
  id: string | null;
  arm: string | null;
  rep: number | null;
  intervention: string | null;
}

/** Historical manifests may still store `cohort` instead of `id`. */
export type LegacyExperimentMetadata = Partial<ExperimentMetadata> & {
  cohort?: string | null;
};

function readOptionalEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return null;
  return value.trim();
}

function readOptionalPositiveInteger(name: string): number | null {
  const raw = readOptionalEnv(name);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/** Resolve experiment id from manifest metadata (supports legacy `cohort`). */
export function resolveExperimentId(
  experiment: LegacyExperimentMetadata | null | undefined,
): string | null {
  if (!experiment) return null;
  const id = experiment.id?.trim();
  if (id) return id;
  const legacy = experiment.cohort?.trim();
  return legacy || null;
}

export function collectExperimentMetadata(): ExperimentMetadata {
  const repRaw = readOptionalEnv("RUN_REP");
  const rep = repRaw === null ? null : Number.parseInt(repRaw, 10);
  const id = readOptionalEnv("RUN_EXPERIMENT") ?? readOptionalEnv("RUN_COHORT");
  if (id) assertValidExperimentId(id);
  return {
    id,
    arm: readOptionalEnv("RUN_ARM"),
    rep: Number.isFinite(rep) && rep !== null && rep > 0 ? rep : null,
    intervention: readOptionalEnv("RUN_INTERVENTION"),
  };
}
