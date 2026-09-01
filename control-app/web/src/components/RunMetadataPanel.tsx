import { useEffect, useMemo, useState } from "react";
import {
  createExperiment,
  fetchExperiments,
  fetchRunOverlay,
  patchRunOverlay,
  type ExperimentListEntry,
  type RunOverlayEntry,
  type RunOverlayPatch,
} from "../lib/api.js";
import type { AppRubricScores } from "../../../shared/app-rubric.js";
import { rubricTotal } from "../../../shared/app-rubric.js";
import {
  AppRubricForm,
  ratingChipLabel,
  rubricFromOverlay,
} from "./AppRubricForm.js";

interface RunMetadataPanelProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestGitBranch?: string | null;
  manifestGitCommit?: string | null;
  summaryLabel?: string | null;
  summaryAuthor?: string | null;
  summaryRating?: number | null;
  summaryRubric?: AppRubricScores | null;
  onSaved?: () => void;
}

const EXPERIMENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

function buildAutoLabel(experiment: string, runIndex: string): string {
  const parts = [experiment].filter((part) => part && part !== "unknown");
  const indexNum = runIndex.trim() === "" ? null : Number(runIndex);
  if (indexNum !== null && Number.isFinite(indexNum)) {
    parts.push(`run ${indexNum}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "unknown";
}

function applyExperimentSelection(
  overlay: RunOverlayEntry | null,
  catalog: ExperimentListEntry[],
): {
  experimentSelect: string;
  newExperimentId: string;
  newExperimentTitle: string;
  newExperimentDescription: string;
} {
  const slug = overlay?.experiment_id ?? overlay?.classification?.experiment ?? "unknown";
  const inCatalog = catalog.some((entry) => entry.id === slug);
  if (inCatalog || slug === "unknown") {
    return {
      experimentSelect: slug,
      newExperimentId: "",
      newExperimentTitle: "",
      newExperimentDescription: "",
    };
  }
  return {
    experimentSelect: "__new__",
    newExperimentId: slug,
    newExperimentTitle: slug,
    newExperimentDescription: "",
  };
}

export function RunMetadataPanel({
  runId,
  open,
  onOpenChange,
  manifestGitBranch,
  manifestGitCommit,
  summaryLabel,
  summaryAuthor,
  summaryRating,
  summaryRubric,
  onSaved,
}: RunMetadataPanelProps) {
  const [loading, setLoading] = useState(true);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<ExperimentListEntry[]>([]);
  const [overlaySnapshot, setOverlaySnapshot] = useState<RunOverlayEntry | null>(null);
  const [author, setAuthor] = useState("");
  const [authorCustom, setAuthorCustom] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [experimentSelect, setExperimentSelect] = useState("unknown");
  const [newExperimentId, setNewExperimentId] = useState("");
  const [newExperimentTitle, setNewExperimentTitle] = useState("");
  const [newExperimentDescription, setNewExperimentDescription] = useState("");
  const [runIndex, setRunIndex] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [displayLabelManual, setDisplayLabelManual] = useState(false);
  const [legacyApproach, setLegacyApproach] = useState("");
  const [appRubric, setAppRubric] = useState<AppRubricScores>(() => rubricFromOverlay(null));
  const [appComment, setAppComment] = useState("");
  const [runComment, setRunComment] = useState("");
  const [excludeFromRanking, setExcludeFromRanking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchRunOverlay(runId)
      .then((payload) => {
        if (cancelled) return;
        setAuthors(payload.authors);
        setOverlaySnapshot(payload.overlay);
        applyOverlayFields(payload.overlay, payload.authors);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setExperimentsLoading(true);
    void fetchExperiments()
      .then((payload) => {
        if (cancelled) return;
        setExperiments(payload.experiments);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setExperimentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, runId]);

  useEffect(() => {
    const selection = applyExperimentSelection(overlaySnapshot, experiments);
    setExperimentSelect(selection.experimentSelect);
    setNewExperimentId(selection.newExperimentId);
    setNewExperimentTitle(selection.newExperimentTitle);
    setNewExperimentDescription(selection.newExperimentDescription);
  }, [overlaySnapshot, experiments]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !saving) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange, saving]);

  function applyOverlayFields(overlay: RunOverlayEntry | null, authorList: string[]): void {
    const knownAuthor = overlay?.author ?? "";
    const authorInList = knownAuthor && authorList.includes(knownAuthor);
    setAuthor(authorInList ? knownAuthor : knownAuthor ? "__custom__" : "");
    setAuthorCustom(authorInList ? "" : knownAuthor);
    setGitBranch(overlay?.git_branch ?? "");
    setGitCommit(overlay?.git_commit ?? "");
    setRunIndex(
      overlay?.classification?.run_index !== null && overlay?.classification?.run_index !== undefined
        ? String(overlay.classification.run_index)
        : "",
    );
    setDisplayLabel(overlay?.classification?.display_label ?? "");
    setDisplayLabelManual(Boolean(overlay?.classification?.display_label?.trim()));
    setLegacyApproach(overlay?.classification?.legacy_approach ?? "");
    setAppRubric(rubricFromOverlay(overlay?.human.app_rubric));
    setAppComment(overlay?.human.app_comment ?? "");
    setRunComment(overlay?.human.run_comment ?? "");
    setExcludeFromRanking(overlay?.flags.exclude_from_ranking ?? false);
  }

  const resolvedExperimentSlug =
    experimentSelect === "__new__" ? newExperimentId.trim() : experimentSelect;

  const autoLabel = useMemo(
    () => buildAutoLabel(resolvedExperimentSlug, runIndex),
    [resolvedExperimentSlug, runIndex],
  );

  useEffect(() => {
    if (!displayLabelManual) {
      setDisplayLabel(autoLabel);
    }
  }, [autoLabel, displayLabelManual]);

  const resolvedAuthorDisplay =
    author === "__custom__" ? authorCustom.trim() : author.trim();

  const collapsedRatingLabel = ratingChipLabel(
    summaryRating ?? overlaySnapshot?.human.app_rating ?? null,
    summaryRubric ?? overlaySnapshot?.human.app_rubric ?? appRubric,
  );

  function closeModal(): void {
    if (saving) return;
    onOpenChange(false);
  }

  async function onSave(): Promise<void> {
    setError(null);
    setSaved(false);

    for (const score of Object.values(appRubric)) {
      if (score === null) continue;
      if (!Number.isFinite(score)) {
        setError("Each rubric score must be a whole number or empty.");
        return;
      }
    }

    const resolvedAuthor =
      author === "__custom__" ? authorCustom.trim() || null : author.trim() || null;
    const indexTrimmed = runIndex.trim();
    const runIndexNum = indexTrimmed === "" ? null : Number(indexTrimmed);
    if (runIndexNum !== null && !Number.isFinite(runIndexNum)) {
      setError("Run index must be a number or empty.");
      return;
    }

    let experimentId = resolvedExperimentSlug;
    if (experimentSelect === "__new__") {
      if (!experimentId) {
        setError("Experiment id is required.");
        return;
      }
      if (!EXPERIMENT_ID_PATTERN.test(experimentId)) {
        setError("Experiment id must be lowercase letters, numbers, and hyphens (e.g. exp7-foo-treatment).");
        return;
      }
    } else if (!experimentId) {
      experimentId = "unknown";
    }

    setSaving(true);
    try {
      if (experimentSelect === "__new__") {
        const created = await createExperiment({
          id: experimentId,
          title: newExperimentTitle.trim() || experimentId,
          description: newExperimentDescription.trim(),
          created_by: resolvedAuthor,
        });
        setExperiments((current) =>
          [
            ...current.filter((entry) => entry.id !== created.experiment.id),
            {
              id: created.experiment.id,
              title: created.experiment.title,
              description: created.experiment.description,
              status: created.experiment.status,
              created_at: created.experiment.created_at,
              updated_at: created.experiment.updated_at,
              has_catalog: true,
              source: "catalog" as const,
              run_count: 0,
            },
          ].sort((a, b) => a.id.localeCompare(b.id)),
        );
        setExperimentSelect(created.experiment.id);
      }

      const patch: RunOverlayPatch = {
        author: resolvedAuthor,
        git_branch: gitBranch.trim() || null,
        git_commit: gitCommit.trim() || null,
        experiment_id: experimentId === "unknown" ? null : experimentId,
        classification: {
          experiment: experimentId,
          run_index: runIndexNum,
          display_label: displayLabel.trim() || autoLabel,
          legacy_approach: legacyApproach.trim() || null,
        },
        human: {
          app_rubric: appRubric,
          app_rating: rubricTotal(appRubric),
          app_comment: appComment.trim(),
          run_comment: runComment.trim(),
        },
        flags: {
          exclude_from_ranking: excludeFromRanking,
        },
      };

      await patchRunOverlay(runId, patch);
      setSaved(true);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const hasSummary =
    Boolean(resolvedAuthorDisplay || summaryAuthor || summaryLabel || displayLabel) ||
    collapsedRatingLabel !== null ||
    excludeFromRanking;

  const modalLoading = loading || (open && experimentsLoading);

  return (
    <>
      <div className="station-card metadata-summary-card">
        <div className="metadata-summary-card-main">
          <div>
            <h3>Run metadata</h3>
            {loading ? (
              <p className="muted metadata-summary-hint">Loading…</p>
            ) : hasSummary ? (
              <div className="metadata-summary-row">
                {resolvedAuthorDisplay || summaryAuthor ? (
                  <span className="metadata-chip metadata-chip-author">
                    {summaryAuthor || resolvedAuthorDisplay}
                  </span>
                ) : null}
                {summaryLabel || displayLabel ? (
                  <span className="metadata-chip metadata-chip-label">
                    {summaryLabel || displayLabel}
                  </span>
                ) : null}
                {collapsedRatingLabel ? (
                  <span className="metadata-chip metadata-chip-rating">{collapsedRatingLabel}</span>
                ) : null}
                {excludeFromRanking ? (
                  <span className="metadata-chip metadata-chip-muted">Excluded</span>
                ) : null}
              </div>
            ) : (
              <p className="muted metadata-summary-hint">Author, experiment label, rating, and notes</p>
            )}
          </div>
          <button
            type="button"
            className="secondary metadata-toggle"
            disabled={loading}
            onClick={() => onOpenChange(true)}
          >
            Edit metadata
          </button>
        </div>
      </div>

      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="modal metadata-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`metadata-modal-title-${runId}`}
          >
            <header className="metadata-modal-head">
              <div>
                <p className="eyebrow">Overlay</p>
                <h2 id={`metadata-modal-title-${runId}`}>Edit run metadata</h2>
                <p className="muted metadata-modal-subtitle">
                  Experiments live in <code>artifacts/experiments/</code>; run notes in{" "}
                  <code>artifacts/runs-overlay.json</code>.
                </p>
              </div>
              <button
                type="button"
                className="secondary metadata-modal-close"
                disabled={saving}
                aria-label="Close"
                onClick={closeModal}
              >
                ✕
              </button>
            </header>

            {modalLoading ? (
              <p className="muted metadata-modal-loading">Loading metadata…</p>
            ) : (
              <form
                className="metadata-form-body metadata-modal-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSave();
                }}
              >
                <section className="metadata-section">
                  <div className="metadata-section-head">
                    <h4 className="metadata-section-title">Classification</h4>
                    <p className="metadata-section-desc">How this run is grouped and labeled in lists.</p>
                  </div>
                  <div className="metadata-section-grid metadata-section-grid-3">
                    <label className="metadata-field" htmlFor={`meta-author-${runId}`}>
                      <span className="metadata-label">Author</span>
                      <select
                        id={`meta-author-${runId}`}
                        value={author}
                        onChange={(event) => setAuthor(event.target.value)}
                      >
                        <option value="">—</option>
                        {authors.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="__custom__">Other…</option>
                      </select>
                    </label>

                    {author === "__custom__" ? (
                      <label className="metadata-field" htmlFor={`meta-author-custom-${runId}`}>
                        <span className="metadata-label">Custom author</span>
                        <input
                          id={`meta-author-custom-${runId}`}
                          value={authorCustom}
                          onChange={(event) => setAuthorCustom(event.target.value)}
                          placeholder="Name"
                        />
                      </label>
                    ) : null}

                    <label className="metadata-field" htmlFor={`meta-experiment-${runId}`}>
                      <span className="metadata-label">Experiment</span>
                      <select
                        id={`meta-experiment-${runId}`}
                        value={experimentSelect}
                        onChange={(event) => setExperimentSelect(event.target.value)}
                      >
                        <option value="unknown">unknown</option>
                        {experiments.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title} ({entry.id})
                            {!entry.has_catalog ? " · used only" : ""}
                          </option>
                        ))}
                        <option value="__new__">Create new…</option>
                      </select>
                    </label>

                    <label className="metadata-field" htmlFor={`meta-run-index-${runId}`}>
                      <span className="metadata-label">Run index</span>
                      <input
                        id={`meta-run-index-${runId}`}
                        type="number"
                        min={0}
                        step={1}
                        value={runIndex}
                        onChange={(event) => setRunIndex(event.target.value)}
                        placeholder="optional"
                      />
                    </label>
                  </div>

                  {experimentSelect === "__new__" ? (
                    <div className="metadata-new-experiment">
                      <label className="metadata-field" htmlFor={`meta-new-exp-id-${runId}`}>
                        <span className="metadata-label">New experiment id</span>
                        <input
                          id={`meta-new-exp-id-${runId}`}
                          value={newExperimentId}
                          onChange={(event) => setNewExperimentId(event.target.value.toLowerCase())}
                          placeholder="exp7-planner-treatment"
                          spellCheck={false}
                        />
                        <span className="muted metadata-hint">Lowercase slug — becomes the folder name.</span>
                      </label>
                      <label className="metadata-field" htmlFor={`meta-new-exp-title-${runId}`}>
                        <span className="metadata-label">Title</span>
                        <input
                          id={`meta-new-exp-title-${runId}`}
                          value={newExperimentTitle}
                          onChange={(event) => setNewExperimentTitle(event.target.value)}
                          placeholder="Human-readable name"
                        />
                      </label>
                      <label className="metadata-field metadata-field-block" htmlFor={`meta-new-exp-desc-${runId}`}>
                        <span className="metadata-label">Description</span>
                        <textarea
                          id={`meta-new-exp-desc-${runId}`}
                          value={newExperimentDescription}
                          onChange={(event) => setNewExperimentDescription(event.target.value)}
                          rows={2}
                          placeholder="What this experiment tests…"
                        />
                      </label>
                    </div>
                  ) : null}

                  <label className="metadata-field metadata-field-block" htmlFor={`meta-label-${runId}`}>
                    <span className="metadata-label-row">
                      <span className="metadata-label">Display label</span>
                      {!displayLabelManual ? (
                        <span className="metadata-badge">Auto</span>
                      ) : (
                        <button
                          type="button"
                          className="metadata-text-btn"
                          onClick={() => {
                            setDisplayLabelManual(false);
                            setDisplayLabel(autoLabel);
                          }}
                        >
                          Reset to auto
                        </button>
                      )}
                    </span>
                    <input
                      id={`meta-label-${runId}`}
                      value={displayLabel}
                      onChange={(event) => {
                        setDisplayLabel(event.target.value);
                        setDisplayLabelManual(true);
                      }}
                    />
                    {!displayLabelManual ? (
                      <span className="muted metadata-hint">Built from experiment and run index.</span>
                    ) : null}
                  </label>
                </section>

                <section className="metadata-section">
                  <div className="metadata-section-head">
                    <h4 className="metadata-section-title">Review</h4>
                    <p className="metadata-section-desc">Human scores and notes for the generated app.</p>
                  </div>

                  <div className="metadata-rating-block">
                    <span className="metadata-label">App rating (100-point rubric)</span>
                    <AppRubricForm
                      idPrefix={`meta-rubric-${runId}`}
                      rubric={appRubric}
                      disabled={saving}
                      onChange={setAppRubric}
                    />
                  </div>

                  <label className="metadata-toggle-row">
                    <input
                      type="checkbox"
                      checked={excludeFromRanking}
                      onChange={(event) => setExcludeFromRanking(event.target.checked)}
                    />
                    <span>
                      <span className="metadata-toggle-label">Exclude from ranking</span>
                      <span className="muted metadata-toggle-hint">
                        Hide from leaderboard-style comparisons.
                      </span>
                    </span>
                  </label>

                  <div className="metadata-comments-grid">
                    <label className="metadata-field" htmlFor={`meta-app-comment-${runId}`}>
                      <span className="metadata-label">App comment</span>
                      <textarea
                        id={`meta-app-comment-${runId}`}
                        value={appComment}
                        onChange={(event) => setAppComment(event.target.value)}
                        rows={4}
                        placeholder="Quality of the shipped app…"
                      />
                    </label>
                    <label className="metadata-field" htmlFor={`meta-run-comment-${runId}`}>
                      <span className="metadata-label">Run comment</span>
                      <textarea
                        id={`meta-run-comment-${runId}`}
                        value={runComment}
                        onChange={(event) => setRunComment(event.target.value)}
                        rows={4}
                        placeholder="Agent behavior, failures, surprises…"
                      />
                    </label>
                  </div>
                </section>

                <details className="metadata-advanced">
                  <summary>Advanced overrides</summary>
                  <p className="muted metadata-advanced-desc">
                    Optional git pins and legacy tags. Manifest git
                    {manifestGitBranch ? (
                      <>
                        {" "}
                        is <code>{manifestGitBranch}</code>
                        {manifestGitCommit ? <> @ <code>{manifestGitCommit.slice(0, 8)}</code></> : null}.
                      </>
                    ) : (
                      " is not recorded for this run."
                    )}
                  </p>
                  <div className="metadata-section-grid metadata-section-grid-2">
                    <label className="metadata-field" htmlFor={`meta-git-branch-${runId}`}>
                      <span className="metadata-label">Git branch</span>
                      <input
                        id={`meta-git-branch-${runId}`}
                        value={gitBranch}
                        onChange={(event) => setGitBranch(event.target.value)}
                        placeholder={manifestGitBranch ?? "optional"}
                      />
                    </label>
                    <label className="metadata-field" htmlFor={`meta-git-commit-${runId}`}>
                      <span className="metadata-label">Git commit</span>
                      <input
                        id={`meta-git-commit-${runId}`}
                        value={gitCommit}
                        onChange={(event) => setGitCommit(event.target.value)}
                        placeholder={manifestGitCommit?.slice(0, 8) ?? "optional"}
                      />
                    </label>
                    <label className="metadata-field metadata-field-block" htmlFor={`meta-legacy-${runId}`}>
                      <span className="metadata-label">Legacy approach</span>
                      <input
                        id={`meta-legacy-${runId}`}
                        value={legacyApproach}
                        onChange={(event) => setLegacyApproach(event.target.value)}
                      />
                    </label>
                  </div>
                </details>

                {error ? <div className="error-banner metadata-error">{error}</div> : null}

                <footer className="metadata-footer metadata-modal-footer">
                  <div className="metadata-footer-actions">
                    <button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save metadata"}
                    </button>
                    <button type="button" className="secondary" disabled={saving} onClick={closeModal}>
                      Cancel
                    </button>
                    {saved ? <span className="metadata-saved">Saved</span> : null}
                  </div>
                </footer>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
