import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../../types.js";
import { observeWorkspace } from "../milestone-ralph/observe.js";
import { baselineHarness } from "./baseline.js";
import { completeJsonWithPi } from "./complete.js";
import { evaluateOutputs, type Evaluation, type JsonCompleter, type OutputSnapshot } from "./evaluator.js";
import { improvementHasConverged, regressionGate } from "./gate.js";
import { saveIteration, saveOptimizedHarness } from "./history.js";
import { optimizeHarness } from "./optimizer.js";
import { cloneHarness, type HarnessDocument } from "./schema.js";
import { inferTaskKind } from "./task-kind.js";
import { buildExecutionTrace, type ExecutionTrace } from "./trace.js";
import { materializeRuntimeAdditions } from "./materialize.js";

export interface AgentRunArtifacts {
  artifactDirectory: string;
  outputDirectory: string;
  wallMs: number;
  timedOut: boolean;
}

export type AgentRunner = (input: {
  task: string;
  ideaFile: string;
  harness: HarnessDocument;
  harnessPath: string;
}) => Promise<AgentRunArtifacts>;

export interface RhiLoopInput {
  task: string;
  ideaFile: string;
  historyRoot: string;
  maxIterations: number;
  runner: AgentRunner;
  complete?: JsonCompleter;
  baseline?: HarnessDocument;
  fromRun?: { artifactDirectory: string; outputDirectory: string; wallMs: number; timedOut?: boolean };
}

export interface RhiLoopResult {
  optimized_harness: HarnessDocument;
  evaluations: Evaluation[];
  final_evaluation: Evaluation | null;
  optimized_harness_path: string;
}

async function snapshotOutput(outputDirectory: string, artifactDirectory: string): Promise<OutputSnapshot> {
  let result: RunResult | null = null;
  for (const candidate of [
    path.join(artifactDirectory, "result.json"),
    path.join(outputDirectory, "result.json"),
  ]) {
    try {
      result = JSON.parse(await readFile(candidate, "utf8")) as RunResult;
      break;
    } catch {
      // Try the next known result location.
    }
  }
  const observation = await observeWorkspace(outputDirectory);
  return {
    result,
    summary: result?.summary ?? "",
    implemented_features: result?.implemented_features ?? observation.implementedFeatures,
    source_files: observation.sourceFiles,
  };
}

async function writeHarnessFile(directory: string, harness: HarnessDocument): Promise<string> {
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, "candidate-harness.json");
  await writeFile(filePath, `${JSON.stringify(harness, null, 2)}\n`, "utf8");
  return filePath;
}

async function outputFiles(outputDirectory: string, artifactDirectory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [name, filePath] of [
    ["result.json", path.join(artifactDirectory, "result.json")],
    ["app-result.json", path.join(outputDirectory, "result.json")],
    ["milestone-state.json", path.join(artifactDirectory, "milestone-state.json")],
  ] as const) {
    try {
      files[name] = await readFile(filePath, "utf8");
    } catch {
      // Optional per-run files.
    }
  }
  return files;
}

async function runOnce(
  runner: AgentRunner,
  task: string,
  ideaFile: string,
  harness: HarnessDocument,
  workDirectory: string,
): Promise<{ artifacts: AgentRunArtifacts; snapshot: OutputSnapshot; trace: ExecutionTrace }> {
  const harnessPath = await writeHarnessFile(workDirectory, harness);
  const artifacts = await runner({ task, ideaFile, harness, harnessPath });
  const snapshot = await snapshotOutput(artifacts.outputDirectory, artifacts.artifactDirectory);
  const trace = await buildExecutionTrace({
    task,
    harness,
    artifactDirectory: artifacts.artifactDirectory,
    executionTimeMs: artifacts.wallMs,
    timedOut: artifacts.timedOut,
  });
  return { artifacts, snapshot, trace };
}

export async function runRhiLoop(input: RhiLoopInput): Promise<RhiLoopResult> {
  const complete = input.complete ?? completeJsonWithPi;
  let current = cloneHarness(input.baseline ?? baselineHarness());
  current.task_kind = inferTaskKind(input.task);
  const evaluations: Evaluation[] = [];
  await mkdir(input.historyRoot, { recursive: true });

  let previousSnapshot: OutputSnapshot;
  let previousTrace: ExecutionTrace;
  let previousArtifacts: AgentRunArtifacts;

  if (input.fromRun) {
    previousArtifacts = {
      artifactDirectory: input.fromRun.artifactDirectory,
      outputDirectory: input.fromRun.outputDirectory,
      wallMs: input.fromRun.wallMs,
      timedOut: input.fromRun.timedOut === true,
    };
    previousSnapshot = await snapshotOutput(previousArtifacts.outputDirectory, previousArtifacts.artifactDirectory);
    previousTrace = await buildExecutionTrace({
      task: input.task,
      harness: current,
      artifactDirectory: previousArtifacts.artifactDirectory,
      executionTimeMs: previousArtifacts.wallMs,
      timedOut: previousArtifacts.timedOut,
    });
  } else {
    const first = await runOnce(input.runner, input.task, input.ideaFile, current, path.join(input.historyRoot, "work"));
    previousArtifacts = first.artifacts;
    previousSnapshot = first.snapshot;
    previousTrace = first.trace;
  }

  await saveIteration(
    input.historyRoot,
    {
      iteration: 0,
      harness: current,
      trace: previousTrace,
      evaluation: null,
      output_summary: previousSnapshot.summary,
      accepted: true,
    },
    await outputFiles(previousArtifacts.outputDirectory, previousArtifacts.artifactDirectory),
  );

  let lastEvaluation: Evaluation | null = null;
  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    const optimized = await optimizeHarness({
      current,
      nextId: `v${iteration}`,
      history: evaluations,
      trace: previousTrace,
      complete,
    });
    if (optimized.changes.length === 0) {
      break;
    }

    const candidate = optimized.harness;
    const ran = await runOnce(
      input.runner,
      input.task,
      input.ideaFile,
      candidate,
      path.join(input.historyRoot, "work"),
    );
    const evaluation = await evaluateOutputs({
      task: input.task,
      iteration,
      previousHarnessId: current.id,
      currentHarnessId: candidate.id,
      previous: previousSnapshot,
      current: ran.snapshot,
      previousTrace,
      currentTrace: ran.trace,
      hasPreviousSource: previousSnapshot.source_files.some((file) => file.includes(".test.")),
      hasCurrentSource: ran.snapshot.source_files.some((file) => file.includes(".test.")),
      complete,
    });
    const gate = regressionGate(evaluation);
    evaluation.winner = gate.winner;
    lastEvaluation = evaluation;
    evaluations.push(evaluation);

    await saveIteration(
      input.historyRoot,
      {
        iteration,
        harness: candidate,
        trace: ran.trace,
        evaluation,
        output_summary: ran.snapshot.summary,
        change_summary: optimized.change_summary,
        accepted: gate.accept,
      },
      await outputFiles(ran.artifacts.outputDirectory, ran.artifacts.artifactDirectory),
    );

    if (gate.accept) {
      current = candidate;
      previousSnapshot = ran.snapshot;
      previousTrace = ran.trace;
      previousArtifacts = ran.artifacts;
    }

    if (improvementHasConverged(evaluations)) break;
  }

  const optimizedPath = await saveOptimizedHarness(input.historyRoot, current);
  await writeFile(
    path.join(input.historyRoot, "final_evaluation.json"),
    `${JSON.stringify(
      {
        optimized_harness: current.id,
        evaluations,
        final_evaluation: lastEvaluation,
        runtime_additions: materializeRuntimeAdditions(current),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return {
    optimized_harness: current,
    evaluations,
    final_evaluation: lastEvaluation,
    optimized_harness_path: optimizedPath,
  };
}
