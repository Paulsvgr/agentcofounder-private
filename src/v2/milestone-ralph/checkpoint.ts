import { cp, lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const PRESERVE = new Set(["node_modules", "dist"]);

export function checkpointCopyFilter(source: string): boolean {
  const parts = source.split(path.sep);
  if (parts.includes("node_modules")) return false;
  if (parts.includes("dist")) return false;
  return true;
}

export async function sealCheckpoint(appDirectory: string, checkpointDirectory: string): Promise<void> {
  await rm(checkpointDirectory, { recursive: true, force: true });
  await mkdir(checkpointDirectory, { recursive: true });
  await cp(appDirectory, checkpointDirectory, {
    recursive: true,
    filter: checkpointCopyFilter,
  });
}

async function removeExceptPreserved(directory: string): Promise<void> {
  let names: string[] = [];
  try {
    names = await readdir(directory);
  } catch {
    return;
  }
  for (const name of names) {
    if (PRESERVE.has(name)) continue;
    await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

export async function restoreCheckpoint(checkpointDirectory: string, appDirectory: string): Promise<void> {
  const stat = await lstat(checkpointDirectory);
  if (!stat.isDirectory()) {
    throw new Error(`Checkpoint is not a directory: ${checkpointDirectory}`);
  }
  await mkdir(appDirectory, { recursive: true });
  await removeExceptPreserved(appDirectory);
  await cp(checkpointDirectory, appDirectory, {
    recursive: true,
    filter: checkpointCopyFilter,
  });
}
