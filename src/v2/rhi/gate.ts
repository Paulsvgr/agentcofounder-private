import type { Evaluation, EvaluationWinner } from "./evaluator.js";

export interface GateDecision {
  accept: boolean;
  winner: EvaluationWinner;
  reason: string;
}

export function regressionGate(evaluation: Evaluation): GateDecision {
  const { winner, objective } = evaluation;
  if (winner === "previous") {
    return { accept: false, winner, reason: "current output is worse; reject candidate" };
  }
  if (winner === "tie") {
    if (objective.cost_ratio <= 0.85 && objective.quality_delta >= 0) {
      return { accept: true, winner: "current", reason: "tie quality with substantially lower cost" };
    }
    return { accept: false, winner, reason: "equal output; keep current harness" };
  }
  if (objective.cost_ratio > 2 && objective.quality_delta < 15) {
    return {
      accept: false,
      winner: "previous",
      reason: "quality improved but cost more than doubled without a large quality gain",
    };
  }
  return { accept: true, winner, reason: "current output is better; accept candidate" };
}

export function improvementHasConverged(
  history: Evaluation[],
  options: { consecutiveNonWins?: number; repeatedRootCause?: number } = {},
): boolean {
  const consecutiveNonWins = options.consecutiveNonWins ?? 2;
  const repeatedRootCause = options.repeatedRootCause ?? 3;
  if (history.length >= consecutiveNonWins) {
    const tail = history.slice(-consecutiveNonWins);
    if (tail.every((row) => row.winner !== "current")) return true;
  }
  const causes = new Map<string, number>();
  for (const row of history) {
    for (const cause of row.root_causes) {
      const key = cause.trim().toLowerCase();
      if (key === "") continue;
      causes.set(key, (causes.get(key) ?? 0) + 1);
      if ((causes.get(key) ?? 0) >= repeatedRootCause) return true;
    }
  }
  const costWithoutQuality = history.filter(
    (row) => row.objective.cost_ratio > 1.2 && row.objective.quality_delta <= 0,
  );
  return costWithoutQuality.length >= consecutiveNonWins;
}
