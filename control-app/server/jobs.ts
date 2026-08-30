import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ChallengeLaunchRequest, JobKind, JobRecord, JobStatus } from "./types.js";

export interface SpawnJobOptions {
  kind: JobKind;
  runId: string | null;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

class JobRegistry extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private activeChallengeJobId: string | null = null;

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  hasActiveChallenge(): boolean {
    if (!this.activeChallengeJobId) return false;
    const job = this.jobs.get(this.activeChallengeJobId);
    return job?.status === "running";
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
    });

    this.attachChild(id, child);
    return record;
  }

  private attachChild(jobId: string, child: ChildProcess): void {
    const appendLine = (line: string): void => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.lines.push(line);
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
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.exit_code = code ?? 1;
      job.status = code === 0 ? "succeeded" : "failed";
      job.finished_at = new Date().toISOString();
      if (this.activeChallengeJobId === jobId) {
        this.activeChallengeJobId = null;
      }
      this.emit("done", jobId, job.status, job.exit_code);
    });
  }
}

export const jobRegistry = new JobRegistry();

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
  if (request.experiment_id) exports.push(`export RUN_EXPERIMENT=${shellQuote(request.experiment_id)}`);
  if (request.arm) exports.push(`export RUN_ARM=${shellQuote(request.arm)}`);
  if (request.rep !== undefined) exports.push(`export RUN_REP=${String(request.rep)}`);
  if (request.intervention) exports.push(`export RUN_INTERVENTION=${shellQuote(request.intervention)}`);

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
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
