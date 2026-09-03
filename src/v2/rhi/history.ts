import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Evaluation } from "./evaluator.js";
import type { HarnessDocument } from "./schema.js";
import type { ExecutionTrace } from "./trace.js";
import type { OptimizerResult } from "./optimizer.js";

export interface IterationRecord {
  iteration: number;
  harness: HarnessDocument;
  trace: ExecutionTrace;
  evaluation: Evaluation | null;
  output_summary: string;
  change_summary?: string;
  accepted: boolean;
}

export function iterationDirectory(historyRoot: string, iteration: number): string {
  return path.join(historyRoot, `iteration_${iteration}`);
}

export async function saveIteration(
  historyRoot: string,
  record: IterationRecord,
  outputFiles?: Record<string, string>,
): Promise<string> {
  const directory = iterationDirectory(historyRoot, record.iteration);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "harness.json"), `${JSON.stringify(record.harness, null, 2)}\n`, "utf8");
  await writeFile(path.join(directory, "trace.json"), `${JSON.stringify(record.trace, null, 2)}\n`, "utf8");
  if (record.evaluation) {
    await writeFile(path.join(directory, "evaluation.json"), `${JSON.stringify(record.evaluation, null, 2)}\n`, "utf8");
  }
  const meta = {
    iteration: record.iteration,
    output_summary: record.output_summary,
    change_summary: record.change_summary ?? null,
    accepted: record.accepted,
  };
  await writeFile(path.join(directory, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  if (outputFiles) {
    const outputDir = path.join(directory, "output");
    await mkdir(outputDir, { recursive: true });
    for (const [name, content] of Object.entries(outputFiles)) {
      await writeFile(path.join(outputDir, name), content, "utf8");
    }
  }
  return directory;
}

export async function saveOptimizedHarness(historyRoot: string, harness: HarnessDocument): Promise<string> {
  await mkdir(historyRoot, { recursive: true });
  const filePath = path.join(historyRoot, "optimized_harness.json");
  await writeFile(filePath, `${JSON.stringify(harness, null, 2)}\n`, "utf8");
  return filePath;
}

export async function loadIterationEvaluation(historyRoot: string, iteration: number): Promise<Evaluation | null> {
  try {
    return JSON.parse(await readFile(path.join(iterationDirectory(historyRoot, iteration), "evaluation.json"), "utf8")) as Evaluation;
  } catch {
    return null;
  }
}

export function summarizeHistory(evaluations: Evaluation[]): string {
  return evaluations
    .map(
      (row) =>
        `iteration ${row.iteration}: ${row.previous_harness} vs ${row.current_harness} → ${row.winner}` +
        (row.improvements[0] ? `; +${row.improvements[0]}` : "") +
        (row.regressions[0] ? `; -${row.regressions[0]}` : ""),
    )
    .join("\n");
}

export type { OptimizerResult };
