import type { MilestoneAction, MilestoneState } from "../milestone-ralph/state.js";
import type { WorkspaceObservation } from "../milestone-ralph/observe.js";
import type { DiagnosisFinding } from "../sensors/types.js";
import { costAwareActionScore, estimateSpendForKind, type ExpectedTokenSpend } from "../cost-model.js";
import { criticalGapExists, highValueGapExists, matrixPointsAtRisk } from "../quality/matrix.js";
import { buildSliceContract, type SliceContract } from "../context/slice-contract.js";

export type CandidateKind =
  | "implement_core"
  | "repair_failure"
  | "complete_missing_journey"
  | "fix_architecture"
  | "improve_accessibility"
  | "fix_persistence"
  | "stop";

export interface ScoreBreakdown {
  expected_quality_gain: number;
  probability_of_success: number;
  expected_weighted_cost: number;
  spend: ExpectedTokenSpend;
  matrix_points_at_risk: number;
}

export interface ScoredCandidate {
  kind: CandidateKind;
  action: MilestoneAction;
  title: string;
  instruction: string;
  success_condition: string;
  score: number;
  breakdown: ScoreBreakdown;
  contract: SliceContract;
}

export interface VoiDecision {
  selected: ScoredCandidate;
  candidates: ScoredCandidate[];
  stop_reason: string | null;
}

/** Stop when expected value of another hop is too low (cost-aware score units). */
const VOI_STOP_THRESHOLD = Number(process.env.VOI_STOP_THRESHOLD ?? "0.08");

function qualityAndProb(
  kind: CandidateKind,
  diagnosis: DiagnosisFinding[],
  observation: WorkspaceObservation,
  state: MilestoneState,
): { quality: number; probability: number } {
  const areas = new Set(diagnosis.map((d) => d.area));
  const points = matrixPointsAtRisk(diagnosis);
  const hasCritical = criticalGapExists(diagnosis);
  const repeated = diagnosis.some((d) => d.area === "repeated_failure");

  let quality = points / 100;
  let probability = 0.55;

  switch (kind) {
    case "implement_core":
      quality = observation.productTestFiles.length === 0 ? 0.95 : 0.15;
      probability = observation.productTestFiles.length === 0 ? 0.7 : 0.25;
      break;
    case "repair_failure":
      quality = state.last_l0 && !state.last_l0.passed ? Math.max(0.7, points / 100) : 0.05;
      probability = hasCritical ? 0.65 : 0.5;
      break;
    case "fix_architecture":
      quality = areas.has("architecture") ? Math.max(0.35, points / 120) : 0.05;
      probability = 0.6;
      break;
    case "fix_persistence":
      quality = areas.has("persistence") ? 0.4 : 0.04;
      probability = 0.62;
      break;
    case "improve_accessibility":
      quality = areas.has("accessibility") ? 0.32 : 0.04;
      probability = 0.7;
      break;
    case "complete_missing_journey":
      quality = areas.has("journeys") || observation.reportStatus === "partial" ? 0.35 : 0.1;
      probability = 0.58;
      break;
    case "stop":
      quality = 0;
      probability = 1;
      break;
  }

  if (repeated && kind !== "stop" && kind !== "repair_failure") {
    quality *= 0.4;
    probability *= 0.7;
  }

  return { quality, probability };
}

function instructionFor(
  kind: CandidateKind,
  diagnosis: DiagnosisFinding[],
  observation: WorkspaceObservation,
): { title: string; instruction: string; success: string; action: MilestoneAction } {
  const top = diagnosis.slice(0, 2);
  const findingBlock =
    top.length === 0
      ? "No critical sensor gaps."
      : top
          .map(
            (d, i) =>
              `${i + 1}. [${d.severity}/${d.area}] ${d.recommended_action} | evidence: ${d.evidence} | files: ${d.files.join(", ") || "n/a"}`,
          )
          .join("\n");

  switch (kind) {
    case "implement_core":
      return {
        action: "implement_core",
        title: "Implement core (high-info journeys)",
        success: "Product tests exist, L0 pass, report.partial.json written",
        instruction: [
          "Ship modular domain/storage/components + ≤10 high-information UI journeys.",
          "Each journey should cover multiple rubric points when possible (CRUD+validation+persist).",
          "No prose plans. Edit files first.",
          findingBlock,
        ].join("\n"),
      };
    case "repair_failure":
      return {
        action: "repair",
        title: "Repair L0 failure only",
        success: "Previously failing L0 checks pass; no unrelated rewrites",
        instruction: ["Repair only failing L0 items.", findingBlock].join("\n"),
      };
    case "fix_architecture":
      return {
        action: "continue_journeys",
        title: "Fix architecture boundaries",
        success: "domain + storage present; App thin",
        instruction: ["Fix architecture gaps only.", findingBlock].join("\n"),
      };
    case "fix_persistence":
      return {
        action: "continue_journeys",
        title: "Fix persistence",
        success: "Repository owns localStorage; refresh/recovery covered",
        instruction: ["Fix persistence only.", findingBlock].join("\n"),
      };
    case "improve_accessibility":
      return {
        action: "continue_journeys",
        title: "Fix validation / a11y",
        success: "aria-invalid + alert/live present and tested",
        instruction: ["Fix validation/a11y only.", findingBlock].join("\n"),
      };
    case "complete_missing_journey":
      return {
        action: observation.productTestFiles.length === 0 ? "implement_core" : "continue_journeys",
        title: "Complete missing high-info journey",
        success: "Missing implied journey covered without exceeding 10 tests",
        instruction: ["Add only the missing high-info journey.", findingBlock].join("\n"),
      };
    case "stop":
    default:
      return { action: "done", title: "Stop", success: "No further slices", instruction: "" };
  }
}

export function evaluateStopConditions(input: {
  observation: WorkspaceObservation;
  diagnosis: DiagnosisFinding[];
  state: MilestoneState;
  bestNonStopScore: number;
  unchangedWorkspaceStreak: number;
}): string | null {
  if (input.state.last_l0?.passed && input.observation.reportStatus === "success" && !criticalGapExists(input.diagnosis)) {
    return "no_critical_gap_report_success";
  }
  if (input.state.last_l0?.passed && !highValueGapExists(input.diagnosis) && input.observation.productTestFiles.length > 0) {
    return "no_high_value_gap";
  }
  if (input.unchangedWorkspaceStreak >= 2) {
    return "unchanged_workspace_streak";
  }
  if (input.diagnosis.some((d) => d.area === "repeated_failure") && input.bestNonStopScore < VOI_STOP_THRESHOLD) {
    return "repeated_failure_low_voi";
  }
  if (
    input.bestNonStopScore < VOI_STOP_THRESHOLD &&
    input.observation.productTestFiles.length > 0 &&
    input.state.last_l0?.passed
  ) {
    return "voi_below_cost_threshold";
  }
  if (input.state.last_action === "continue_journeys" && input.state.last_l0?.passed && !criticalGapExists(input.diagnosis)) {
    return "one_continue_then_stop";
  }
  return null;
}

export function selectVoiAction(input: {
  observation: WorkspaceObservation;
  diagnosis: DiagnosisFinding[];
  state: MilestoneState;
  maxSlices: number;
  unchangedWorkspaceStreak: number;
  stableSystemTokens?: number;
  volatileTokens?: number;
}): VoiDecision {
  const stableTokens = input.stableSystemTokens ?? 4_000;
  const volatileTokens = input.volatileTokens ?? 400;
  const points = matrixPointsAtRisk(input.diagnosis);

  const stopMeta = instructionFor("stop", input.diagnosis, input.observation);
  const stopContract = buildSliceContract({
    kind: "stop",
    title: stopMeta.title,
    success_condition: stopMeta.success,
    diagnosis: input.diagnosis,
  });
  const stopCandidate = (): ScoredCandidate => ({
    kind: "stop",
    action: "done",
    title: stopMeta.title,
    instruction: stopMeta.instruction,
    success_condition: stopMeta.success,
    score: 0,
    contract: stopContract,
    breakdown: {
      expected_quality_gain: 0,
      probability_of_success: 1,
      expected_weighted_cost: 0,
      spend: { estimated_input_tokens: 0, estimated_output_tokens: 0, estimated_cache_read_tokens: 0 },
      matrix_points_at_risk: points,
    },
  });

  if (input.state.done || input.state.slice >= input.maxSlices) {
    return {
      stop_reason: input.state.slice >= input.maxSlices ? "max_slices" : "done_flag",
      selected: stopCandidate(),
      candidates: [],
    };
  }

  const kinds: CandidateKind[] = [
    "implement_core",
    "repair_failure",
    "fix_architecture",
    "fix_persistence",
    "improve_accessibility",
    "complete_missing_journey",
    "stop",
  ];

  const candidates: ScoredCandidate[] = kinds.map((kind) => {
    const meta = instructionFor(kind, input.diagnosis, input.observation);
    const { quality, probability } = qualityAndProb(kind, input.diagnosis, input.observation, input.state);
    const spend = estimateSpendForKind(kind, stableTokens, volatileTokens);
    const score =
      kind === "stop"
        ? 0
        : costAwareActionScore({
            expected_quality_gain: quality,
            probability_of_success: probability,
            spend,
          });
    const contract = buildSliceContract({
      kind,
      title: meta.title,
      success_condition: meta.success,
      diagnosis: input.diagnosis,
    });
    return {
      kind,
      action: meta.action,
      title: meta.title,
      instruction: meta.instruction,
      success_condition: meta.success,
      score,
      contract,
      breakdown: {
        expected_quality_gain: quality,
        probability_of_success: probability,
        expected_weighted_cost: spend.estimated_input_tokens + 3 * spend.estimated_output_tokens + 0.1 * spend.estimated_cache_read_tokens,
        spend,
        matrix_points_at_risk: points,
      },
    };
  });

  const nonStop = candidates.filter((c) => c.kind !== "stop").sort((a, b) => b.score - a.score);
  const bestNonStopScore = nonStop[0]?.score ?? 0;
  const stopReason = evaluateStopConditions({
    observation: input.observation,
    diagnosis: input.diagnosis,
    state: input.state,
    bestNonStopScore,
    unchangedWorkspaceStreak: input.unchangedWorkspaceStreak,
  });

  if (stopReason) {
    return { selected: stopCandidate(), candidates, stop_reason: stopReason };
  }

  if (input.observation.productTestFiles.length === 0) {
    return { selected: candidates.find((c) => c.kind === "implement_core")!, candidates, stop_reason: null };
  }

  if (input.state.last_l0 && input.state.last_l0.passed === false && input.observation.productTestFiles.length > 0) {
    return { selected: candidates.find((c) => c.kind === "repair_failure")!, candidates, stop_reason: null };
  }

  return { selected: nonStop[0]!, candidates, stop_reason: null };
}
