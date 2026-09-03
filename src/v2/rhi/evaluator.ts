import type { RunResult } from "../../types.js";
import { costRatio, scoreOutput, type ObjectiveSignals } from "./objective.js";
import type { ExecutionTrace } from "./trace.js";

export type EvaluationWinner = "current" | "previous" | "tie";

export interface Evaluation {
  iteration: number;
  previous_harness: string;
  current_harness: string;
  winner: EvaluationWinner;
  improvements: string[];
  regressions: string[];
  missing_requirements: string[];
  root_causes: string[];
  harness_recommendations: string[];
  objective: {
    previous: ObjectiveSignals;
    current: ObjectiveSignals;
    quality_delta: number;
    cost_ratio: number;
  };
  dimensions: Record<string, EvaluationWinner>;
}

export interface OutputSnapshot {
  result: RunResult | null;
  summary: string;
  implemented_features: string[];
  source_files: string[];
}

export type JsonCompleter = (system: string, user: string) => Promise<unknown>;

const DIMENSIONS = [
  "requirement_coverage",
  "functional_correctness",
  "task_alignment",
  "code_quality",
  "testing",
  "completeness",
  "error_handling",
  "reproducibility",
  "unnecessary_work",
  "context_efficiency",
] as const;

function emptyLlm(): Pick<
  Evaluation,
  "improvements" | "regressions" | "missing_requirements" | "root_causes" | "harness_recommendations" | "dimensions"
> {
  return {
    improvements: [],
    regressions: [],
    missing_requirements: [],
    root_causes: [],
    harness_recommendations: [],
    dimensions: Object.fromEntries(DIMENSIONS.map((name) => [name, "tie" as EvaluationWinner])),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function parseWinner(value: unknown): EvaluationWinner | undefined {
  if (value === "current" || value === "previous" || value === "tie") return value;
  return undefined;
}

export function combineWinners(
  objectiveWinner: EvaluationWinner,
  llmWinner: EvaluationWinner | undefined,
  current: ObjectiveSignals,
  previous: ObjectiveSignals,
): EvaluationWinner {
  const qualityDelta = current.quality_score - previous.quality_score;
  const ratio = costRatio(current, previous);

  if (qualityDelta <= -5) return "previous";
  if (qualityDelta >= 5 && ratio <= 2) return "current";
  if (Math.abs(qualityDelta) < 5) {
    if (ratio <= 0.85 && qualityDelta >= 0) return "current";
    if (ratio >= 1.5) return "previous";
    return llmWinner ?? "tie";
  }
  if (ratio > 2 && qualityDelta > 0) return "tie";
  return llmWinner ?? objectiveWinner;
}

export function objectiveWinner(current: ObjectiveSignals, previous: ObjectiveSignals): EvaluationWinner {
  const delta = current.quality_score - previous.quality_score;
  if (delta >= 5) return "current";
  if (delta <= -5) return "previous";
  return "tie";
}

function compactSnapshot(snapshot: OutputSnapshot): string {
  return JSON.stringify(
    {
      summary: snapshot.summary.slice(0, 800),
      status: snapshot.result?.status ?? null,
      implemented_features: snapshot.implemented_features.slice(0, 20),
      harness_checks: snapshot.result?.harness_checks ?? [],
      tests_run: snapshot.result?.tests_run ?? [],
      source_files: snapshot.source_files.slice(0, 40),
    },
    null,
    2,
  );
}

export async function evaluateOutputs(input: {
  task: string;
  iteration: number;
  previousHarnessId: string;
  currentHarnessId: string;
  previous: OutputSnapshot;
  current: OutputSnapshot;
  previousTrace: ExecutionTrace;
  currentTrace: ExecutionTrace;
  hasPreviousSource: boolean;
  hasCurrentSource: boolean;
  complete?: JsonCompleter;
}): Promise<Evaluation> {
  const previousObjective = scoreOutput(input.previous.result, input.previousTrace, input.hasPreviousSource);
  const currentObjective = scoreOutput(input.current.result, input.currentTrace, input.hasCurrentSource);
  const objWinner = objectiveWinner(currentObjective, previousObjective);

  let llm = emptyLlm();
  let llmWinner: EvaluationWinner | undefined;
  if (input.complete) {
    const raw = await input.complete(
      [
        "You compare two harness outputs for the same task.",
        "Do not rewrite the harness. Do not reward longer output merely because it is longer.",
        "Focus on observable differences. Return JSON only.",
      ].join(" "),
      [
        `Task:\n${input.task}`,
        `Previous output (${input.previousHarnessId}):\n${compactSnapshot(input.previous)}`,
        `Current output (${input.currentHarnessId}):\n${compactSnapshot(input.current)}`,
        `Previous trace: agents=${input.previousTrace.agent_calls} tools=${input.previousTrace.tool_calls} tokens=${input.previousTrace.usage.total_tokens} term=${input.previousTrace.termination_reason}`,
        `Current trace: agents=${input.currentTrace.agent_calls} tools=${input.currentTrace.tool_calls} tokens=${input.currentTrace.usage.total_tokens} term=${input.currentTrace.termination_reason}`,
        `Return JSON: {"winner":"current|previous|tie","improvements":[],"regressions":[],"missing_requirements":[],"root_causes":[],"harness_recommendations":[],"dimensions":{${DIMENSIONS.map((name) => `"${name}":"current|previous|tie"`).join(",")}}}`,
      ].join("\n\n"),
    );
    if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      llmWinner = parseWinner(record.winner);
      llm = {
        improvements: asStringArray(record.improvements),
        regressions: asStringArray(record.regressions),
        missing_requirements: asStringArray(record.missing_requirements),
        root_causes: asStringArray(record.root_causes),
        harness_recommendations: asStringArray(record.harness_recommendations),
        dimensions: { ...emptyLlm().dimensions },
      };
      if (record.dimensions && typeof record.dimensions === "object" && record.dimensions !== null) {
        for (const name of DIMENSIONS) {
          const parsed = parseWinner((record.dimensions as Record<string, unknown>)[name]);
          if (parsed) llm.dimensions[name] = parsed;
        }
      }
    }
  }

  if (llm.improvements.length === 0 && currentObjective.quality_score > previousObjective.quality_score) {
    llm.improvements.push("higher objective quality score");
  }
  if (llm.regressions.length === 0 && currentObjective.quality_score < previousObjective.quality_score) {
    llm.regressions.push("lower objective quality score");
  }
  if (!currentObjective.tests_passed) {
    llm.missing_requirements.push("passing product tests");
    if (llm.root_causes.length === 0) llm.root_causes.push("worker exited without a passing Vitest suite");
  }

  return {
    iteration: input.iteration,
    previous_harness: input.previousHarnessId,
    current_harness: input.currentHarnessId,
    winner: combineWinners(objWinner, llmWinner, currentObjective, previousObjective),
    ...llm,
    objective: {
      previous: previousObjective,
      current: currentObjective,
      quality_delta: currentObjective.quality_score - previousObjective.quality_score,
      cost_ratio: costRatio(currentObjective, previousObjective),
    },
  };
}
