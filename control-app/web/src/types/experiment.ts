import type { ClassificationExperiment, ClassificationLine } from "./runExport";

export type ExperimentStudyId =
  | "exp1-rtl"
  | "exp2-stop"
  | "exp3-test-policy"
  | "exp4-digest"
  | "exp5-template"
  | "exp5b-storage"
  | "exp6-reporter";

export type ExperimentVerdict = "keep" | "weak-keep" | "revert";

export type ExperimentComparePreset = "study" | "exp1-rtl";

export type ExperimentStudy = {
  id: ExperimentStudyId;
  number: string;
  title: string;
  line?: ClassificationLine;
  verdict: ExperimentVerdict;
  change: string;
  goal: string;
  result: string;
  arms: ClassificationExperiment[];
  /** Curated compare view on /compare (e.g. Exp1 RTL 10-run set). */
  comparePreset?: ExperimentComparePreset;
  /** @deprecated use comparePreset */
  cohortPreset?: ExperimentComparePreset;
  supersedes?: ExperimentStudyId;
  buildsOn?: ExperimentStudyId;
  sortOrder: number;
};

/** @deprecated use ExperimentComparePreset */
export type ExperimentCohortPreset = ExperimentComparePreset;
