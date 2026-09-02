import { orderedSegments, STAGE_LABELS } from "./actionFlow";
import { experimentKey } from "./classification";
import type { ExperimentStudy } from "../types/experiment";
import {
  ACTION_STAGE_ORDER,
  hasActionFlow,
  type ActionStage,
  type HackathonRunRecord,
  type RunExport,
} from "../types/runExport";

export type TrajectoryPoint = { progress: number; cumulative: number };

export type StageShare = { stage: ActionStage; label: string; share: number };

export type ArmTrajectoryGroup = {
  key: "control" | "treatment";
  label: string;
  armKeys: string[];
  runCount: number;
  curve: TrajectoryPoint[];
  stages: StageShare[];
};

const PROGRESS_SAMPLES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

function isControlArm(arm: string): boolean {
  return arm.includes("-control");
}

function isTreatmentArm(arm: string): boolean {
  return arm.includes("-treatment") || arm.includes("-cleanup");
}

export function cumulativeCurveForExport(exp: RunExport): TrajectoryPoint[] {
  const flow = orderedSegments(exp.efficiency.action_flow);
  if (!flow.length) return [];

  const totalCalls = Math.max(1, exp.harness.model_calls || 0);
  const totalWeighted = Math.max(1, exp.efficiency.weighted_total || 0);
  const perCall = new Array<number>(totalCalls).fill(0);

  for (const seg of flow) {
    const indexes = seg.call_indexes.length
      ? seg.call_indexes
      : Array.from({ length: Math.max(0, seg.call_count) }, (_, i) => i);
    if (!indexes.length) continue;
    const share = seg.weighted_tokens / indexes.length;
    for (const idx of indexes) {
      if (idx >= 0 && idx < totalCalls) perCall[idx] += share;
    }
  }

  const points: TrajectoryPoint[] = [{ progress: 0, cumulative: 0 }];
  let cum = 0;
  for (let i = 0; i < totalCalls; i++) {
    cum += perCall[i] ?? 0;
    points.push({
      progress: ((i + 1) / totalCalls) * 100,
      cumulative: Math.min(100, (cum / totalWeighted) * 100),
    });
  }
  return points;
}

function sampleCurve(curve: TrajectoryPoint[], progress: number): number | null {
  if (!curve.length) return null;
  let value = 0;
  for (const pt of curve) {
    if (pt.progress <= progress) value = pt.cumulative;
    else break;
  }
  return value;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function medianCumulativeCurve(runs: HackathonRunRecord[]): TrajectoryPoint[] {
  const curves = runs
    .map((r) => (r.data.export ? cumulativeCurveForExport(r.data.export) : []))
    .filter((c) => c.length > 0);
  if (!curves.length) return [];

  return PROGRESS_SAMPLES.map((progress) => ({
    progress,
    cumulative: median(
      curves
        .map((c) => sampleCurve(c, progress))
        .filter((v): v is number => v !== null),
    ),
  }));
}

export function stageSharesForExport(exp: RunExport): StageShare[] {
  const flow = orderedSegments(exp.efficiency.action_flow);
  const total = Math.max(1, exp.efficiency.weighted_total || 0);
  const byStage = new Map<ActionStage, number>();
  for (const seg of flow) {
    byStage.set(seg.stage, (byStage.get(seg.stage) ?? 0) + seg.weighted_tokens);
  }
  return ACTION_STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    share: ((byStage.get(stage) ?? 0) / total) * 100,
  }));
}

export function medianStageShares(runs: HackathonRunRecord[]): StageShare[] {
  const perRun = runs
    .map((r) => (r.data.export ? stageSharesForExport(r.data.export) : []))
    .filter((s) => s.length > 0);
  if (!perRun.length) return [];

  return ACTION_STAGE_ORDER.map((stage) => {
    const values = perRun
      .map((shares) => shares.find((s) => s.stage === stage)?.share ?? 0)
      .filter((v) => v > 0);
    if (!values.length) return null;
    return {
      stage,
      label: STAGE_LABELS[stage],
      share: median(values),
    };
  }).filter((s): s is StageShare => s !== null);
}

export function v2RunsWithFlow(runs: HackathonRunRecord[]): HackathonRunRecord[] {
  return runs.filter((r) => hasActionFlow(r.data.export));
}

export function trajectoryGroupsForStudy(
  runs: HackathonRunRecord[],
  study: ExperimentStudy,
): ArmTrajectoryGroup[] {
  const armSet = new Set<string>(study.arms);
  const studyRuns = v2RunsWithFlow(runs.filter((r) => armSet.has(experimentKey(r))));

  const controlArms = new Set<string>(study.arms.filter(isControlArm));
  const treatmentArms = new Set<string>(study.arms.filter(isTreatmentArm));

  const groups: ArmTrajectoryGroup[] = [];

  if (controlArms.size) {
    const controlRuns = studyRuns.filter((r) => controlArms.has(experimentKey(r)));
    if (controlRuns.length) {
      groups.push({
        key: "control",
        label: "Control (median)",
        armKeys: study.arms.filter(isControlArm),
        runCount: controlRuns.length,
        curve: medianCumulativeCurve(controlRuns),
        stages: medianStageShares(controlRuns),
      });
    }
  }

  if (treatmentArms.size) {
    const treatmentRuns = studyRuns.filter((r) => treatmentArms.has(experimentKey(r)));
    if (treatmentRuns.length) {
      groups.push({
        key: "treatment",
        label: "Treatment (median)",
        armKeys: study.arms.filter(isTreatmentArm),
        runCount: treatmentRuns.length,
        curve: medianCumulativeCurve(treatmentRuns),
        stages: medianStageShares(treatmentRuns),
      });
    }
  }

  return groups;
}

/** Merge control + treatment stage medians into chart rows keyed by stage label. */
export function stageComparisonRows(groups: ArmTrajectoryGroup[]): {
  stage: string;
  control: number;
  treatment: number;
}[] {
  const control = groups.find((g) => g.key === "control");
  const treatment = groups.find((g) => g.key === "treatment");
  const stages = new Set<string>();
  for (const g of groups) {
    for (const s of g.stages) stages.add(s.label);
  }
  return [...stages].map((label) => ({
    stage: label,
    control: control?.stages.find((s) => s.label === label)?.share ?? 0,
    treatment: treatment?.stages.find((s) => s.label === label)?.share ?? 0,
  }));
}

/** Line chart rows: progress + one column per arm group. */
export function curveComparisonRows(groups: ArmTrajectoryGroup[]): Record<string, number>[] {
  return PROGRESS_SAMPLES.map((progress) => {
    const row: Record<string, number> = { progress };
    for (const g of groups) {
      const pt = g.curve.find((c) => c.progress === progress);
      row[g.key] = pt?.cumulative ?? 0;
    }
    return row;
  });
}
