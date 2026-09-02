/** @deprecated Import from experimentCompare.ts instead. */
export {
  EXP1_RTL_COMPARE as EXP1_RTL_COHORT,
  EXPERIMENT_COMPARE_PRESETS as COHORT_PRESETS,
  experimentCompareLabelMap as cohortLabelMap,
  experimentCompareRunIds as cohortRunIds,
  EXP1_RTL_COMPARE,
  EXPERIMENT_COMPARE_PRESETS,
  STUDY_COMPARE as STUDY_COHORT,
  STUDY_COMPARE,
  type ExperimentComparePreset as CohortPreset,
  type ExperimentComparePreset,
  experimentCompareLabelMap,
  experimentCompareRunIds,
} from "./experimentCompare";

/** @deprecated use experimentCompareLabelMap("study") */
export { experimentCompareLabelMap as studyCohortLabelMap } from "./experimentCompare";
