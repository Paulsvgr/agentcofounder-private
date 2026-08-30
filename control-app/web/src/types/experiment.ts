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

export type ExperimentCohortPreset = "study" | "exp1-rtl";

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
  cohortPreset?: ExperimentCohortPreset;
  supersedes?: ExperimentStudyId;
  buildsOn?: ExperimentStudyId;
  sortOrder: number;
};
