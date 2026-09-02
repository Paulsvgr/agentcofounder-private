import { EXPERIMENTS, LINES } from "../lib/classification";
import {
  applyClassificationFieldPatch,
  type ClassificationFormState,
} from "../lib/classificationForm";

type Props = {
  value: ClassificationFormState;
  onChange: (next: ClassificationFormState) => void;
  overlayRunId?: string | null;
  idPrefix?: string;
};

export function ClassificationFields({
  value,
  onChange,
  overlayRunId,
  idPrefix = "cls",
}: Props) {
  function setField(patch: Partial<ClassificationFormState>) {
    onChange({ ...value, ...patch });
  }

  function setStructural(
    patch: Partial<Pick<ClassificationFormState, "line" | "experiment" | "runIndex">>,
  ) {
    onChange(applyClassificationFieldPatch(value, patch));
  }

  return (
    <fieldset className="stack" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1rem" }}>
      <legend style={{ padding: "0 0.35rem" }}>Classification</legend>

      {overlayRunId ? (
        <div className="alert alert-warn" style={{ margin: 0 }}>
          This run also has a classification entry in{" "}
          <code>runs-classification.json</code> ({overlayRunId}). That overlay wins in the UI until
          the manifest is updated.
        </div>
      ) : null}

      <div className="row">
        <div className="field">
          <label htmlFor={`${idPrefix}-line`}>Line</label>
          <select
            id={`${idPrefix}-line`}
            value={value.line}
            onChange={(e) =>
              setStructural({ line: e.target.value as ClassificationFormState["line"] })
            }
          >
            {LINES.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "2 1 240px" }}>
          <label htmlFor={`${idPrefix}-experiment`}>Experiment</label>
          <select
            id={`${idPrefix}-experiment`}
            value={value.experiment}
            onChange={(e) =>
              setStructural({
                experiment: e.target.value as ClassificationFormState["experiment"],
              })
            }
          >
            {EXPERIMENTS.map((experiment) => (
              <option key={experiment} value={experiment}>
                {experiment}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-runIndex`}>Run index</label>
          <input
            id={`${idPrefix}-runIndex`}
            type="number"
            min={0}
            step={1}
            value={value.runIndex}
            onChange={(e) => setStructural({ runIndex: e.target.value })}
            placeholder="optional"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-displayLabel`}>Display label</label>
        <input
          id={`${idPrefix}-displayLabel`}
          value={value.displayLabel}
          onChange={(e) =>
            setField({ displayLabel: e.target.value, displayLabelManual: true })
          }
          placeholder="F · exp3 test treatment · run 4"
        />
        {!value.displayLabelManual ? (
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
            Auto-built from line, experiment, and run index.
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-legacyApproach`}>Legacy approach (optional)</label>
        <input
          id={`${idPrefix}-legacyApproach`}
          value={value.legacyApproach}
          onChange={(e) => setField({ legacyApproach: e.target.value })}
          placeholder="test-policy-treatment-4"
        />
      </div>
    </fieldset>
  );
}
