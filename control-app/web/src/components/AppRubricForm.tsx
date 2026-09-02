import {
  APP_RUBRIC_CATEGORIES,
  APP_RUBRIC_TOTAL_MAX,
  emptyAppRubric,
  formatAppRating,
  rubricTotal,
  type AppRubricKey,
  type AppRubricScores,
} from "../../../shared/app-rubric.js";

export { formatAppRating, rubricTotal, type AppRubricScores };

type AppRubricFormProps = {
  rubric: AppRubricScores;
  onChange: (next: AppRubricScores) => void;
  idPrefix?: string;
  disabled?: boolean;
};

function scoreInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

export function AppRubricForm({ rubric, onChange, idPrefix = "rubric", disabled = false }: AppRubricFormProps) {
  const total = rubricTotal(rubric);

  function setScore(key: AppRubricKey, raw: string): void {
    const trimmed = raw.trim();
    const next: AppRubricScores = { ...rubric, [key]: trimmed === "" ? null : Number(trimmed) };
    onChange(next);
  }

  return (
    <div className="metadata-rubric-form">
      {APP_RUBRIC_CATEGORIES.map(({ key, label, max, description }) => (
        <label key={key} className="metadata-rubric-row" htmlFor={`${idPrefix}-${key}`}>
          <span className="metadata-rubric-label-block">
            <span className="metadata-label">{label}</span>
            <span className="muted metadata-hint">{description}</span>
          </span>
          <span className="metadata-rubric-score">
            <input
              id={`${idPrefix}-${key}`}
              type="number"
              min={0}
              max={max}
              step={1}
              disabled={disabled}
              value={scoreInputValue(rubric[key])}
              onChange={(event) => setScore(key, event.target.value)}
              aria-label={`${label} score out of ${max}`}
            />
            <span className="muted">/ {max}</span>
          </span>
        </label>
      ))}
      <div className="metadata-rubric-total" aria-live="polite">
        <span className="metadata-label">Total</span>
        <strong>{total !== null ? `${total} / ${APP_RUBRIC_TOTAL_MAX}` : `— / ${APP_RUBRIC_TOTAL_MAX}`}</strong>
      </div>
    </div>
  );
}

export function emptyRubricState(): AppRubricScores {
  return emptyAppRubric();
}

export function rubricFromOverlay(
  rubric: AppRubricScores | null | undefined,
): AppRubricScores {
  if (!rubric) return emptyAppRubric();
  return {
    usability_ux: rubric.usability_ux ?? null,
    data_state_persistence: rubric.data_state_persistence ?? null,
    robustness: rubric.robustness ?? null,
    api_integration_readiness: rubric.api_integration_readiness ?? null,
    maintainability_extensibility: rubric.maintainability_extensibility ?? null,
  };
}

export function ratingChipLabel(
  appRating: number | null | undefined,
  rubric: AppRubricScores | null | undefined,
): string | null {
  if (appRating == null && rubricTotal(rubric) === null) return null;
  const formatted = formatAppRating(appRating, rubric);
  return formatted === "—" ? null : `★ ${formatted}`;
}
