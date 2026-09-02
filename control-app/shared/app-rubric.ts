/** Hackathon 100-point app quality rubric (matches V2 spec §4). */

export const APP_RUBRIC_MAX = {
  usability_ux: 30,
  data_state_persistence: 20,
  robustness: 20,
  api_integration_readiness: 15,
  maintainability_extensibility: 15,
} as const;

export type AppRubricKey = keyof typeof APP_RUBRIC_MAX;

export type AppRubricScores = Record<AppRubricKey, number | null>;

export type AppRubricCategory = {
  key: AppRubricKey;
  label: string;
  max: number;
  description: string;
};

export const APP_RUBRIC_CATEGORIES: AppRubricCategory[] = [
  {
    key: "usability_ux",
    label: "Usability & UX",
    max: APP_RUBRIC_MAX.usability_ux,
    description:
      "Clear navigation, responsive layout, intuitive user actions, validation feedback, and clean error messages.",
  },
  {
    key: "data_state_persistence",
    label: "Data & State Persistence",
    max: APP_RUBRIC_MAX.data_state_persistence,
    description: "Reliable state handling across page refreshes and clean data structure design.",
  },
  {
    key: "robustness",
    label: "Robustness",
    max: APP_RUBRIC_MAX.robustness,
    description:
      "Graceful handling of invalid inputs, edge cases, repeated operations, and runtime failure recovery.",
  },
  {
    key: "api_integration_readiness",
    label: "API & Integration Readiness",
    max: APP_RUBRIC_MAX.api_integration_readiness,
    description:
      "Decoupled component boundaries allowing future database or external service integration.",
  },
  {
    key: "maintainability_extensibility",
    label: "Maintainability & Extensibility",
    max: APP_RUBRIC_MAX.maintainability_extensibility,
    description:
      "Clean project layout, clear separation of concerns, and legible code that another developer or agent can extend.",
  },
];

export const APP_RUBRIC_TOTAL_MAX = Object.values(APP_RUBRIC_MAX).reduce((sum, max) => sum + max, 0);

/** Legacy overlay entries used a single 0–10 score before the rubric. */
export const LEGACY_RATING_MAX = 10;

export function emptyAppRubric(): AppRubricScores {
  return {
    usability_ux: null,
    data_state_persistence: null,
    robustness: null,
    api_integration_readiness: null,
    maintainability_extensibility: null,
  };
}

export function isLegacyAppRating(
  appRating: number | null | undefined,
  rubric: AppRubricScores | null | undefined,
): boolean {
  if (rubric && hasAnyRubricScore(rubric)) return false;
  if (appRating === null || appRating === undefined) return false;
  return appRating <= LEGACY_RATING_MAX;
}

export function hasAnyRubricScore(rubric: AppRubricScores | null | undefined): boolean {
  if (!rubric) return false;
  return APP_RUBRIC_CATEGORIES.some(({ key }) => rubric[key] !== null && rubric[key] !== undefined);
}

export function rubricTotal(rubric: AppRubricScores | null | undefined): number | null {
  if (!rubric) return null;
  let total = 0;
  for (const { key } of APP_RUBRIC_CATEGORIES) {
    const value = rubric[key];
    if (value === null || value === undefined) return null;
    total += value;
  }
  return total;
}

export function effectiveRatingForCompare(
  appRating: number | null | undefined,
  rubric: AppRubricScores | null | undefined,
): number | null {
  const fromRubric = rubricTotal(rubric);
  if (fromRubric !== null) return fromRubric;
  if (appRating === null || appRating === undefined) return null;
  if (isLegacyAppRating(appRating, rubric)) return appRating * 10;
  return appRating;
}

export function formatAppRating(
  appRating: number | null | undefined,
  rubric: AppRubricScores | null | undefined,
): string {
  const fromRubric = rubricTotal(rubric);
  if (fromRubric !== null) return `${fromRubric}/${APP_RUBRIC_TOTAL_MAX}`;
  if (appRating === null || appRating === undefined) return "—";
  if (isLegacyAppRating(appRating, rubric)) return `${appRating}/${LEGACY_RATING_MAX} (legacy)`;
  return `${appRating}/${APP_RUBRIC_TOTAL_MAX}`;
}

function validateRubricField(key: AppRubricKey, value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  const max = APP_RUBRIC_MAX[key];
  if (!Number.isFinite(num) || num < 0 || num > max) {
    throw new Error(`${key} must be a number from 0 to ${max}, or null`);
  }
  return Math.round(num);
}

export function validateAppRubric(raw: Partial<AppRubricScores> | null | undefined): AppRubricScores | null {
  if (!raw) return null;
  const scores: AppRubricScores = emptyAppRubric();
  for (const { key } of APP_RUBRIC_CATEGORIES) {
    scores[key] = validateRubricField(key, raw[key]);
  }
  return hasAnyRubricScore(scores) ? scores : null;
}

export function mergeAppRubric(
  current: AppRubricScores | null | undefined,
  patch: Partial<AppRubricScores> | null | undefined,
): AppRubricScores | null {
  if (patch === null) return null;
  if (patch === undefined) return current ?? null;
  const base = current ?? emptyAppRubric();
  const merged: AppRubricScores = { ...base };
  for (const { key } of APP_RUBRIC_CATEGORIES) {
    if (patch[key] !== undefined) {
      merged[key] = validateRubricField(key, patch[key]);
    }
  }
  return hasAnyRubricScore(merged) ? merged : null;
}

export function validateAppRatingTotal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > APP_RUBRIC_TOTAL_MAX) {
    throw new Error(`app_rating must be a number from 0 to ${APP_RUBRIC_TOTAL_MAX}, or null`);
  }
  return Math.round(num);
}

export function resolveStoredAppRating(
  appRating: number | null | undefined,
  rubric: AppRubricScores | null | undefined,
): number | null {
  const fromRubric = rubricTotal(rubric);
  if (fromRubric !== null) return fromRubric;
  return appRating ?? null;
}
