import { isRunManifest, type RunManifest } from "../types/runManifest";
import type { HackathonRunRecord } from "../types/runExport";

export function runManifestOf(run: HackathonRunRecord): RunManifest | null {
  const manifest = run.data.manifest;
  return manifest && isRunManifest(manifest) ? manifest : null;
}

export function templateTreeHash(manifest: RunManifest): string | null {
  const template = manifest.template;
  if (!template || typeof template !== "object") return null;
  const record = template as Record<string, unknown>;
  const hash = record.tree_sha256 ?? record.tree_hash;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}

export function manifestModelLine(manifest: RunManifest): string {
  const model = manifest.model;
  if (!model || typeof model !== "object") return "";
  const record = model as Record<string, unknown>;
  return [record.provider, record.model].filter((x) => typeof x === "string" && x).join(" / ");
}

export function manifestModelSettings(manifest: RunManifest): string {
  const model = manifest.model;
  if (!model || typeof model !== "object") return "";
  const record = model as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.thinking === "string" && record.thinking !== "off") {
    parts.push(`thinking=${record.thinking}`);
  }
  if (typeof record.max_tokens === "number") parts.push(`max_tokens=${record.max_tokens}`);
  if (typeof record.context_window === "number") parts.push(`context_window=${record.context_window}`);
  if (typeof record.timeout_ms === "number") parts.push(`timeout_ms=${record.timeout_ms}`);
  return parts.join(", ");
}

export function manifestSearchHaystack(run: HackathonRunRecord): string {
  const manifest = runManifestOf(run);
  if (!manifest) return "";
  const parts = [
    manifest.config_hash,
    manifest.config_schema_version,
    manifest.template?.id,
    templateTreeHash(manifest),
    manifest.experiment?.cohort,
    manifest.experiment?.arm,
    manifest.experiment?.intervention,
    manifestModelLine(manifest),
    manifestModelSettings(manifest),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function shortConfigHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}
