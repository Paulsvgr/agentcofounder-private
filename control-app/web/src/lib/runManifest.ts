import { isRunManifest, RUN_MANIFEST_SCHEMA, type RunManifest, type RunManifestExperiment } from "../types/runManifest";

/** Resolve experiment id from manifest metadata (supports legacy `cohort`). */
export function resolveManifestExperimentId(
  experiment: RunManifestExperiment | null | undefined,
): string | null {
  if (!experiment) return null;
  const id = typeof experiment.id === "string" ? experiment.id.trim() : "";
  if (id) return id;
  const legacy = typeof experiment.cohort === "string" ? experiment.cohort.trim() : "";
  return legacy || null;
}

const TRANSPORT_MANIFEST_KEY = "manifest";

export function validateRunManifest(value: unknown): RunManifest | null {
  if (value === null || value === undefined) return null;
  if (!isRunManifest(value)) {
    throw new Error(
      `manifest must be null or an object with schema "${RUN_MANIFEST_SCHEMA}".`,
    );
  }
  return value;
}

/** Extract manifest from transport paste; returns export-shaped object without manifest key. */
export function splitTransportManifest(raw: Record<string, unknown>): {
  exportRaw: Record<string, unknown>;
  manifest: RunManifest | null;
} {
  if (!(TRANSPORT_MANIFEST_KEY in raw)) {
    return { exportRaw: raw, manifest: null };
  }
  const { [TRANSPORT_MANIFEST_KEY]: manifestIn, ...rest } = raw;
  const manifest = validateRunManifest(manifestIn);
  return { exportRaw: rest, manifest };
}

export function manifestSummary(manifest: RunManifest): string[] {
  const lines: string[] = [];
  if (manifest.config_hash) lines.push(`config ${manifest.config_hash.slice(0, 12)}…`);
  if (manifest.template?.id) lines.push(`template ${manifest.template.id}`);
  if (manifest.experiment?.arm) lines.push(`arm ${manifest.experiment.arm}`);
  const experimentId = resolveManifestExperimentId(manifest.experiment);
  if (experimentId) lines.push(`experiment ${experimentId}`);
  if (manifest.model && typeof manifest.model === "object") {
    const m = manifest.model as Record<string, unknown>;
    const provider = typeof m.provider === "string" ? m.provider : "";
    const model = typeof m.model === "string" ? m.model : "";
    const joined = [provider, model].filter(Boolean).join(" / ");
    if (joined) lines.push(joined);
  }
  return lines;
}
