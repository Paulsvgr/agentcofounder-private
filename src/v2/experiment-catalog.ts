import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidExperimentId } from "./experiment-id.js";

const EXPERIMENT_SCHEMA = "agentcofounder.experiment.v1" as const;

interface ExperimentRecord {
  schema: typeof EXPERIMENT_SCHEMA;
  id: string;
  title: string;
  description: string;
  status: "active" | "archived";
  arms: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

function titleFromExperimentId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function experimentsRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, "artifacts", "experiments");
}

function experimentFilePath(repositoryRoot: string, id: string): string {
  return path.join(experimentsRoot(repositoryRoot), id, "experiment.json");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeArms(existing: string[], arm: string | null): string[] {
  const arms = new Set(existing.map((value) => value.trim()).filter(Boolean));
  if (arm?.trim()) arms.add(arm.trim());
  return [...arms].sort((left, right) => left.localeCompare(right));
}

/**
 * Ensure artifacts/experiments/<id>/experiment.json exists after a labeled run.
 * Creates a minimal catalog entry on first sight; merges discovered arms afterward.
 */
export async function ensureExperimentCatalogEntry(
  repositoryRoot: string,
  experimentId: string,
  arm: string | null,
): Promise<void> {
  const id = experimentId.trim();
  if (!id) return;
  assertValidExperimentId(id);

  const dir = path.join(experimentsRoot(repositoryRoot), id);
  const filePath = experimentFilePath(repositoryRoot, id);
  await mkdir(dir, { recursive: true });

  const now = new Date().toISOString();
  let record: ExperimentRecord;

  if (await fileExists(filePath)) {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as Partial<ExperimentRecord>;
    record = {
      schema: EXPERIMENT_SCHEMA,
      id,
      title: raw.title?.trim() || titleFromExperimentId(id),
      description: raw.description ?? "",
      status: raw.status === "archived" ? "archived" : "active",
      arms: mergeArms(Array.isArray(raw.arms) ? raw.arms.map(String) : [], arm),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      created_at: raw.created_at ?? now,
      updated_at: now,
      created_by: raw.created_by ?? null,
    };
  } else {
    record = {
      schema: EXPERIMENT_SCHEMA,
      id,
      title: titleFromExperimentId(id),
      description: "",
      status: "active",
      arms: mergeArms([], arm),
      tags: [],
      created_at: now,
      updated_at: now,
      created_by: null,
    };
  }

  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}
