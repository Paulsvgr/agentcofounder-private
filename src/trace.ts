import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult, TestRun, UsageSummary } from "./types.js";

export interface TraceEntry {
  step: number;
  phase: string;
  action: string;
  status: "success" | "failure" | "skipped";
  duration_ms: number;
  detail?: string;
  usage?: Pick<UsageSummary, "input_tokens" | "output_tokens" | "cache_read_tokens">;
}

/**
 * Append-only machine-readable run trace. Deliberately tiny: one line per phase, no model
 * transcripts, so it stays auditable without becoming an artifact nobody reads.
 */
export class RunTrace {
  private step = 0;
  private readonly entries: TraceEntry[] = [];

  constructor(private readonly filePath: string) {}

  async record(entry: Omit<TraceEntry, "step">): Promise<TraceEntry> {
    this.step += 1;
    const full: TraceEntry = { step: this.step, ...entry };
    this.entries.push(full);
    try {
      await appendFile(this.filePath, `${JSON.stringify(full)}\n`, "utf8");
    } catch (error) {
      console.warn(`Unable to append run trace: ${String(error)}`);
    }
    return full;
  }

  /** Times an async phase and records its outcome. */
  async phase<Value>(
    phase: string,
    action: string,
    run: () => Promise<Value>,
    describe: (value: Value) => { status: TraceEntry["status"]; detail?: string },
  ): Promise<Value> {
    const started = Date.now();
    const value = await run();
    const described = describe(value);
    await this.record({
      phase,
      action,
      status: described.status,
      duration_ms: Date.now() - started,
      ...(described.detail === undefined ? {} : { detail: described.detail }),
    });
    return value;
  }

  list(): TraceEntry[] {
    return [...this.entries];
  }
}

export function efficiencyScore(usage: UsageSummary): number {
  return Math.round(usage.input_tokens + usage.output_tokens * 3 + usage.cache_read_tokens * 0.1);
}

function checkLine(check: TestRun): string {
  return `- ${check.result === "passed" ? "PASS" : "FAIL"} — ${check.journey}`;
}

export async function writeSummary(
  summaryPath: string,
  result: RunResult,
  context: { ideaFile: string; repairAttempts: number; durationMs: number; trace: TraceEntry[] },
): Promise<void> {
  const lines = [
    `# Run summary`,
    "",
    `- Status: **${result.status}**`,
    `- Idea file: ${context.ideaFile}`,
    `- Wall clock: ${(context.durationMs / 1000).toFixed(1)}s`,
    `- Repair attempts: ${context.repairAttempts}`,
    `- Pi exit code: ${result.pi_exit_code}`,
    "",
    `## Application`,
    "",
    result.summary,
    "",
    `Start with \`${result.start_command}\` at ${result.app_url}.`,
    "",
    `## Implemented`,
    "",
    ...(result.implemented_features.length > 0
      ? result.implemented_features.map((feature) => `- ${feature}`)
      : ["- (none reported)"]),
    "",
    `## Assumptions`,
    "",
    ...(result.assumptions.length > 0 ? result.assumptions.map((entry) => `- ${entry}`) : ["- (none recorded)"]),
    "",
    `## Product journeys reported by the agent`,
    "",
    ...(result.tests_run.length > 0 ? result.tests_run.map(checkLine) : ["- (none reported)"]),
    "",
    `## Independent harness checks`,
    "",
    ...result.harness_checks.map(checkLine),
    "",
    `## Token usage`,
    "",
    `| model calls | input | output | cache read | cache write | total |`,
    `| --- | --- | --- | --- | --- | --- |`,
    `| ${result.model_calls} | ${result.input_tokens} | ${result.output_tokens} | ${result.cache_read_tokens} | ${result.cache_write_tokens} | ${result.total_tokens} |`,
    "",
    `Weighted efficiency (input + output x3 + cache_read x0.1): **${efficiencyScore(result)}**`,
    "",
    `## Phases`,
    "",
    ...context.trace.map(
      (entry) =>
        `${entry.step}. ${entry.phase}/${entry.action} — ${entry.status} (${entry.duration_ms}ms)${entry.detail ? ` — ${entry.detail}` : ""}`,
    ),
    "",
  ];
  try {
    await writeFile(summaryPath, lines.join("\n"), "utf8");
  } catch (error) {
    console.warn(`Unable to write run summary: ${String(error)}`);
  }
}

export function summaryPathFor(artifactDirectory: string): string {
  return path.join(artifactDirectory, "summary.md");
}
