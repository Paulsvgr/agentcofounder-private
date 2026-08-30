import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  appendExperimentToOverlayTaxonomy,
  getExperiment,
  validateExperimentId,
} from "./experiments.js";
import {
  DEFAULT_AUTHORS,
  DEFAULT_TAXONOMY,
  emptyFlags,
  emptyHuman,
  emptyOverlayEntry,
  RUNS_OVERLAY_SCHEMA,
  type RunOverlayEntry,
  type RunOverlayPatch,
  type RunsOverlayFile,
} from "./run-overlay-types.js";

export type {
  OverlayTaxonomy,
  RunOverlayClassification,
  RunOverlayEntry,
  RunOverlayFlags,
  RunOverlayHuman,
  RunOverlayPatch,
  RunsOverlayFile,
} from "./run-overlay-types.js";

export { DEFAULT_AUTHORS, DEFAULT_TAXONOMY, RUNS_OVERLAY_SCHEMA } from "./run-overlay-types.js";

let overlayCache: { path: string; mtimeMs: number; file: RunsOverlayFile } | null = null;

export function overlayFilePath(repoRoot: string): string {
  return path.join(repoRoot, "artifacts", "runs-overlay.json");
}

function defaultOverlayFile(): RunsOverlayFile {
  return {
    schema: RUNS_OVERLAY_SCHEMA,
    updated_at: new Date().toISOString(),
    authors: [...DEFAULT_AUTHORS],
    taxonomy: DEFAULT_TAXONOMY,
    runs: {},
  };
}

function normalizeOverlayFile(raw: RunsOverlayFile): RunsOverlayFile {
  return {
    schema: RUNS_OVERLAY_SCHEMA,
    updated_at: raw.updated_at ?? new Date().toISOString(),
    authors: raw.authors?.length ? [...new Set(raw.authors.map((a) => a.trim()).filter(Boolean))] : [...DEFAULT_AUTHORS],
    taxonomy: {
      line: raw.taxonomy?.line?.length ? raw.taxonomy.line : DEFAULT_TAXONOMY.line,
      experiment: raw.taxonomy?.experiment?.length ? raw.taxonomy.experiment : DEFAULT_TAXONOMY.experiment,
    },
    runs: raw.runs ?? {},
  };
}

async function fileMtimeMs(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

async function writeOverlayAtomic(filePath: string, file: RunsOverlayFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const payload = `${JSON.stringify(file, null, 2)}\n`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
  overlayCache = { path: filePath, mtimeMs: (await stat(filePath)).mtimeMs, file };
}

export function invalidateOverlayCache(): void {
  overlayCache = null;
}

export async function readOverlayFile(repoRoot: string, force = false): Promise<RunsOverlayFile> {
  const filePath = overlayFilePath(repoRoot);
  const mtimeMs = await fileMtimeMs(filePath);
  if (!force && overlayCache && overlayCache.path === filePath && overlayCache.mtimeMs === mtimeMs) {
    return overlayCache.file;
  }

  if (mtimeMs === null) {
    const empty = defaultOverlayFile();
    overlayCache = { path: filePath, mtimeMs: -1, file: empty };
    return empty;
  }

  const raw = JSON.parse(await readFile(filePath, "utf8")) as RunsOverlayFile;
  const file = normalizeOverlayFile(raw);
  overlayCache = { path: filePath, mtimeMs, file };
  return file;
}

export function getRunOverlayFromFile(file: RunsOverlayFile, runId: string): RunOverlayEntry | null {
  return file.runs[runId] ?? null;
}

export function listAuthorsFromFile(file: RunsOverlayFile): string[] {
  return [...file.authors].sort((a, b) => a.localeCompare(b));
}

function buildDisplayLabel(classification: RunOverlayEntry["classification"]): string | null {
  if (!classification) return null;
  if (classification.display_label.trim()) return classification.display_label.trim();
  const parts = [classification.experiment].filter((part) => part && part !== "unknown");
  if (classification.run_index !== null) parts.push(`run ${classification.run_index}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function mergeClassification(
  current: RunOverlayEntry["classification"],
  patch: RunOverlayPatch["classification"],
): RunOverlayEntry["classification"] {
  if (patch === null) return null;
  if (patch === undefined) return current;
  const base = current ?? {
    line: "unknown",
    experiment: "unknown",
    run_index: null,
    display_label: "",
    legacy_approach: null,
  };
  const merged = {
    line: patch.line ?? base.line,
    experiment: patch.experiment ?? base.experiment,
    run_index: patch.run_index !== undefined ? patch.run_index : base.run_index,
    display_label: patch.display_label ?? base.display_label,
    legacy_approach:
      patch.legacy_approach !== undefined ? patch.legacy_approach ?? null : base.legacy_approach ?? null,
  };
  if (!merged.display_label.trim()) {
    merged.display_label = buildDisplayLabel(merged) ?? "unknown";
  }
  return merged;
}

function validateRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 10) {
    throw new Error("app_rating must be a number from 0 to 10, or null");
  }
  return Math.round(num);
}

export function validateOverlayPatch(patch: RunOverlayPatch): void {
  if (patch.human?.app_rating !== undefined) {
    validateRating(patch.human.app_rating);
  }
  if (patch.author !== undefined && patch.author !== null && patch.author.length > 120) {
    throw new Error("author must be 120 characters or fewer");
  }
  for (const field of ["app_comment", "run_comment"] as const) {
    const value = patch.human?.[field];
    if (value !== undefined && value.length > 4000) {
      throw new Error(`${field} must be 4000 characters or fewer`);
    }
  }
}

export async function patchRunOverlay(
  repoRoot: string,
  runId: string,
  patch: RunOverlayPatch,
): Promise<RunOverlayEntry> {
  validateOverlayPatch(patch);
  const filePath = overlayFilePath(repoRoot);
  const file = await readOverlayFile(repoRoot, true);
  const current = file.runs[runId] ?? emptyOverlayEntry();

  const author =
    patch.author !== undefined
      ? patch.author?.trim() || null
      : current.author;
  if (author && !file.authors.includes(author)) {
    file.authors.push(author);
    file.authors.sort((a, b) => a.localeCompare(b));
  }

  const human = {
    app_rating:
      patch.human?.app_rating !== undefined
        ? validateRating(patch.human.app_rating)
        : current.human.app_rating,
    app_comment: patch.human?.app_comment !== undefined ? patch.human.app_comment : current.human.app_comment,
    run_comment: patch.human?.run_comment !== undefined ? patch.human.run_comment : current.human.run_comment,
  };

  const flags = {
    ...current.flags,
    ...(patch.flags ?? {}),
  };

  const explicitExperimentId = patch.experiment_id !== undefined;
  let experimentId =
    patch.experiment_id !== undefined ? patch.experiment_id?.trim() || null : current.experiment_id;

  if (!explicitExperimentId && patch.classification?.experiment) {
    const slug = patch.classification.experiment.trim();
    if (slug && slug !== "unknown") {
      const experimentRecord = await getExperiment(repoRoot, slug);
      if (experimentRecord) {
        experimentId = slug;
      } else {
        await appendExperimentToOverlayTaxonomy(repoRoot, slug);
      }
    }
  }

  if (explicitExperimentId && experimentId) {
    validateExperimentId(experimentId);
    const experimentRecord = await getExperiment(repoRoot, experimentId);
    if (!experimentRecord) {
      throw new Error(`Unknown experiment: ${experimentId}`);
    }
    await appendExperimentToOverlayTaxonomy(repoRoot, experimentId);
  }

  let classification = mergeClassification(current.classification, patch.classification);
  if (experimentId) {
    classification = mergeClassification(classification, { experiment: experimentId });
  }

  const next: RunOverlayEntry = {
    author,
    git_branch: patch.git_branch !== undefined ? patch.git_branch : current.git_branch,
    git_commit: patch.git_commit !== undefined ? patch.git_commit : current.git_commit,
    experiment_id: experimentId,
    classification,
    human,
    flags,
    updated_at: new Date().toISOString(),
  };

  file.runs[runId] = next;
  file.updated_at = next.updated_at;
  await writeOverlayAtomic(filePath, file);
  return next;
}

export async function writeOverlayFile(repoRoot: string, file: RunsOverlayFile): Promise<void> {
  const normalized = normalizeOverlayFile(file);
  normalized.updated_at = new Date().toISOString();
  await writeOverlayAtomic(overlayFilePath(repoRoot), normalized);
}

export interface ClassificationSeedEntry {
  classification?: {
    line?: string;
    experiment?: string;
    run_index?: number | null;
    display_label?: string;
    legacy_approach?: string | null;
  };
  human?: {
    app_rating?: number | null;
    app_comment?: string | null;
    run_comment?: string | null;
  };
  flags?: Partial<RunOverlayEntry["flags"]>;
  source?: {
    git_branch?: string | null;
    git_commit?: string | null;
  };
}

export function overlayEntryFromSeed(runId: string, seed: ClassificationSeedEntry): RunOverlayEntry {
  const classification = seed.classification
    ? {
        line: seed.classification.line ?? "unknown",
        experiment: seed.classification.experiment ?? "unknown",
        run_index: seed.classification.run_index ?? null,
        display_label: seed.classification.display_label ?? "",
        legacy_approach: seed.classification.legacy_approach ?? null,
      }
    : null;
  if (classification && !classification.display_label.trim()) {
    classification.display_label = buildDisplayLabel(classification) ?? "unknown · unknown";
  }

  return {
    author: null,
    git_branch: seed.source?.git_branch ?? null,
    git_commit: seed.source?.git_commit ?? null,
    experiment_id: null,
    classification,
    human: {
      app_rating: seed.human?.app_rating ?? null,
      app_comment: seed.human?.app_comment ?? "",
      run_comment: seed.human?.run_comment ?? "",
    },
    flags: {
      ...emptyFlags(),
      ...(seed.flags ?? {}),
    },
    updated_at: new Date(0).toISOString(),
  };
}

export function mergeSeedIntoOverlay(
  file: RunsOverlayFile,
  seeds: Record<string, ClassificationSeedEntry>,
): { inserted: number; skipped: number } {
  let inserted = 0;
  let skipped = 0;
  for (const [runId, seed] of Object.entries(seeds)) {
    if (file.runs[runId]) {
      skipped += 1;
      continue;
    }
    file.runs[runId] = overlayEntryFromSeed(runId, seed);
    inserted += 1;
  }
  return { inserted, skipped };
}
