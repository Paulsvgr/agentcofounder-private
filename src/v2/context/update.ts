import { createHash } from "node:crypto";
import type { WorkspaceObservation } from "../milestone-ralph/observe.js";
import type { L0Snapshot } from "../milestone-ralph/state.js";
import type { DiagnosisFinding } from "../sensors/types.js";
import type { ScoredCandidate } from "../voi/select.js";
import {
  initialMilestoneContext,
  type ArchitectureState,
  type MilestoneContext,
  type VerificationDigest,
} from "./types.js";
import { maybeCompactContext } from "./prompt.js";

function fingerprintText(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

export function workspaceFingerprint(observation: WorkspaceObservation): string {
  return fingerprintText(
    JSON.stringify({
      files: observation.sourceFiles,
      tests: observation.productTestFiles,
      report: observation.reportStatus,
      features: observation.implementedFeatures,
    }),
  );
}

export function failureFingerprint(l0: L0Snapshot | null): string | null {
  if (!l0 || l0.passed) return null;
  return fingerprintText(l0.summary.slice(0, 500));
}

export function architectureFromObservation(observation: WorkspaceObservation, appIsSeedLike: boolean): ArchitectureState {
  return {
    has_domain: observation.hasDomainModule,
    has_storage: observation.hasStorageModule,
    has_components: observation.hasComponentModules,
    app_is_seed_like: appIsSeedLike,
  };
}

export function verificationDigest(l0: L0Snapshot | null, artifact: string): VerificationDigest | null {
  if (!l0) return null;
  const one = l0.summary.split("\n")[0] ?? (l0.passed ? "L0 PASS" : "L0 FAIL");
  return {
    passed: l0.passed,
    tests_passed: l0.tests_passed,
    build_passed: l0.build_passed,
    summary_one_liner: one,
    artifact,
  };
}

export function inferJourneyBuckets(observation: WorkspaceObservation, sample: string): {
  completed: string[];
  remaining: string[];
} {
  const text = `${sample}\n${observation.implementedFeatures.join(" ")}`.toLowerCase();
  const catalog = [
    ["add", /add|create|new /],
    ["edit/delete", /edit|delete|remove|confirm/],
    ["filter", /filter|category|type/],
    ["derived", /low.?stock|badge|derived/],
    ["persist", /localstorage|persist|refresh/],
    ["validation", /aria-invalid|validation|required/],
    ["robustness", /quota|malformed|corrupt|save fail/],
    ["stability", /\+\/-|increment|stable order|interaction-stability/],
  ] as const;
  const completed: string[] = [];
  const remaining: string[] = [];
  for (const [name, re] of catalog) {
    if (re.test(text)) completed.push(name);
    else remaining.push(name);
  }
  return { completed, remaining };
}

export function applyDecisionToContext(input: {
  context: MilestoneContext;
  observation: WorkspaceObservation;
  diagnosis: DiagnosisFinding[];
  candidate: ScoredCandidate;
  stopReason: string | null;
  changedFiles: string[];
  appIsSeedLike: boolean;
  sourceSample: string;
  sliceDirRelative: string;
}): { context: MilestoneContext; compacted: boolean } {
  const journeys = inferJourneyBuckets(input.observation, input.sourceSample);
  const top = input.diagnosis.slice(0, 5).map((d) => ({
    severity: d.severity,
    area: d.area,
    evidence: d.evidence,
    recommended_action: d.recommended_action,
  }));

  const next: MilestoneContext = {
    ...input.context,
    volatile: {
      ...input.context.volatile,
      current_objective: input.candidate.title,
      next_action: input.candidate.instruction.split("\n")[0] ?? input.candidate.title,
      next_action_kind: input.candidate.kind,
      success_condition: input.candidate.success_condition,
      completed_journeys: journeys.completed,
      remaining_journeys: journeys.remaining,
      architecture: architectureFromObservation(input.observation, input.appIsSeedLike),
      changed_files: input.changedFiles.slice(-20),
      known_defects: input.diagnosis.filter((d) => d.severity === "critical" || d.severity === "high").map((d) => `${d.area}: ${d.evidence}`),
      top_findings: top,
      artifact_pointers: [
        {
          label: "slice_dir",
          path: input.sliceDirRelative,
          note: "sensors.json, diagnosis.json, l0.json, prompt.md",
        },
        {
          label: "milestone_context",
          path: "milestone-context.json",
          note: "structured stable+volatile state",
        },
      ],
      stop_reason: input.stopReason,
    },
  };

  return maybeCompactContext(next);
}

export function createContextWithMemory(idea: string, memoryRules: string[]): MilestoneContext {
  return initialMilestoneContext(idea, memoryRules);
}
