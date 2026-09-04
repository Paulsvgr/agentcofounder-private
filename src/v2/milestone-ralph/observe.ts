import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isTestFilePath } from "../source-paths.js";
import { normalizePartialResult } from "../../result.js";

export interface WorkspaceObservation {
  sourceFiles: string[];
  productTestFiles: string[];
  hasReportPartial: boolean;
  reportStatus: "success" | "partial" | "failed" | null;
  implementedFeatures: string[];
  /** Mutable-data layout signals for continue/repair quality passes. */
  hasDomainModule: boolean;
  hasStorageModule: boolean;
  hasComponentModules: boolean;
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

export function isProductTestFile(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (!isTestFilePath(posix)) return false;
  if (/(^|\/)src\/test\/setup\.[tj]sx?$/.test(posix)) return false;
  return posix.startsWith("src/") && /\.test\.[tj]sx?$/.test(posix);
}

export function isDomainModulePath(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (!posix.startsWith("src/") || isProductTestFile(posix)) return false;
  return /(^|\/)src\/domain\//.test(posix) || /(^|\/)domain\.[tj]sx?$/.test(posix);
}

export function isStorageModulePath(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (!posix.startsWith("src/") || isProductTestFile(posix)) return false;
  return (
    /(^|\/)src\/storage\//.test(posix) ||
    /Repository\.[tj]sx?$/.test(posix) ||
    /(^|\/)repository\.[tj]sx?$/.test(posix)
  );
}

export function isComponentModulePath(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (!posix.startsWith("src/") || isProductTestFile(posix)) return false;
  return /(^|\/)src\/components\//.test(posix);
}

export function qualityGapLines(observation: WorkspaceObservation): string[] {
  const gaps: string[] = [];
  if (observation.productTestFiles.length === 0) return gaps;
  if (!observation.hasDomainModule) {
    gaps.push("- Missing src/domain/ (or domain module): extract types and pure operations out of App.tsx.");
  }
  if (!observation.hasStorageModule) {
    gaps.push(
      "- Missing src/storage/ repository: move localStorage load/save out of components into a repository module.",
    );
  }
  if (!observation.hasComponentModules) {
    gaps.push("- Missing src/components/: split focused UI pieces out of App.tsx.");
  }
  gaps.push(
    "- Keep the suite lean (≤10 UI journeys). Prefer combining assertions over adding tests. Skip new domain/repo unit suites.",
  );
  gaps.push(
    "- Only if missing: visible validation + aria-invalid; confirm-before-delete; one persistence robustness path; +/- interaction-stability in an existing multi-item test.",
  );
  return gaps;
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
  const directory = relative === "" ? root : path.join(root, relative);
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, child)));
    } else if (entry.isFile()) {
      files.push(toPosix(child));
    }
  }
  return files;
}

export async function observeWorkspace(appDirectory: string): Promise<WorkspaceObservation> {
  const listed = await listFiles(appDirectory);
  const sourceFiles = listed
    .filter(
      (relative) => relative.startsWith("src/") || relative === "index.html" || relative.endsWith(".json"),
    )
    .sort();
  const productTestFiles = sourceFiles.filter((file) => isProductTestFile(file));
  const hasDomainModule = sourceFiles.some((file) => isDomainModulePath(file));
  const hasStorageModule = sourceFiles.some((file) => isStorageModulePath(file));
  const hasComponentModules = sourceFiles.some((file) => isComponentModulePath(file));

  let hasReportPartial = false;
  let reportStatus: WorkspaceObservation["reportStatus"] = null;
  let implementedFeatures: string[] = [];
  try {
    const raw = JSON.parse(await readFile(path.join(appDirectory, "report.partial.json"), "utf8")) as unknown;
    const normalized = normalizePartialResult(raw);
    hasReportPartial = normalized !== undefined;
    reportStatus = normalized?.status ?? null;
    implementedFeatures = normalized?.implemented_features ?? [];
  } catch {
    hasReportPartial = false;
  }

  return {
    sourceFiles,
    productTestFiles,
    hasReportPartial,
    reportStatus,
    implementedFeatures,
    hasDomainModule,
    hasStorageModule,
    hasComponentModules,
  };
}
