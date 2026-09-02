import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getRun,
  getStoredAccessKey,
  setStoredAccessKey,
  updateRun,
} from "../lib/api";
import { methodLabel, loadClassificationManifest } from "../lib/classification";
import { shortRunId } from "../lib/actionFlow";
import { humanFromRun, patchRunHumanFields } from "../lib/runPatch";
import { formatNumber, weightedOf } from "../lib/stats";

export function FixRatingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [runIdLabel, setRunIdLabel] = useState("");
  const [status, setStatus] = useState("");
  const [weighted, setWeighted] = useState<number | null>(null);
  const [storedRun, setStoredRun] = useState<Awaited<ReturnType<typeof getRun>> | null>(null);

  const [appRating, setAppRating] = useState("");
  const [runComment, setRunComment] = useState("");
  const [accessKey, setAccessKey] = useState(getStoredAccessKey);
  const [saving, setSaving] = useState(false);

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
        const human = humanFromRun(run);
        setTitle(methodLabel(run));
        setRunIdLabel(shortRunId(run.data.export?.meta?.run_id || run.id));
        setStatus(run.data.export?.harness?.status || "—");
        setWeighted(weightedOf(run));
        setAppRating(human.app_rating !== null ? String(human.app_rating) : "");
        setRunComment(human.run_comment);
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
      const data = patchRunHumanFields(storedRun, {
        app_rating: ratingNum,
        app_comment: storedRun.data.human?.app_comment ?? storedRun.data.app_comment ?? "",
        run_comment: runComment.trim(),
      });
      await updateRun({
        id,
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

  return (
    <div className="stack page-center">
      <p>
        <Link to={id ? `/runs/${id}` : "/"}>← Back to run</Link>
      </p>

      <section className="panel">
        <h2>Fix rating</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {title} · {runIdLabel} · status {status}
          {weighted !== null ? ` · weighted ${formatNumber(weighted, 0)}` : ""}
        </p>

        <div className="stack">
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
                placeholder="e.g. 9"
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
            <label htmlFor="runComment">Run comment (optional)</label>
            <textarea
              id="runComment"
              value={runComment}
              onChange={(e) => setRunComment(e.target.value)}
              style={{ minHeight: 90 }}
              placeholder="Notes about the run / approach…"
            />
          </div>

          <div className="row">
            <Link to={id ? `/runs/${id}/edit` : "/"} className="btn btn-ghost">
              Edit full run instead
            </Link>
            <button type="button" className="btn" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save rating"}
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </section>
    </div>
  );
}
