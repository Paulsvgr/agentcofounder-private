import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assembleTemplate,
  resolveTemplateOverlayConfigFromEnvironment,
  type AssemblyRecord,
  type TemplateOverlayConfig,
} from "./v2/template-overlays.js";

export const APP_OUTPUT_MARKER = ".agent-cofounder-output";
export const APP_OUTPUT_MARKER_CONTENT = "managed by agent-cofounder-starter\n";

const MARKER = APP_OUTPUT_MARKER;
const NODE_MODULES_REUSE_ROOT = ".node_modules_reuse";

/** Harness-only live reporter / self-tests — never ship into product VERIFY. */
export function isHarnessSelfTestFileName(fileName: string): boolean {
  if (!/\.(ts|tsx|js|jsx)$/i.test(fileName)) return false;
  return /compact-failure|harness-owned|self-test/i.test(fileName);
}

/**
 * Remove harness self-tests from a prepared app (natural and seeded).
 * Returns relative paths that were removed (posix-style under app root).
 */
export async function stripHarnessSelfTestsFromPreparedApp(
  appRoot: string,
): Promise<string[]> {
  const removed: string[] = [];
  const testDir = path.join(appRoot, "test");
  let names: string[];
  try {
    names = await readdir(testDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return removed;
    throw error;
  }
  for (const name of names) {
    if (!isHarnessSelfTestFileName(name)) continue;
    await rm(path.join(testDir, name), { force: true });
    removed.push(`test/${name}`);
  }
  return removed;
}

export function appTemplateCopyFilter(source: string): boolean {
  return !source.split(path.sep).includes("node_modules") && !source.endsWith(`${path.sep}dist`);
}

export async function copyAppTemplateTree(
  sourceDirectory: string,
  destinationDirectory: string,
  options?: { writeMarker?: boolean },
): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  await cp(sourceDirectory, destinationDirectory, {
    recursive: true,
    filter: appTemplateCopyFilter,
  });
  if (options?.writeMarker ?? true) {
    await writeFile(path.join(destinationDirectory, MARKER), APP_OUTPUT_MARKER_CONTENT, "utf8");
  }
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function packageLockSha256(lockfileContents: string): string {
  return createHash("sha256").update(lockfileContents).digest("hex");
}

async function stashNodeModulesForReuse(
  outputRoot: string,
  outputDirectory: string,
): Promise<void> {
  const nodeModules = path.join(outputDirectory, "node_modules");
  const lockPath = path.join(outputDirectory, "package-lock.json");
  let lockContents: string;
  try {
    await lstat(nodeModules);
    lockContents = await readFile(lockPath, "utf8");
  } catch {
    return;
  }
  const hash = packageLockSha256(lockContents);
  const stashDir = path.join(outputRoot, NODE_MODULES_REUSE_ROOT, hash);
  const stashModules = path.join(stashDir, "node_modules");
  await mkdir(stashDir, { recursive: true });
  await rm(stashModules, { recursive: true, force: true });
  await rename(nodeModules, stashModules);
  await writeFile(path.join(stashDir, "package-lock.json"), lockContents, "utf8");
}

async function restoreNodeModulesIfLockMatches(
  outputRoot: string,
  outputDirectory: string,
): Promise<boolean> {
  const lockPath = path.join(outputDirectory, "package-lock.json");
  let lockContents: string;
  try {
    lockContents = await readFile(lockPath, "utf8");
  } catch {
    return false;
  }
  const hash = packageLockSha256(lockContents);
  const stashModules = path.join(outputRoot, NODE_MODULES_REUSE_ROOT, hash, "node_modules");
  try {
    await lstat(stashModules);
  } catch {
    return false;
  }
  await rename(stashModules, path.join(outputDirectory, "node_modules"));
  return true;
}

export interface PreparedOutput {
  outputDirectory: string;
  assemblyRecord: AssemblyRecord;
  /** True when node_modules was restored from a same-lockfile stash (skip npm ci). */
  reusedNodeModules: boolean;
}

export async function prepareOutput(
  repositoryRoot: string,
  requestedOutputDirectory: string,
  requestedOverlayConfig?: TemplateOverlayConfig,
): Promise<PreparedOutput> {
  const outputRoot = path.resolve(repositoryRoot, "output");
  const outputDirectory = path.resolve(repositoryRoot, requestedOutputDirectory);
  if (!isInside(outputRoot, outputDirectory)) {
    throw new Error(`Output directory must be a child of ${outputRoot}`);
  }

  for (const staleResult of [
    path.join(repositoryRoot, "result.json"),
    path.join(outputRoot, "result.json"),
  ]) {
    try {
      await unlink(staleResult);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  let outputExists = false;
  try {
    const stat = await lstat(outputDirectory);
    outputExists = true;
    if (stat.isSymbolicLink()) throw new Error("Refusing to reset a symbolic-link output directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (outputExists) {
    let marker: string;
    try {
      marker = await readFile(path.join(outputDirectory, MARKER), "utf8");
    } catch {
      throw new Error(`Refusing to reset unrecognized directory: ${outputDirectory}`);
    }
    if (marker.trim() !== "managed by agent-cofounder-starter") {
      throw new Error(`Refusing to reset unrecognized directory: ${outputDirectory}`);
    }
    await stashNodeModulesForReuse(outputRoot, outputDirectory);
    await rm(outputDirectory, { recursive: true });
  }

  const overlayConfig = requestedOverlayConfig ?? resolveTemplateOverlayConfigFromEnvironment();
  const assemblyRecord = await assembleTemplate(overlayConfig, repositoryRoot, outputDirectory);
  await writeFile(path.join(outputDirectory, MARKER), APP_OUTPUT_MARKER_CONTENT, "utf8");
  const reusedNodeModules = await restoreNodeModulesIfLockMatches(outputRoot, outputDirectory);
  await stripHarnessSelfTestsFromPreparedApp(outputDirectory);
  return { outputDirectory, assemblyRecord, reusedNodeModules };
}
