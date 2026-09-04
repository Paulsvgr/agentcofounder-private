export const EXPERIMENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const EXPERIMENT_ID_ERROR =
  "Experiment id must be lowercase letters, numbers, and hyphens (1–80 chars), e.g. exp7-planner-treatment";

export function isValidExperimentId(id: string): boolean {
  return EXPERIMENT_ID_PATTERN.test(id.trim());
}

export function assertValidExperimentId(id: string): void {
  if (!isValidExperimentId(id)) {
    throw new Error(EXPERIMENT_ID_ERROR);
  }
}
