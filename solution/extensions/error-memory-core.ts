/**
 * Error Memory v1 — deterministic local lookup on VERIFY FAIL.
 * No LLM. Appends at most one short hint per error family per run into the
 * existing VERIFY tool result (same pattern as convergence intervention).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ERROR_MEMORY_V1_SCHEMA = "agentcofounder.error_memory.v1" as const;

export interface ErrorMemoryEntry {
  family: string;
  signals: string[];
  /** Optional second gate: at least one of these must also appear in the FAIL text. */
  require_any?: string[];
  cause: string;
  hint: string;
  verified_count: number;
}

export interface ErrorMemoryCatalog {
  version: string;
  entries: ErrorMemoryEntry[];
}

export interface ErrorMemoryHit {
  family: string;
  cause: string;
  hint: string;
}

export interface ErrorMemoryHintEvent {
  verify_ordinal: number;
  family: string;
  delivery: "appended_to_verify_result";
  exit_code: number;
}

export interface ErrorMemoryPassEvent {
  verify_ordinal: number;
  families_hinted_before_pass: string[];
}

export interface ErrorMemoryExportRecord {
  schema: typeof ERROR_MEMORY_V1_SCHEMA;
  enabled: boolean;
  catalog_version: string;
  verify_fail_count: number;
  verify_pass_count: number;
  hints_appended: ErrorMemoryHintEvent[];
  families_hinted: string[];
  pass_after_hint: ErrorMemoryPassEvent[];
}

interface ErrorMemorySession {
  hintedFamilies: Set<string>;
  pendingHintedFamilies: string[];
  verifyOrdinal: number;
  exportRecord: ErrorMemoryExportRecord;
}

let activeSession: ErrorMemorySession | null = null;
let cachedCatalog: ErrorMemoryCatalog | null = null;

export function errorMemoryV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_ERROR_MEMORY_V1;
  if (raw === undefined || raw.trim() === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function defaultCatalogPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "error-memory", "v1", "entries.json");
}

export function loadErrorMemoryCatalog(catalogPath = defaultCatalogPath()): ErrorMemoryCatalog {
  if (cachedCatalog && catalogPath === defaultCatalogPath()) {
    return cachedCatalog;
  }
  const raw = readFileSync(catalogPath, "utf8");
  const parsed = JSON.parse(raw) as ErrorMemoryCatalog;
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error(`Invalid error-memory catalog at ${catalogPath}`);
  }
  if (catalogPath === defaultCatalogPath()) {
    cachedCatalog = parsed;
  }
  return parsed;
}

/** Test helper — clear cached catalog between unit tests. */
export function clearErrorMemoryCatalogCache(): void {
  cachedCatalog = null;
}

export function createEmptyErrorMemoryExport(
  catalogVersion: string,
  enabled: boolean,
): ErrorMemoryExportRecord {
  return {
    schema: ERROR_MEMORY_V1_SCHEMA,
    enabled,
    catalog_version: catalogVersion,
    verify_fail_count: 0,
    verify_pass_count: 0,
    hints_appended: [],
    families_hinted: [],
    pass_after_hint: [],
  };
}

export function resetErrorMemorySession(catalog?: ErrorMemoryCatalog): void {
  const cat = catalog ?? (errorMemoryV1EnabledFromEnvironment() ? loadErrorMemoryCatalog() : null);
  activeSession = {
    hintedFamilies: new Set(),
    pendingHintedFamilies: [],
    verifyOrdinal: 0,
    exportRecord: createEmptyErrorMemoryExport(cat?.version ?? "none", errorMemoryV1EnabledFromEnvironment()),
  };
}

export function getErrorMemorySession(): ErrorMemorySession | null {
  return activeSession;
}

export function entryMatchesFailText(entry: ErrorMemoryEntry, failText: string): boolean {
  const signalHit = entry.signals.some((signal) => failText.includes(signal));
  if (!signalHit) return false;
  if (!entry.require_any || entry.require_any.length === 0) return true;
  return entry.require_any.some((token) => failText.toLowerCase().includes(token.toLowerCase()));
}

export function matchErrorMemoryEntries(
  failText: string,
  catalog: ErrorMemoryCatalog,
  alreadyHinted: ReadonlySet<string>,
): ErrorMemoryHit[] {
  const hits: ErrorMemoryHit[] = [];
  for (const entry of catalog.entries) {
    if (alreadyHinted.has(entry.family)) continue;
    if (!entryMatchesFailText(entry, failText)) continue;
    hits.push({
      family: entry.family,
      cause: entry.cause,
      hint: entry.hint,
    });
  }
  return hits;
}

export function formatErrorMemoryHintBlock(hits: ErrorMemoryHit[]): string {
  if (hits.length === 0) return "";
  const blocks = hits.map((hit) =>
    [
      `KNOWN ERROR MEMORY (${hit.family})`,
      `CAUSE: ${hit.cause}`,
      `VERIFIED PATTERN: ${hit.hint}`,
    ].join("\n"),
  );
  return ["", "---", ...blocks, "---"].join("\n");
}

export function resolveErrorMemoryExportPath(cwd = process.cwd()): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR?.trim();
  if (artifactDir) {
    return path.join(artifactDir, "error-memory.v1.json");
  }
  // Fallback when artifact dir is unset (unit tests / local probes).
  return path.join(cwd, "error-memory.v1.json");
}

export function writeErrorMemoryExport(
  exportPath: string,
  record: ErrorMemoryExportRecord,
): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

/**
 * Append known-error hints to VERIFY FAIL output. No-op when disabled or PASS.
 * One hint delivery per family per run.
 */
export function processCanonicalVerifyForErrorMemory(
  formattedVerifyText: string,
  exitCode: number,
  catalog?: ErrorMemoryCatalog,
): string {
  if (!errorMemoryV1EnabledFromEnvironment()) {
    return formattedVerifyText;
  }

  if (!activeSession) {
    resetErrorMemorySession(catalog);
  }
  const session = activeSession!;
  session.verifyOrdinal += 1;

  const cat = catalog ?? loadErrorMemoryCatalog();
  session.exportRecord.catalog_version = cat.version;

  if (exitCode === 0) {
    session.exportRecord.verify_pass_count += 1;
    if (session.pendingHintedFamilies.length > 0) {
      session.exportRecord.pass_after_hint.push({
        verify_ordinal: session.verifyOrdinal,
        families_hinted_before_pass: [...session.pendingHintedFamilies],
      });
      session.pendingHintedFamilies = [];
    }
    persistExport(session);
    return formattedVerifyText;
  }

  session.exportRecord.verify_fail_count += 1;
  const hits = matchErrorMemoryEntries(
    formattedVerifyText,
    cat,
    session.hintedFamilies,
  );

  if (hits.length === 0) {
    persistExport(session);
    return formattedVerifyText;
  }

  for (const hit of hits) {
    session.hintedFamilies.add(hit.family);
    if (!session.exportRecord.families_hinted.includes(hit.family)) {
      session.exportRecord.families_hinted.push(hit.family);
    }
    session.pendingHintedFamilies.push(hit.family);
    session.exportRecord.hints_appended.push({
      verify_ordinal: session.verifyOrdinal,
      family: hit.family,
      delivery: "appended_to_verify_result",
      exit_code: exitCode,
    });
  }

  persistExport(session);
  return `${formattedVerifyText}${formatErrorMemoryHintBlock(hits)}`;
}

function persistExport(session: ErrorMemorySession): void {
  const exportPath = resolveErrorMemoryExportPath();
  if (!exportPath) return;
  writeErrorMemoryExport(exportPath, session.exportRecord);
}
