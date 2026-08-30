import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { replayRun } from "../../scripts/replay-run.js";
import { resolveSavedAppDirectory } from "../../src/snapshot-generated-app.js";
import { isPortInUse } from "./port-check.js";
import { jobRegistry } from "./jobs.js";

const activeDevServers = new Map<string, { port: number; jobId: string }>();

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function isRunnableAppDirectory(candidate: string | null): Promise<boolean> {
  if (!candidate) return false;
  return pathExists(path.join(candidate, "package.json"));
}

export async function resolveRunAppDirectory(
  repoRoot: string,
  runId: string,
): Promise<string | null> {
  const runApp = path.join(repoRoot, "artifacts", "runs", runId, "app");
  if (await isRunnableAppDirectory(runApp)) return runApp;

  const savedApp = await resolveSavedAppDirectory(path.join(repoRoot, "saved-apps"), runId);
  if (await isRunnableAppDirectory(savedApp)) return savedApp;

  const replayApp = path.join(repoRoot, "artifacts", "replay", runId, "app");
  if (await isRunnableAppDirectory(replayApp)) return replayApp;

  return null;
}

export async function runHasGeneratedApp(repoRoot: string, runId: string): Promise<boolean> {
  return (await resolveRunAppDirectory(repoRoot, runId)) !== null;
}

export async function findFreePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port += 1) {
    if (!(await isPortInUse(port))) return port;
  }
  throw new Error(`No free port between ${start} and ${end}`);
}

async function waitForPort(port: number, timeoutMs = 45_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortInUse(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not start on port ${port}`);
}

async function ensureNodeModules(appDirectory: string): Promise<void> {
  if (await pathExists(path.join(appDirectory, "node_modules"))) return;
  const job = jobRegistry.spawnJob({
    kind: "app-dev",
    runId: null,
    command: "npm",
    args: ["ci", "--ignore-scripts", "--prefer-offline"],
    cwd: appDirectory,
  });
  await new Promise<void>((resolve, reject) => {
    const onDone = (jobId: string, status: string, exitCode: number | null): void => {
      if (jobId !== job.id) return;
      jobRegistry.off("done", onDone);
      if (status === "succeeded" && exitCode === 0) resolve();
      else reject(new Error(`npm ci failed with exit code ${exitCode ?? "unknown"}`));
    };
    jobRegistry.on("done", onDone);
  });
}

export interface OpenRunAppResult {
  url: string;
  port: number;
  app_path: string;
  built_from_logs: boolean;
  job_id: string;
}

export async function openRunApp(repoRoot: string, runId: string): Promise<OpenRunAppResult> {
  const existing = activeDevServers.get(runId);
  if (existing && (await isPortInUse(existing.port))) {
    const appPath = await resolveRunAppDirectory(repoRoot, runId);
    if (!appPath) throw new Error("Generated app not found");
    return {
      url: `http://127.0.0.1:${existing.port}`,
      port: existing.port,
      app_path: path.relative(repoRoot, appPath),
      built_from_logs: false,
      job_id: existing.jobId,
    };
  }

  let appPath = await resolveRunAppDirectory(repoRoot, runId);
  let builtFromLogs = false;

  if (!appPath) {
    const runDirectory = path.join(repoRoot, "artifacts", "runs", runId);
    if (!(await pathExists(path.join(runDirectory, "events.jsonl")))) {
      const sessionDir = path.join(runDirectory, "sessions");
      let hasSession = false;
      try {
        const names = await readdir(sessionDir);
        hasSession = names.some((name) => name.endsWith(".jsonl"));
      } catch {
        hasSession = false;
      }
      if (!hasSession) {
        throw new Error("No generated app and no session logs to rebuild from");
      }
    }
    await replayRun(runDirectory, { compareOnly: true });
    appPath = path.join(repoRoot, "artifacts", "replay", runId, "app");
    if (!(await isRunnableAppDirectory(appPath))) {
      throw new Error("Failed to rebuild the generated app from session logs");
    }
    builtFromLogs = true;
  }

  await ensureNodeModules(appPath);
  const port = await findFreePort(3000, 3999);
  const job = jobRegistry.spawnJob({
    kind: "app-dev",
    runId,
    command: "npx",
    args: ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    cwd: appPath,
  });

  activeDevServers.set(runId, { port, jobId: job.id });
  jobRegistry.once("done", (jobId) => {
    if (jobId !== job.id) return;
    const current = activeDevServers.get(runId);
    if (current?.jobId === jobId) activeDevServers.delete(runId);
  });

  await waitForPort(port);

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    app_path: path.relative(repoRoot, appPath),
    built_from_logs: builtFromLogs,
    job_id: job.id,
  };
}
