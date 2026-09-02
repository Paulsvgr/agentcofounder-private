import type {
  ClassificationExperiment,
  ClassificationLine,
  HackathonRunRecord,
  RunClassification,
  RunExport,
} from "../types/runExport";
import { buildDisplayLabel, deriveClassification } from "./classification";

export type ClassificationFormState = {
  line: ClassificationLine;
  experiment: ClassificationExperiment;
  runIndex: string;
  displayLabel: string;
  displayLabelManual: boolean;
  legacyApproach: string;
};

export function classificationToFormState(cls: RunClassification): ClassificationFormState {
  return {
    line: cls.line,
    experiment: cls.experiment,
    runIndex: cls.run_index !== null ? String(cls.run_index) : "",
    displayLabel: cls.display_label,
    displayLabelManual: Boolean(cls.display_label),
    legacyApproach: cls.legacy_approach ?? "",
  };
}

export function parseRunIndexInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

export function formStateToClassification(state: ClassificationFormState): RunClassification {
  const run_index = parseRunIndexInput(state.runIndex);
  const display_label =
    state.displayLabel.trim() || buildDisplayLabel(state.line, state.experiment, run_index);
  const legacy = state.legacyApproach.trim();
  return {
    line: state.line,
    experiment: state.experiment,
    run_index,
    display_label,
    ...(legacy ? { legacy_approach: legacy } : {}),
  };
}

export function classificationFromExport(exportDoc: RunExport): RunClassification {
  if (exportDoc.meta.classification?.display_label) {
    return exportDoc.meta.classification;
  }
  const stub: HackathonRunRecord = {
    id: "",
    created_at: "",
    updated_at: "",
    person: "",
    data: {
      export: exportDoc,
      run_id: exportDoc.meta.run_id,
      git_branch: exportDoc.meta.git_branch,
      git_commit: exportDoc.meta.git_commit,
      approach_kind: exportDoc.meta.approach,
      app_rubric: null,
      app_rating: null,
      app_comment: "",
      run_comment: "",
    },
  };
  return deriveClassification(stub);
}

export function applyClassificationFieldPatch(
  state: ClassificationFormState,
  patch: Partial<Pick<ClassificationFormState, "line" | "experiment" | "runIndex">>,
): ClassificationFormState {
  const next = { ...state, ...patch };
  if (!next.displayLabelManual) {
    next.displayLabel = buildDisplayLabel(
      next.line,
      next.experiment,
      parseRunIndexInput(next.runIndex),
    );
  }
  return next;
}
