import {
  ACTION_STAGE_ORDER,
  type ActionSegment,
  type ActionStage,
  type RunExport,
} from "../types/runExport";

export type ActionFlowRuler = "time" | "raw" | "weighted";

export const STAGE_LABELS: Record<ActionStage, string> = {
  inspect: "Inspect",
  build_app: "Build app",
  write_tests: "Write tests",
  diagnose: "Diagnose",
  repair_loop: "Repair loop",
  green_build: "Green + build",
  extra_verify: "Extra verify",
  report_final: "Report",
};

export const STAGE_COLORS: Record<ActionStage, string> = {
  inspect: "#64748b",
  build_app: "#3b82f6",
  write_tests: "#0891b2",
  diagnose: "#d97706",
  repair_loop: "#ea580c",
  green_build: "#16a34a",
  extra_verify: "#9333ea",
  report_final: "#9ca3af",
};

export const HIGHLIGHT_STAGES: ActionStage[] = ["repair_loop", "extra_verify"];

export function isActionStage(value: string): value is ActionStage {
  return (ACTION_STAGE_ORDER as string[]).includes(value);
}

export function orderedSegments(flow: ActionSegment[] | undefined): ActionSegment[] {
  if (!flow?.length) return [];
  const byStage = new Map(flow.map((s) => [s.stage, s]));
  return ACTION_STAGE_ORDER.map((stage) => byStage.get(stage)).filter(
    (s): s is ActionSegment => s !== undefined,
  );
}

export function segmentValue(segment: ActionSegment, ruler: ActionFlowRuler): number {
  switch (ruler) {
    case "time":
      return segment.wall_seconds;
    case "raw":
      return segment.raw_tokens;
    case "weighted":
      return segment.weighted_tokens;
    default: {
      const _exhaustive: never = ruler;
      return _exhaustive;
    }
  }
}

export function rulerTotal(exportDoc: RunExport, ruler: ActionFlowRuler): number {
  const flow = orderedSegments(exportDoc.efficiency.action_flow);
  if (ruler === "time") {
    return exportDoc.efficiency.wall_seconds ?? flow.reduce((a, s) => a + s.wall_seconds, 0);
  }
  if (ruler === "weighted") {
    return exportDoc.efficiency.weighted_total;
  }
  return flow.reduce((a, s) => a + s.raw_tokens, 0);
}

export function rulerUnit(ruler: ActionFlowRuler): string {
  switch (ruler) {
    case "time":
      return "s";
    case "raw":
      return " tokens";
    case "weighted":
      return " weighted";
    default: {
      const _exhaustive: never = ruler;
      return _exhaustive;
    }
  }
}

export function formatRulerValue(value: number, ruler: ActionFlowRuler): string {
  if (ruler === "time") {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}s`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function validateActionFlow(exportDoc: RunExport): string | null {
  const flow = exportDoc.efficiency.action_flow;
  if (!flow?.length) return null;

  for (const segment of flow) {
    if (!isActionStage(segment.stage)) {
      return `Invalid action_flow stage: ${String(segment.stage)}`;
    }
  }

  const wallTotal = exportDoc.efficiency.wall_seconds;
  if (typeof wallTotal === "number" && Number.isFinite(wallTotal)) {
    const sumWall = flow.reduce((a, s) => a + s.wall_seconds, 0);
    if (Math.abs(sumWall - wallTotal) > 1) {
      return `action_flow wall_seconds sum (${sumWall}) ≠ efficiency.wall_seconds (${wallTotal})`;
    }
  }

  return null;
}

export function shortRunId(runId: string | null | undefined): string {
  if (!runId) return "—";
  const tIdx = runId.indexOf("T");
  if (tIdx >= 0) return runId.slice(tIdx + 1);
  const parts = runId.split("-");
  return parts[parts.length - 1] || runId;
}
