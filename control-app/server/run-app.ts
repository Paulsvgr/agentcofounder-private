import { access, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { replayRun } from "../../scripts/replay-run.js";
import { resolveSavedAppDirectory } from "../../src/snapshot-generated-app.js";
import { isPortInUse } from "./port-check.js";
import { jobRegistry } from "./jobs.js";
import type { JobRecord } from "./types.js";

const activeDevServers = new Map<string, { port: number; jobId: string }>();

export interface RunAppStatus {
  running: boolean;
  url?: string;
  port?: number;
  app_path?: string | null;
  job_id?: string;
}

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

function localViteCommand(appDirectory: string): string {
  const binName = process.platform === "win32" ? "vite.cmd" : "vite";
  return path.join(appDirectory, "node_modules", ".bin", binName);
}

function jobLogTail(job: JobRecord | undefined, lineCount = 8): string {
  if (!job || job.lines.length === 0) return "";
  return job.lines.slice(-lineCount).join("\n");
}

async function nodeModulesNeedsReinstall(appDirectory: string): Promise<boolean> {
  const nodeModulesDirectory = path.join(appDirectory, "node_modules");
  if (!(await pathExists(nodeModulesDirectory))) return true;

  const viteBin = localViteCommand(appDirectory);
  if (!(await pathExists(viteBin))) return true;

  try {
    const resolvedVite = await realpath(viteBin);
    const resolvedApp = await realpath(appDirectory);
    const appPrefix = `${resolvedApp}${path.sep}`;
    if (!resolvedVite.startsWith(appPrefix)) return true;
  } catch {
    return true;
  }

  return false;
}

async function installNodeModules(appDirectory: string): Promise<void> {
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
      else {
        const tail = jobLogTail(jobRegistry.get(job.id));
        reject(new Error(`npm ci failed with exit code ${exitCode ?? "unknown"}${tail ? `:\n${tail}` : ""}`));
      }
    };
    jobRegistry.on("done", onDone);
  });
}

async function ensureNodeModules(appDirectory: string): Promise<void> {
  if (!(await nodeModulesNeedsReinstall(appDirectory))) return;

  const nodeModulesDirectory = path.join(appDirectory, "node_modules");
  if (await pathExists(nodeModulesDirectory)) {
    await rm(nodeModulesDirectory, { recursive: true, force: true });
  }

  await installNodeModules(appDirectory);
}

async function waitForDevServer(jobId: string, port: number, timeoutMs = 45_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = jobRegistry.get(jobId);
    if (job && job.status !== "running") {
      const tail = jobLogTail(job);
      throw new Error(
        `Dev server exited before binding to port ${port}${tail ? `:\n${tail}` : ""}`,
      );
    }
    if (await isPortInUse(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const tail = jobLogTail(jobRegistry.get(jobId));
  throw new Error(`Dev server did not start on port ${port}${tail ? `:\n${tail}` : ""}`);
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
  const viteCommand = localViteCommand(appPath);
  const job = jobRegistry.spawnJob({
    kind: "app-dev",
    runId,
    command: viteCommand,
    args: ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    cwd: appPath,
  });

  activeDevServers.set(runId, { port, jobId: job.id });
  jobRegistry.once("done", (jobId) => {
    if (jobId !== job.id) return;
    const current = activeDevServers.get(runId);
    if (current?.jobId === jobId) activeDevServers.delete(runId);
  });

  await waitForDevServer(job.id, port);

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    app_path: path.relative(repoRoot, appPath),
    built_from_logs: builtFromLogs,
    job_id: job.id,
  };
}

export async function getRunAppStatus(repoRoot: string, runId: string): Promise<RunAppStatus> {
  const existing = activeDevServers.get(runId);
  if (!existing || !(await isPortInUse(existing.port))) {
    if (existing) activeDevServers.delete(runId);
    return { running: false };
  }

  const appPath = await resolveRunAppDirectory(repoRoot, runId);
  return {
    running: true,
    url: `http://127.0.0.1:${existing.port}`,
    port: existing.port,
    app_path: appPath ? path.relative(repoRoot, appPath) : null,
    job_id: existing.jobId,
  };
}

export async function killRunApp(_repoRoot: string, runId: string): Promise<{ stopped: boolean }> {
  const existing = activeDevServers.get(runId);
  if (!existing) {
    return { stopped: false };
  }

  jobRegistry.killJob(existing.jobId);
  activeDevServers.delete(runId);

  return { stopped: true };
}
