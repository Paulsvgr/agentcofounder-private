import { access, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EXPERIMENT_ID_PATTERN,
  EXPERIMENT_SCHEMA,
  titleFromExperimentId,
  type CreateExperimentRequest,
  type ExperimentListEntry,
  type ExperimentRecord,
  type ExperimentSource,
  type ExperimentStatus,
  type ExperimentSummary,
  type PatchExperimentRequest,
} from "./experiment-types.js";
import {
  DEFAULT_AUTHORS,
  DEFAULT_TAXONOMY,
  RUNS_OVERLAY_SCHEMA,
  type RunOverlayEntry,
  type RunsOverlayFile,
} from "./run-overlay-types.js";

let experimentsCache: { root: string; mtimeMs: number; experiments: ExperimentRecord[] } | null = null;

export type {
  CreateExperimentRequest,
  ExperimentListEntry,
  ExperimentRecord,
  ExperimentSource,
  ExperimentStatus,
  ExperimentSummary,
  PatchExperimentRequest,
} from "./experiment-types.js";

export { EXPERIMENT_ID_PATTERN, EXPERIMENT_SCHEMA, titleFromExperimentId } from "./experiment-types.js";

export function experimentsRoot(repoRoot: string): string {
  return path.join(repoRoot, "artifacts", "experiments");
}

export function experimentDir(repoRoot: string, id: string): string {
  return path.join(experimentsRoot(repoRoot), id);
}

export function experimentFilePath(repoRoot: string, id: string): string {
  return path.join(experimentDir(repoRoot, id), "experiment.json");
}

function overlayFilePath(repoRoot: string): string {
  return path.join(repoRoot, "artifacts", "runs-overlay.json");
}

async function readOverlayForTaxonomy(repoRoot: string): Promise<RunsOverlayFile> {
  const filePath = overlayFilePath(repoRoot);
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as RunsOverlayFile;
    return {
      schema: RUNS_OVERLAY_SCHEMA,
      updated_at: raw.updated_at ?? new Date().toISOString(),
      authors: raw.authors?.length ? raw.authors : [...DEFAULT_AUTHORS],
      taxonomy: {
        line: raw.taxonomy?.line?.length ? raw.taxonomy.line : DEFAULT_TAXONOMY.line,
        experiment: raw.taxonomy?.experiment?.length ? raw.taxonomy.experiment : DEFAULT_TAXONOMY.experiment,
      },
      runs: raw.runs ?? {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        schema: RUNS_OVERLAY_SCHEMA,
        updated_at: new Date().toISOString(),
        authors: [...DEFAULT_AUTHORS],
        taxonomy: DEFAULT_TAXONOMY,
        runs: {},
      };
    }
    throw error;
  }
}

async function writeOverlayForTaxonomy(repoRoot: string, file: RunsOverlayFile): Promise<void> {
  const filePath = overlayFilePath(repoRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  file.updated_at = new Date().toISOString();
  await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export function invalidateExperimentsCache(): void {
  experimentsCache = null;
}

function normalizeExperimentRecord(raw: ExperimentRecord, id: string): ExperimentRecord {
  const now = new Date().toISOString();
  return {
    schema: EXPERIMENT_SCHEMA,
    id,
    title: raw.title?.trim() || titleFromExperimentId(id),
    description: raw.description ?? "",
    status: raw.status === "archived" ? "archived" : "active",
    arms: Array.isArray(raw.arms) ? raw.arms.map((arm) => String(arm).trim()).filter(Boolean) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    created_at: raw.created_at ?? now,
    updated_at: raw.updated_at ?? now,
    created_by: raw.created_by ?? null,
  };
}

function toSummary(record: ExperimentRecord): ExperimentSummary {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

async function directoryMtimeMs(root: string): Promise<number | null> {
  try {
    return (await stat(root)).mtimeMs;
  } catch {
    return null;
  }
}

async function writeExperimentAtomic(filePath: string, record: ExperimentRecord): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export function validateExperimentId(id: string): void {
  const trimmed = id.trim();
  if (!EXPERIMENT_ID_PATTERN.test(trimmed)) {
    throw new Error(
      "Experiment id must be lowercase letters, numbers, and hyphens (1–80 chars), e.g. exp7-planner-treatment",
    );
  }
}

export function validateCreateExperimentRequest(body: CreateExperimentRequest): CreateExperimentRequest {
  const id = body.id.trim();
  validateExperimentId(id);
  const title = body.title?.trim();
  if (title !== undefined && title.length > 200) {
    throw new Error("title must be 200 characters or fewer");
  }
  const description = body.description?.trim() ?? "";
  if (description.length > 4000) {
    throw new Error("description must be 4000 characters or fewer");
  }
  return {
    id,
    title: title || titleFromExperimentId(id),
    description,
    status: body.status === "archived" ? "archived" : "active",
    arms: body.arms?.map((arm) => arm.trim()).filter(Boolean) ?? [],
    tags: body.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    created_by: body.created_by?.trim() || null,
  };
}

async function readExperimentFile(repoRoot: string, id: string): Promise<ExperimentRecord | null> {
  try {
    const raw = JSON.parse(await readFile(experimentFilePath(repoRoot, id), "utf8")) as ExperimentRecord;
    return normalizeExperimentRecord(raw, id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function listExperiments(repoRoot: string, force = false): Promise<ExperimentRecord[]> {
  const root = experimentsRoot(repoRoot);
  const mtimeMs = await directoryMtimeMs(root);
  if (
    !force &&
    experimentsCache &&
    experimentsCache.root === root &&
    experimentsCache.mtimeMs === mtimeMs &&
    mtimeMs !== null
  ) {
    return experimentsCache.experiments;
  }

  if (mtimeMs === null) {
    experimentsCache = { root, mtimeMs: -1, experiments: [] };
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const experiments: ExperimentRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const record = await readExperimentFile(repoRoot, entry.name);
    if (record) experiments.push(record);
  }

  experiments.sort((left, right) => left.id.localeCompare(right.id));
  experimentsCache = { root, mtimeMs, experiments };
  return experiments;
}

export async function getExperiment(repoRoot: string, id: string): Promise<ExperimentRecord | null> {
  validateExperimentId(id);
  const experiments = await listExperiments(repoRoot);
  return experiments.find((experiment) => experiment.id === id) ?? null;
}

export async function appendExperimentToOverlayTaxonomy(repoRoot: string, id: string): Promise<void> {
  validateExperimentId(id);
  const overlay = await readOverlayForTaxonomy(repoRoot);
  if (!overlay.taxonomy.experiment.includes(id)) {
    overlay.taxonomy.experiment.push(id);
    overlay.taxonomy.experiment.sort((a, b) => a.localeCompare(b));
    await writeOverlayForTaxonomy(repoRoot, overlay);
  }
}

export async function createExperiment(
  repoRoot: string,
  body: CreateExperimentRequest,
): Promise<ExperimentRecord> {
  const validated = validateCreateExperimentRequest(body);
  const filePath = experimentFilePath(repoRoot, validated.id);
  try {
    await access(filePath);
    throw new Error(`Experiment already exists: ${validated.id}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof Error && error.message.startsWith("Experiment already exists")) {
        throw error;
      }
      throw error;
    }
  }

  const now = new Date().toISOString();
  const record: ExperimentRecord = {
    schema: EXPERIMENT_SCHEMA,
    id: validated.id,
    title: validated.title ?? titleFromExperimentId(validated.id),
    description: validated.description ?? "",
    status: validated.status ?? "active",
    arms: validated.arms ?? [],
    tags: validated.tags ?? [],
    created_at: now,
    updated_at: now,
    created_by: validated.created_by ?? null,
  };

  await writeExperimentAtomic(filePath, record);
  invalidateExperimentsCache();
  await appendExperimentToOverlayTaxonomy(repoRoot, record.id);
  return record;
}

export async function seedExperimentsFromTaxonomy(
  repoRoot: string,
  ids: string[],
  options: { force?: boolean } = {},
): Promise<{ created: number; skipped: number; updated: number }> {
  let created = 0;
  let skipped = 0;
  let updated = 0;
  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id || id === "unknown") continue;
    validateExperimentId(id);
    const existing = await readExperimentFile(repoRoot, id);
    if (existing && !options.force) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    const record: ExperimentRecord = {
      schema: EXPERIMENT_SCHEMA,
      id,
      title: existing?.title ?? titleFromExperimentId(id),
      description: existing?.description ?? "",
      status: existing?.status ?? "active",
      arms: existing?.arms ?? [],
      tags: existing?.tags ?? [],
      created_at: existing?.created_at ?? now,
      updated_at: now,
      created_by: existing?.created_by ?? null,
    };
    await writeExperimentAtomic(experimentFilePath(repoRoot, id), record);
    await appendExperimentToOverlayTaxonomy(repoRoot, id);
    if (existing) updated += 1;
    else created += 1;
  }
  invalidateExperimentsCache();
  return { created, skipped, updated };
}

export function listExperimentSummaries(records: ExperimentRecord[]): ExperimentSummary[] {
  return records.map(toSummary);
}

function usedExperimentSlug(entry: RunOverlayEntry): string | null {
  const slug = entry.experiment_id ?? entry.classification?.experiment ?? null;
  if (!slug || slug === "unknown") return null;
  return slug;
}

export function collectUsedExperimentIds(overlay: RunsOverlayFile): Set<string> {
  const ids = new Set<string>();
  for (const slug of overlay.taxonomy.experiment) {
    if (slug && slug !== "unknown") ids.add(slug);
  }
  for (const entry of Object.values(overlay.runs)) {
    const slug = usedExperimentSlug(entry);
    if (slug) ids.add(slug);
  }
  return ids;
}

function countRunsByExperiment(runSlugs: Map<string, string | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slug of runSlugs.values()) {
    if (!slug || slug === "unknown") continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

function syntheticUsedRecord(id: string): ExperimentRecord {
  const now = new Date(0).toISOString();
  return {
    schema: EXPERIMENT_SCHEMA,
    id,
    title: titleFromExperimentId(id),
    description: "",
    status: "active",
    arms: [],
    tags: [],
    created_at: now,
    updated_at: now,
    created_by: null,
  };
}

export async function listExperimentsWithUsage(
  repoRoot: string,
  overlay: RunsOverlayFile,
  runSlugs: Map<string, string | null>,
): Promise<ExperimentListEntry[]> {
  const catalog = await listExperiments(repoRoot);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const usedIds = collectUsedExperimentIds(overlay);
  for (const slug of runSlugs.values()) {
    if (slug && slug !== "unknown") usedIds.add(slug);
  }

  const runCounts = countRunsByExperiment(runSlugs);
  const allIds = new Set<string>([...catalog.map((entry) => entry.id), ...usedIds]);

  const entries: ExperimentListEntry[] = [];
  for (const id of [...allIds].sort((a, b) => a.localeCompare(b))) {
    const catalogEntry = catalogById.get(id);
    const hasCatalog = Boolean(catalogEntry);
    const runCount = runCounts.get(id) ?? 0;
    const isUsed = usedIds.has(id) || runCount > 0;
    let source: ExperimentSource = "catalog";
    if (hasCatalog && isUsed) source = "both";
    else if (!hasCatalog && isUsed) source = "used-only";
    else if (hasCatalog) source = "catalog";

    const base = catalogEntry ?? syntheticUsedRecord(id);
    entries.push({
      ...toSummary(base),
      has_catalog: hasCatalog,
      source,
      run_count: runCount,
    });
  }

  return entries;
}

export function validatePatchExperimentRequest(body: PatchExperimentRequest): PatchExperimentRequest {
  const patch: PatchExperimentRequest = {};
  const title = body.title?.trim();
  if (title !== undefined) {
    if (title.length > 200) throw new Error("title must be 200 characters or fewer");
    patch.title = title;
  }
  const description = body.description?.trim();
  if (description !== undefined) {
    if (description.length > 4000) throw new Error("description must be 4000 characters or fewer");
    patch.description = description;
  }
  if (body.status !== undefined) patch.status = body.status;
  if (body.arms !== undefined) patch.arms = body.arms.map((arm) => arm.trim()).filter(Boolean);
  if (body.tags !== undefined) patch.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
  return patch;
}

export async function patchExperiment(
  repoRoot: string,
  id: string,
  body: PatchExperimentRequest,
): Promise<ExperimentRecord> {
  validateExperimentId(id);
  const validated = validatePatchExperimentRequest(body);
  const existing = await readExperimentFile(repoRoot, id);
  if (!existing) {
    throw new Error(`Experiment not found: ${id}`);
  }

  const next: ExperimentRecord = {
    ...existing,
    title: validated.title ?? existing.title,
    description: validated.description ?? existing.description,
    status: validated.status ?? existing.status,
    arms: validated.arms ?? existing.arms,
    tags: validated.tags ?? existing.tags,
    updated_at: new Date().toISOString(),
  };

  await writeExperimentAtomic(experimentFilePath(repoRoot, id), next);
  invalidateExperimentsCache();
  await appendExperimentToOverlayTaxonomy(repoRoot, id);
  return next;
}

export async function materializeExperiment(
  repoRoot: string,
  id: string,
  body: Partial<CreateExperimentRequest> = {},
): Promise<ExperimentRecord> {
  validateExperimentId(id);
  const existing = await readExperimentFile(repoRoot, id);
  if (existing) return existing;
  return createExperiment(repoRoot, {
    id,
    title: body.title ?? titleFromExperimentId(id),
    description: body.description ?? "",
    status: body.status ?? "active",
    arms: body.arms ?? [],
    tags: body.tags ?? [],
    created_by: body.created_by ?? null,
  });
}

export function runIdsForExperiment(
  runSlugs: Map<string, string | null>,
  experimentId: string,
): string[] {
  return [...runSlugs.entries()]
    .filter(([, slug]) => slug === experimentId)
    .map(([runId]) => runId)
    .sort((a, b) => b.localeCompare(a));
}
