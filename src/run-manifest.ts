import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const RUN_MANIFEST_SCHEMA = "agentcofounder.run_manifest.v1" as const;
export const RUN_MANIFEST_FILENAME = "run-manifest.json";

/** Full V2 provenance blob — validated minimally, passed through intact for storage. */
export type RunManifest = Record<string, unknown> & {
  schema: typeof RUN_MANIFEST_SCHEMA;
  run_id: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRunManifest(raw: unknown, runId: string): RunManifest {
  if (!isObject(raw)) {
    throw new Error("Run manifest must be a JSON object");
  }
  if (raw.schema !== RUN_MANIFEST_SCHEMA) {
    throw new Error(`Run manifest schema must be ${RUN_MANIFEST_SCHEMA}`);
  }
  if (typeof raw.run_id !== "string" || raw.run_id.trim() === "") {
    throw new Error("Run manifest run_id is required");
  }
  if (raw.run_id !== runId) {
    throw new Error(
      `Run manifest run_id ${raw.run_id} does not match export run ${runId}`,
    );
  }
  return raw as RunManifest;
}

export function runManifestPath(runsDirectory: string, runId: string): string {
  return path.join(runsDirectory, runId, RUN_MANIFEST_FILENAME);
}

/** Returns null when the file is missing; throws on invalid schema or run_id mismatch. */
export async function loadRunManifestForExport(
  runsDirectory: string,
  runId: string,
): Promise<RunManifest | null> {
  const manifestPath = runManifestPath(runsDirectory, runId);
  try {
    await access(manifestPath);
  } catch {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Failed to parse run manifest at ${manifestPath}: ${message}`);
  }

  return validateRunManifest(raw, runId);
}
