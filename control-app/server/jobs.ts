import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { signalProcessTree, usesDetachedProcessGroup } from "../../src/process-tree.js";
import { assertValidExperimentId } from "../../src/v2/experiment-id.js";
import type { ChallengeLaunchRequest, JobKind, JobRecord, JobStatus } from "./types.js";

export interface SpawnJobOptions {
  kind: JobKind;
  runId: string | null;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Soft wall clock; when exceeded, process is killed and status becomes timed_out. */
  timeout_ms?: number;
}

const RUN_ID_RE = /artifacts\/runs\/(\d{4}-\d{2}-\d{2}T[\d-]+Z)/;

class JobRegistry extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private children = new Map<string, ChildProcess>();
  private activeChallengeJobId: string | null = null;
  private stopRequested = new Set<string>();
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()].sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  getActiveChallenge(): JobRecord | null {
    if (!this.activeChallengeJobId) return null;
    const job = this.jobs.get(this.activeChallengeJobId);
    return job?.status === "running" ? job : null;
  }

  hasActiveChallenge(): boolean {
    return this.getActiveChallenge() !== null;
  }

  killJob(jobId: string, as: "stopped" | "timed_out" = "stopped"): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running") return false;

    this.stopRequested.add(jobId);
    job.status = as;

    const child = this.children.get(jobId);
    if (child) {
      signalProcessTree(child, "SIGTERM");
      setTimeout(() => {
        if (child.pid !== undefined) signalProcessTree(child, "SIGKILL");
      }, 2_000);
    }

    return true;
  }

  spawnJob(options: SpawnJobOptions): JobRecord {
    if (options.kind === "challenge" && this.hasActiveChallenge()) {
      throw new Error("A challenge run is already in progress");
    }

    const id = randomUUID();
    const record: JobRecord = {
      id,
      kind: options.kind,
      run_id: options.runId,
      status: "running",
      exit_code: null,
      lines: [],
      started_at: new Date().toISOString(),
      finished_at: null,
      detected_run_id: null,
    };

    this.jobs.set(id, record);
    if (options.kind === "challenge") {
      this.activeChallengeJobId = id;
    }

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: usesDetachedProcessGroup(),
    });

    this.children.set(id, child);
    this.attachChild(id, child);

    if (options.timeout_ms && options.timeout_ms > 0) {
      const timer = setTimeout(() => {
        this.killJob(id, "timed_out");
      }, options.timeout_ms);
      this.timeouts.set(id, timer);
    }

    return record;
  }

  private clearTimeout(jobId: string): void {
    const timer = this.timeouts.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(jobId);
    }
  }

  private attachChild(jobId: string, child: ChildProcess): void {
    const appendLine = (line: string): void => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.lines.push(line);
      const match = line.match(RUN_ID_RE);
      if (match?.[1]) {
        job.detected_run_id = match[1];
        if (!job.run_id) job.run_id = match[1];
      }
      this.emit("line", jobId, line);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.length > 0) appendLine(line);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.length > 0) appendLine(line);
      }
    });

    child.on("close", (code) => {
      this.children.delete(jobId);
      this.clearTimeout(jobId);
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.exit_code = code ?? 1;
      if (job.status === "running") {
        job.status = code === 0 ? "succeeded" : "failed";
      }
      // stopped / timed_out already set by killJob
      this.stopRequested.delete(jobId);
      job.finished_at = new Date().toISOString();
      if (this.activeChallengeJobId === jobId) {
        this.activeChallengeJobId = null;
      }
      this.emit("done", jobId, job.status, job.exit_code);
    });
  }
}

export const jobRegistry = new JobRegistry();

const ALLOWED_ENV_OVERRIDE =
  /^(HARNESS_[A-Z0-9_]+|TEMPLATE_[A-Z0-9_]+|CHALLENGE_[A-Z0-9_]+|RUN_[A-Z0-9_]+)$/;

export function buildChallengeShellCommand(
  repoRoot: string,
  profilePath: string,
  request: ChallengeLaunchRequest,
): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const exports: string[] = [];
  if (request.provider) exports.push(`export CHALLENGE_PROVIDER=${shellQuote(request.provider)}`);
  if (request.model) exports.push(`export CHALLENGE_MODEL=${shellQuote(request.model)}`);
  if (request.thinking) exports.push(`export CHALLENGE_THINKING=${shellQuote(request.thinking)}`);
  if (request.timeout_ms) exports.push(`export CHALLENGE_TIMEOUT_MS=${String(request.timeout_ms)}`);
  if (request.experiment_id) {
    assertValidExperimentId(request.experiment_id);
    exports.push(`export RUN_EXPERIMENT=${shellQuote(request.experiment_id)}`);
  }
  if (request.arm) exports.push(`export RUN_ARM=${shellQuote(request.arm)}`);
  if (request.rep !== undefined) exports.push(`export RUN_REP=${String(request.rep)}`);
  if (request.intervention) {
    exports.push(`export RUN_INTERVENTION=${shellQuote(request.intervention)}`);
  }

  if (request.env_overrides) {
    for (const [key, raw] of Object.entries(request.env_overrides)) {
      if (!ALLOWED_ENV_OVERRIDE.test(key)) continue;
      const value = String(raw ?? "").trim();
      if (!value) continue;
      exports.push(`export ${key}=${shellQuote(value)}`);
    }
  }

  const ideaArg =
    request.idea_file && request.idea_file !== "contract-public/development-idea.txt"
      ? ` --idea-file ${shellQuote(request.idea_file)}`
      : "";

  const script = [
    `set -euo pipefail`,
    `source ${shellQuote(profilePath)}`,
    ...exports,
    `cd ${shellQuote(repoRoot)}`,
    `npm run challenge${ideaArg}`,
  ].join("\n");

  return {
    command: "bash",
    args: ["-lc", script],
    env: process.env,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function spawnNpmScript(
  kind: JobKind,
  runId: string | null,
  repoRoot: string,
  npmScript: string,
  scriptArgs: string[],
): JobRecord {
  return jobRegistry.spawnJob({
    kind,
    runId,
    command: "npm",
    args: ["run", npmScript, "--", ...scriptArgs],
    cwd: repoRoot,
  });
}

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "timed_out":
      return "timed_out";
    case "stopped":
      return "stopped";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
