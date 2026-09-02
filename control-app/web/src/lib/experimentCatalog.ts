import type { HackathonRunRecord } from "../types/runExport";
import type {
  ExperimentStudy,
  ExperimentStudyId,
  ExperimentVerdict,
} from "../types/experiment";
import { experimentKey } from "./classification";

export const EXPERIMENT_STUDIES: ExperimentStudy[] = [
  {
    id: "exp1-rtl",
    number: "Exp1",
    title: "RTL cleanup",
    line: "F",
    verdict: "keep",
    change: "Added afterEach(cleanup) to app-template/src/test/setup.ts.",
    goal: "Stop RTL DOM leakage between tests.",
    result:
      "No quality regression; mechanism counter inconclusive (control had almost no leak failures). Safe to keep, but not a token win.",
    arms: ["exp1-rtl-control", "exp1-rtl-cleanup"],
    comparePreset: "exp1-rtl",
    sortOrder: 1,
  },
  {
    id: "exp2-stop",
    number: "Exp2",
    title: "Stop rule",
    line: "F",
    verdict: "keep",
    change:
      "Prompt guidance — after full suite + build pass, stop re-verifying unless code changes.",
    goal: "Cut wasted post-green npm test / build runs.",
    result:
      "Median post-green verification 3 → 1. Does not stop repair spirals once debugging starts.",
    arms: ["exp2-stop-control", "exp2-stop-treatment"],
    sortOrder: 2,
  },
  {
    id: "exp3-test-policy",
    number: "Exp3",
    title: "Test policy",
    line: "F",
    verdict: "keep",
    change: "Compact journey-focused test guidance in skill + system prompt.",
    goal: "Fewer brittle/overbuilt tests → fewer self-inflicted repair loops.",
    result:
      "First CLEAN run (43k). Median repair/reinspection down. Best trajectory evidence so far.",
    arms: ["exp3-test-control", "exp3-test-treatment"],
    sortOrder: 3,
  },
  {
    id: "exp4-digest",
    number: "Exp4",
    title: "Digest prompt",
    line: "F",
    verdict: "revert",
    change: 'Prompt-only "read failures once, don\'t grep/tail/rerun."',
    goal: "Lower test_reinspection_calls.",
    result:
      "Counter worse (median 3 → 6). Hypothesis right, prompt wrong. Redesign as deterministic reporter (Exp6).",
    arms: ["exp4-digest-control", "exp4-digest-treatment"],
    sortOrder: 4,
  },
  {
    id: "exp5-template",
    number: "Exp5",
    title: "Template primitives",
    line: "F",
    verdict: "weak-keep",
    change:
      "Added collectionStore, useCollection, text helpers, memoryStorage to app-template/.",
    goal: "Less boilerplate → fewer output tokens on clean runs.",
    result:
      "100% adoption, plumbing LOC −38%, total output −6.9% (below 10% Strong KEEP bar). Eager storage capture was a recurring bug → led to Exp5b.",
    arms: ["exp5-template-control", "exp5-template-treatment"],
    sortOrder: 5,
  },
  {
    id: "exp6-reporter",
    number: "Exp6",
    title: "Compact Vitest reporter",
    line: "F",
    verdict: "weak-keep",
    change: "Deterministic compact failure reporter in app-template/ (not harness).",
    goal: "One clear failure view → fewer same-generation test reruns.",
    result:
      "5/5 success; helps clean paths (reps 3, 5). Median weighted rose (90k → 125k); rep1 still snowballed. Keep in stack, no economic claim.",
    arms: ["exp6-reporter-control", "exp6-reporter-treatment"],
    buildsOn: "exp4-digest",
    sortOrder: 6,
  },
  {
    id: "exp5b-storage",
    number: "Exp5b",
    title: "Storage hardening",
    line: "F",
    verdict: "keep",
    change: "Lazy default storage in collectionStore; clearer useCollection guidance.",
    goal: "Fix test-storage failure class from Exp5.",
    result:
      "P(clean) 0.2 → 0.6, median weighted 125k → 67k, median calls 38 → 20. Clearest win of the stack.",
    arms: ["exp5b-storage-control", "exp5b-storage-treatment"],
    buildsOn: "exp5-template",
    sortOrder: 7,
  },
];

const STUDY_BY_ID = new Map(EXPERIMENT_STUDIES.map((s) => [s.id, s]));

const STUDY_BY_ARM = new Map<string, ExperimentStudy>();
for (const study of EXPERIMENT_STUDIES) {
  for (const arm of study.arms) {
    STUDY_BY_ARM.set(arm, study);
  }
}

export function studiesSorted(): ExperimentStudy[] {
  return [...EXPERIMENT_STUDIES].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function studyById(id: ExperimentStudyId): ExperimentStudy | undefined {
  return STUDY_BY_ID.get(id);
}

export function studyForArm(arm: string): ExperimentStudy | undefined {
  return STUDY_BY_ARM.get(arm);
}

export function studyForRun(run: HackathonRunRecord): ExperimentStudy | undefined {
  return studyForArm(experimentKey(run));
}

export function studiesMatchingArms(arms: string[]): ExperimentStudy[] {
  const seen = new Set<ExperimentStudyId>();
  const out: ExperimentStudy[] = [];
  for (const arm of arms) {
    const study = studyForArm(arm);
    if (study && !seen.has(study.id)) {
      seen.add(study.id);
      out.push(study);
    }
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function filterRunsForStudy(
  runs: HackathonRunRecord[],
  study: ExperimentStudy,
): HackathonRunRecord[] {
  const armSet = new Set<string>(study.arms);
  return runs.filter((r) => armSet.has(experimentKey(r)));
}

export function verdictLabel(verdict: ExperimentVerdict): string {
  switch (verdict) {
    case "keep":
      return "KEEP";
    case "weak-keep":
      return "WEAK KEEP";
    case "revert":
      return "REVERT";
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

export function verdictBadgeClass(verdict: ExperimentVerdict): string {
  switch (verdict) {
    case "keep":
      return "badge badge-ok";
    case "weak-keep":
      return "badge badge-warn";
    case "revert":
      return "badge badge-fail";
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

export function studyHeadline(study: ExperimentStudy): string {
  return `${study.number} — ${study.title}`;
}
