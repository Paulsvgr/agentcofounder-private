import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export function generatedAppCopyFilter(source: string): boolean {
  return !source.split(path.sep).includes("dist");
}

export async function snapshotGeneratedApp(
  sourceDirectory: string,
  destinationDirectory: string,
): Promise<void> {
  await rm(destinationDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDirectory), { recursive: true });
  await cp(sourceDirectory, destinationDirectory, {
    recursive: true,
    filter: generatedAppCopyFilter,
  });
}

export async function resolveSavedAppDirectory(
  savedAppsRoot: string,
  runId: string,
): Promise<string | null> {
  const { readdir, access } = await import("node:fs/promises");
  let names: string[] = [];
  try {
    names = await readdir(savedAppsRoot);
  } catch {
    return null;
  }
  const match = names.find((name) => name.endsWith(runId));
  if (!match) return null;
  const candidate = path.join(savedAppsRoot, match);
  try {
    await access(path.join(candidate, "package.json"));
    return candidate;
  } catch {
    return null;
  }
}
