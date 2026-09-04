/**
 * Pre-green single-test budget v1 — at most one src/ *.test.* file until VERIFY PASS.
 * Flag: HARNESS_PRE_GREEN_SINGLE_TEST_V1 (default OFF).
 *
 * Distinct from Q2-E: no skeleton seed, no +1 it() delta, no post-tool restore.
 * Distinct from max_tokens caps: cheap paths also use ~3k App.tsx writes.
 */

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  extractBashNewSurfaceDestinations,
  isVerifyPassText,
  normalizeRelativePath,
} from "./repair-surface-lock-core.js";

export const PRE_GREEN_SINGLE_TEST_V1_SCHEMA =
  "agentcofounder.pre_green_single_test.v1" as const;
export const PRE_GREEN_SINGLE_TEST_EXPORT_FILENAME = "pre-green-single-test.v1.json";

export function preGreenSingleTestV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.HARNESS_PRE_GREEN_SINGLE_TEST_V1;
  if (raw === undefined || raw.trim() === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/** Agent-authored test files under src/ (not harness tests under test/). */
export function isAgentTestPath(relativePath: string): boolean {
  const p = normalizeRelativePath(relativePath);
  if (!p.startsWith("src/")) return false;
  return /\.test\.(ts|tsx|js|jsx)$/i.test(p);
}

export function listAgentTestFiles(appRoot: string): string[] {
  const out: string[] = [];
  const srcRoot = path.join(appRoot, "src");
  if (!existsSync(srcRoot)) return out;

  const walk = (absDir: string, relDir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(absDir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === "dist") continue;
      const abs = path.join(absDir, name);
      const rel = relDir ? `${relDir}/${name}` : name;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (st.isFile() && isAgentTestPath(rel)) {
        out.push(normalizeRelativePath(rel));
      }
    }
  };

  walk(srcRoot, "src");
  return out.sort();
}

export function formatPreGreenSingleTestBlockReason(
  attempted: string,
  allowed: string,
): string {
  const a = normalizeRelativePath(attempted);
  const b = normalizeRelativePath(allowed);
  return (
    `PRE_GREEN_SINGLE_TEST: only one src/ *.test.* file is allowed before VERIFY PASS. ` +
    `\`${b}\` is already the test file. Put journeys there (or edit it). ` +
    `Creating \`${a}\` is blocked until green.`
  );
}

export interface PreGreenSingleTestExport {
  schema: typeof PRE_GREEN_SINGLE_TEST_V1_SCHEMA;
  run_id: string | null;
  active: boolean;
  unlocked: boolean;
  allowed_test_file: string | null;
  existing_at_start: string[];
  blocks: Array<{ tool: string; path: string; reason: string }>;
  timestamp: string | null;
}

export function createEmptyPreGreenSingleTestExport(
  runId: string | null = null,
): PreGreenSingleTestExport {
  return {
    schema: PRE_GREEN_SINGLE_TEST_V1_SCHEMA,
    run_id: runId,
    active: false,
    unlocked: false,
    allowed_test_file: null,
    existing_at_start: [],
    blocks: [],
    timestamp: null,
  };
}

export function resolvePreGreenSingleTestExportPath(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, PRE_GREEN_SINGLE_TEST_EXPORT_FILENAME);
}

export function resolvePreGreenSingleTestRunId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.basename(artifactDir);
}

export function writePreGreenSingleTestExport(
  exportPath: string,
  payload: PreGreenSingleTestExport,
): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

let active = false;
let unlocked = false;
let allowedTestFile: string | null = null;
let exportRecord: PreGreenSingleTestExport = createEmptyPreGreenSingleTestExport();

export function resetPreGreenSingleTestState(): void {
  active = false;
  unlocked = false;
  allowedTestFile = null;
  exportRecord = createEmptyPreGreenSingleTestExport(resolvePreGreenSingleTestRunId());
  persistExport();
}

export function isPreGreenSingleTestActive(): boolean {
  return active && !unlocked;
}

export function getAllowedPreGreenTestFile(): string | null {
  return allowedTestFile;
}

export function getPreGreenSingleTestExport(): PreGreenSingleTestExport {
  return exportRecord;
}

function persistExport(): void {
  const exportPath = resolvePreGreenSingleTestExportPath();
  if (!exportPath) return;
  writePreGreenSingleTestExport(exportPath, exportRecord);
}

/** Call at session start: latch any existing single test file as the allowed path. */
export function engagePreGreenSingleTestOnSessionStart(appRoot: string): void {
  if (!preGreenSingleTestV1EnabledFromEnvironment()) return;
  active = true;
  unlocked = false;
  const existing = listAgentTestFiles(appRoot);
  exportRecord.active = true;
  exportRecord.existing_at_start = existing;
  exportRecord.timestamp = new Date().toISOString();
  if (existing.length === 1) {
    allowedTestFile = existing[0]!;
    exportRecord.allowed_test_file = allowedTestFile;
  } else if (existing.length > 1) {
    // Already over budget at start: freeze the first (sorted) as allowed; block others as new.
    allowedTestFile = existing[0]!;
    exportRecord.allowed_test_file = allowedTestFile;
  } else {
    allowedTestFile = null;
    exportRecord.allowed_test_file = null;
  }
  persistExport();
}

export function releasePreGreenSingleTestOnVerifyPass(verifyText: string): void {
  if (!preGreenSingleTestV1EnabledFromEnvironment()) return;
  if (!isVerifyPassText(verifyText)) return;
  if (!active || unlocked) return;
  unlocked = true;
  exportRecord.unlocked = true;
  persistExport();
}

export function evaluatePreGreenSingleTestWriteBlock(
  relativePath: string,
  toolName: string,
  appRoot?: string,
): { block: true; reason: string } | undefined {
  if (!isPreGreenSingleTestActive()) return undefined;
  const p = normalizeRelativePath(relativePath);
  if (!isAgentTestPath(p)) return undefined;

  // Refresh from disk so external creates are visible.
  if (appRoot) {
    const onDisk = listAgentTestFiles(appRoot);
    if (allowedTestFile === null && onDisk.length === 1 && onDisk[0] !== p) {
      allowedTestFile = onDisk[0]!;
      exportRecord.allowed_test_file = allowedTestFile;
      persistExport();
    }
  }

  if (allowedTestFile === null) {
    allowedTestFile = p;
    exportRecord.allowed_test_file = p;
    persistExport();
    return undefined;
  }

  if (p === allowedTestFile) return undefined;

  // Edits to other test files that already exist (rare over-budget start) stay allowed.
  if (appRoot && existsSync(path.join(appRoot, ...p.split("/")))) {
    return undefined;
  }

  const reason = formatPreGreenSingleTestBlockReason(p, allowedTestFile);
  exportRecord.blocks.push({ tool: toolName, path: p, reason });
  persistExport();
  return { block: true, reason };
}

export function evaluatePreGreenSingleTestBashBlock(
  command: string,
  appRoot?: string,
): { block: true; reason: string } | undefined {
  if (!isPreGreenSingleTestActive()) return undefined;
  for (const dest of extractBashNewSurfaceDestinations(command)) {
    if (!isAgentTestPath(dest)) continue;
    const blocked = evaluatePreGreenSingleTestWriteBlock(dest, "bash", appRoot);
    if (blocked) return blocked;
  }
  return undefined;
}
