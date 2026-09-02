import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchPeople,
  getRun,
  getStoredAccessKey,
  setStoredAccessKey,
  updateRun,
} from "../lib/api";
import { ClassificationFields } from "../components/ClassificationFields";
import {
  effectiveClassification,
  hasClassificationOverlay,
  loadClassificationManifest,
  methodLabel,
} from "../lib/classification";
import {
  classificationToFormState,
  formStateToClassification,
  type ClassificationFormState,
} from "../lib/classificationForm";
import { shortRunId } from "../lib/actionFlow";
import { parseRunExport } from "../lib/parseExport";
import { humanFromRun, patchRunExportHumanAndClassification } from "../lib/runPatch";
import { HACKATHON_AUTHORS } from "../types/runExport";

export function EditRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [authors, setAuthors] = useState<string[]>([...HACKATHON_AUTHORS]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storedRun, setStoredRun] = useState<Awaited<ReturnType<typeof getRun>> | null>(null);

  const [author, setAuthor] = useState("");
  const [paste, setPaste] = useState("");
  const [appRating, setAppRating] = useState("");
  const [appComment, setAppComment] = useState("");
  const [runComment, setRunComment] = useState("");
  const [accessKey, setAccessKey] = useState(getStoredAccessKey);
  const [saving, setSaving] = useState(false);
  const [classificationForm, setClassificationForm] = useState<ClassificationFormState>(() =>
    classificationToFormState({
      line: "unknown",
      experiment: "unknown",
      run_index: null,
      display_label: "unknown · unknown",
    }),
  );
  const [overlayRunId, setOverlayRunId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const people = await fetchPeople();
        if (!cancelled && people.length > 0) setAuthors(people);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadClassificationManifest();
        const run = await getRun(id);
        if (cancelled) return;
        setStoredRun(run);
        setAuthor(run.person);
        const human = humanFromRun(run);
        setAppRating(human.app_rating !== null ? String(human.app_rating) : "");
        setAppComment(human.app_comment);
        setRunComment(human.run_comment);
        setClassificationForm(classificationToFormState(effectiveClassification(run)));
        const runId = run.data.export?.meta?.run_id || run.data.run_id;
        setOverlayRunId(hasClassificationOverlay(runId) ? runId ?? null : null);
        if (run.data.export) {
          setPaste(JSON.stringify(run.data.export, null, 2));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load run.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSave() {
    if (!storedRun || !id) return;
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(paste);
    } catch {
      setError("Export JSON is not valid JSON.");
      return;
    }

    const exportResult = parseRunExport(parsed);
    if ("error" in exportResult) {
      setError(exportResult.error);
      return;
    }

    const ratingNum = appRating.trim() === "" ? null : Number(appRating);
    if (ratingNum !== null && (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 10)) {
      setError("App rating must be a number from 0 to 10, or leave empty.");
      return;
    }
    if (!accessKey.trim()) {
      setError("Enter the shared hackathon access key to save.");
      return;
    }

    setSaving(true);
    try {
      setStoredAccessKey(accessKey.trim());
      const data = patchRunExportHumanAndClassification(
        storedRun,
        exportResult,
        {
          app_rating: ratingNum,
          app_comment: appComment.trim(),
          run_comment: runComment.trim(),
        },
        formStateToClassification(classificationForm),
      );
      await updateRun({
        id,
        person: author,
        data,
        accessKey: accessKey.trim(),
      });
      navigate(`/runs/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted page-center">Loading…</p>;
  if (!storedRun) {
    return (
      <div className="page-center">
        <div className="alert alert-error">{error || "Run not found."}</div>
      </div>
    );
  }

  const runId = storedRun.data.export?.meta?.run_id || storedRun.id;

  return (
    <div className="stack page-center">
      <p>
        <Link to={`/runs/${id}`}>← Back to run</Link>
      </p>

      <section className="panel">
        <h2>Edit run</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {methodLabel(storedRun)} · {shortRunId(runId)} — update export JSON and human fields.
        </p>

        <div className="stack">
          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="author">Author</label>
            <select id="author" value={author} onChange={(e) => setAuthor(e.target.value)}>
              {authors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <ClassificationFields
            value={classificationForm}
            onChange={setClassificationForm}
            overlayRunId={overlayRunId}
            idPrefix="edit-cls"
          />

          <div className="field">
            <label htmlFor="paste">Run export JSON</label>
            <textarea
              id="paste"
              className="code-block"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              style={{ minHeight: 280, fontFamily: "var(--mono)" }}
              spellCheck={false}
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="rating">App rating (0–10)</label>
              <input
                id="rating"
                type="number"
                min={0}
                max={10}
                step={1}
                value={appRating}
                onChange={(e) => setAppRating(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="key">Access key (write)</label>
              <input
                id="key"
                type="password"
                autoComplete="off"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Shared team key"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="appComment">App comment</label>
            <textarea
              id="appComment"
              value={appComment}
              onChange={(e) => setAppComment(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </div>

          <div className="field">
            <label htmlFor="runComment">Run comment</label>
            <textarea
              id="runComment"
              value={runComment}
              onChange={(e) => setRunComment(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </div>

          <div className="row">
            <Link to={`/runs/${id}/rate`} className="btn btn-ghost">
              Fix rating only
            </Link>
            <button type="button" className="btn" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </section>
    </div>
  );
}
