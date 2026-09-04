/**
 * Repair-surface lock v1 — after first VERIFY FAIL, freeze file set; block new files.
 * Flag: HARNESS_REPAIR_SURFACE_LOCK_V1 (default OFF).
 *
 * Mechanical constraint: edit existing paths freely; do not create new product/test files.
 */

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REPAIR_SURFACE_LOCK_V1_SCHEMA =
  "agentcofounder.repair_surface_lock.v1" as const;
export const REPAIR_SURFACE_LOCK_EXPORT_FILENAME = "repair-surface-lock.v1.json";

export function repairSurfaceLockV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.HARNESS_REPAIR_SURFACE_LOCK_V1;
  if (raw === undefined || raw.trim() === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath
    .split(path.sep)
    .join("/")
    .replace(/^\.\/+/, "")
    .replace(/^\.\\+/, "");
}

/** Paths the agent may always create/write even while locked. */
export function isAlwaysAllowedWritePath(relativePath: string): boolean {
  const p = normalizeRelativePath(relativePath);
  return p === "report.partial.json" || p === "result.json";
}

/** Product / test source that counts as implementation surface. */
export function isSurfacePath(relativePath: string): boolean {
  const p = normalizeRelativePath(relativePath);
  if (isAlwaysAllowedWritePath(p)) return false;
  if (!(p.startsWith("src/") || p.startsWith("test/"))) return false;
  return /\.(ts|tsx|js|jsx|css)$/i.test(p);
}

export function listSurfaceFiles(appRoot: string): string[] {
  const roots = ["src", "test"];
  const out: string[] = [];

  const walk = (absDir: string, relDir: string): void => {
    if (!existsSync(absDir)) return;
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
      if (st.isFile() && isSurfacePath(rel)) {
        out.push(normalizeRelativePath(rel));
      }
    }
  };

  for (const root of roots) {
    walk(path.join(appRoot, root), root);
  }
  return out.sort();
}

export function isVerifyFailText(text: string): boolean {
  return /exit_code=(?!0)\d+\s*\(FAIL\)/.test(text) || /❌\s*FAIL/.test(text);
}

export function isVerifyPassText(text: string): boolean {
  return /exit_code=0 \(PASS\)/.test(text) || /✅\s*PASS/.test(text);
}

export function formatRepairSurfaceLockBlock(fileCount: number): string {
  return [
    "REPAIR_SURFACE_LOCK",
    `First VERIFY FAIL — frozen ${fileCount} existing source file(s).`,
    "Repair those files only. Creating new product/test files is blocked until green.",
  ].join("\n");
}

export function repairSurfaceNewFileBlockReason(relativePath: string): string {
  const p = normalizeRelativePath(relativePath);
  return (
    `REPAIR_SURFACE_LOCK: first VERIFY already FAIL. ` +
    `Creating new file \`${p}\` is blocked. Edit an existing source file to repair, then call verify.`
  );
}

export interface RepairSurfaceLockExport {
  schema: typeof REPAIR_SURFACE_LOCK_V1_SCHEMA;
  run_id: string | null;
  locked: boolean;
  locked_at_verify_fail: boolean;
  frozen_file_count: number;
  frozen_files: string[];
  blocks: Array<{ tool: string; path: string; reason: string }>;
  unlock_on_pass: boolean;
  unlocked: boolean;
  timestamp: string | null;
}

export function createEmptyRepairSurfaceLockExport(
  runId: string | null = null,
): RepairSurfaceLockExport {
  return {
    schema: REPAIR_SURFACE_LOCK_V1_SCHEMA,
    run_id: runId,
    locked: false,
    locked_at_verify_fail: false,
    frozen_file_count: 0,
    frozen_files: [],
    blocks: [],
    unlock_on_pass: true,
    unlocked: false,
    timestamp: null,
  };
}

export function resolveRepairSurfaceLockExportPath(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, REPAIR_SURFACE_LOCK_EXPORT_FILENAME);
}

export function resolveRepairSurfaceLockRunId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.basename(artifactDir);
}

export function writeRepairSurfaceLockExport(
  exportPath: string,
  payload: RepairSurfaceLockExport,
): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** Process-local lock state for the active Pi session. */
let locked = false;
let unlockedAfterPass = false;
let frozenFiles = new Set<string>();
let exportRecord: RepairSurfaceLockExport = createEmptyRepairSurfaceLockExport();

export function resetRepairSurfaceLockState(): void {
  locked = false;
  unlockedAfterPass = false;
  frozenFiles = new Set();
  exportRecord = createEmptyRepairSurfaceLockExport(resolveRepairSurfaceLockRunId());
  persistExport();
}

export function isRepairSurfaceLocked(): boolean {
  return locked && !unlockedAfterPass;
}

export function getFrozenSurfaceFiles(): ReadonlySet<string> {
  return frozenFiles;
}

export function getRepairSurfaceLockExport(): RepairSurfaceLockExport {
  return exportRecord;
}

function persistExport(): void {
  const exportPath = resolveRepairSurfaceLockExportPath();
  if (!exportPath) return;
  writeRepairSurfaceLockExport(exportPath, exportRecord);
}

/**
 * On first VERIFY FAIL: snapshot surface files and engage lock.
 * Returns factual block text to append to verify output (or null if unchanged).
 */
export function engageRepairSurfaceLockOnVerifyFail(
  appRoot: string,
  verifyText: string,
): string | null {
  if (!repairSurfaceLockV1EnabledFromEnvironment()) return null;
  if (!isVerifyFailText(verifyText)) return null;
  if (locked || unlockedAfterPass) return null;

  const files = listSurfaceFiles(appRoot);
  frozenFiles = new Set(files);
  locked = true;
  exportRecord.locked = true;
  exportRecord.locked_at_verify_fail = true;
  exportRecord.frozen_files = files;
  exportRecord.frozen_file_count = files.length;
  exportRecord.timestamp = new Date().toISOString();
  persistExport();

  return formatRepairSurfaceLockBlock(files.length);
}

/** Release lock after VERIFY PASS so post-green work is unconstrained by this flag. */
export function releaseRepairSurfaceLockOnVerifyPass(verifyText: string): void {
  if (!repairSurfaceLockV1EnabledFromEnvironment()) return;
  if (!isVerifyPassText(verifyText)) return;
  if (!locked) return;
  unlockedAfterPass = true;
  exportRecord.unlocked = true;
  persistExport();
}

export function evaluateRepairSurfaceWriteBlock(
  relativePath: string,
  toolName: string,
): { block: true; reason: string } | undefined {
  if (!isRepairSurfaceLocked()) return undefined;
  const p = normalizeRelativePath(relativePath);
  if (isAlwaysAllowedWritePath(p)) return undefined;
  if (!isSurfacePath(p)) return undefined;
  if (frozenFiles.has(p)) return undefined;
  const reason = repairSurfaceNewFileBlockReason(p);
  exportRecord.blocks.push({ tool: toolName, path: p, reason });
  persistExport();
  return { block: true, reason };
}

/**
 * Detect new surface destinations in bash (mv/cp/touch/redirects).
 * For mv/cp, the last src|test path token is treated as the destination.
 */
export function extractBashNewSurfaceDestinations(command: string): string[] {
  const destinations: string[] = [];
  const mvCp =
    /(?:^|[;&|\n]\s*)(?:mv|cp)\b([^;&|\n]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = mvCp.exec(command)) !== null) {
    const args = match[1] ?? "";
    const paths = [...args.matchAll(/\b((?:\.\/)?(?:src|test)\/[^\s'"]+\.(?:ts|tsx|js|jsx|css))\b/gi)].map(
      (m) => normalizeRelativePath(m[1] ?? ""),
    );
    if (paths.length >= 1) {
      destinations.push(paths[paths.length - 1]!);
    }
  }
  const touch = command.match(
    /(?:^|[;&|\n]\s*)touch\b[^;&|\n]*?\b((?:\.\/)?(?:src|test)\/[^\s'"]+\.(?:ts|tsx|js|jsx|css))\b/i,
  );
  if (touch?.[1]) destinations.push(normalizeRelativePath(touch[1]));
  const redirect = command.match(
    /(?:>>|>)\s*['"]?((?:\.\/)?(?:src|test)\/[^'"\s]+\.(?:ts|tsx|js|jsx|css))/i,
  );
  if (redirect?.[1]) destinations.push(normalizeRelativePath(redirect[1]));
  // cat/tee ... file without redirect already covered; tee TARGET
  const tee = command.match(
    /(?:^|[;&|\n]\s*)tee\b[^;&|\n]*?\b((?:\.\/)?(?:src|test)\/[^\s'"]+\.(?:ts|tsx|js|jsx|css))\b/i,
  );
  if (tee?.[1]) destinations.push(normalizeRelativePath(tee[1]));
  return [...new Set(destinations)];
}

export function evaluateRepairSurfaceBashBlock(
  command: string,
): { block: true; reason: string } | undefined {
  if (!isRepairSurfaceLocked()) return undefined;
  for (const dest of extractBashNewSurfaceDestinations(command)) {
    const blocked = evaluateRepairSurfaceWriteBlock(dest, "bash");
    if (blocked) return blocked;
  }
  return undefined;
}

export function appendLockBlockToVerifyText(
  formattedVerifyText: string,
  lockBlock: string,
): string {
  const lines = formattedVerifyText.split("\n");
  const head = lines[0] ?? "";
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  const body = rest ? `${head}\n\n${lockBlock}\n\n${rest}` : `${head}\n\n${lockBlock}`;
  return body.trimEnd() + (formattedVerifyText.endsWith("\n") ? "\n" : "");
}
