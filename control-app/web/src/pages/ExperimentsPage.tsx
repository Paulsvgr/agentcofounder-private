import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createExperiment,
  fetchExperiments,
  materializeExperiment,
  patchExperiment,
  type ExperimentListEntry,
  type ExperimentRecord,
} from "../lib/api.js";
import { EXPERIMENT_ID_PATTERN } from "../../../shared/experiment-id.js";

function sourceBadge(source: ExperimentListEntry["source"]): string {
  switch (source) {
    case "catalog":
      return "badge badge-analyzed";
    case "used-only":
      return "badge badge-partial";
    case "both":
      return "badge badge-success";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function sourceLabel(source: ExperimentListEntry["source"]): string {
  switch (source) {
    case "catalog":
      return "catalog";
    case "used-only":
      return "used only";
    case "both":
      return "catalog + runs";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

interface EditState {
  id: string;
  title: string;
  description: string;
  status: "active" | "archived";
  hasCatalog: boolean;
}

export function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);

  const [newId, setNewId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  async function load(): Promise<void> {
    setError(null);
    const payload = await fetchExperiments();
    setExperiments(payload.experiments);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return experiments;
    return experiments.filter(
      (entry) =>
        entry.id.includes(needle) ||
        entry.title.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle),
    );
  }, [experiments, search]);

  const stats = useMemo(() => {
    const usedOnly = experiments.filter((entry) => entry.source === "used-only").length;
    const withRuns = experiments.filter((entry) => entry.run_count > 0).length;
    return { total: experiments.length, usedOnly, withRuns };
  }, [experiments]);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    const id = newId.trim().toLowerCase();
    if (!EXPERIMENT_ID_PATTERN.test(id)) {
      setError("Experiment id must be lowercase letters, numbers, and hyphens.");
      return;
    }
    setCreating(true);
    try {
      await createExperiment({
        id,
        title: newTitle.trim() || id,
        description: newDescription.trim(),
      });
      setNewId("");
      setNewTitle("");
      setNewDescription("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(entry: ExperimentListEntry): void {
    setEdit({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      status: entry.status,
      hasCatalog: entry.has_catalog,
    });
  }

  async function onMaterialize(entry: ExperimentListEntry): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await materializeExperiment(entry.id, { title: entry.title, description: entry.description });
      await load();
      openEdit({ ...entry, has_catalog: true, source: entry.run_count > 0 ? "both" : "catalog" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Materialize failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!edit) return;
    setError(null);
    setSaving(true);
    try {
      if (!edit.hasCatalog) {
        await materializeExperiment(edit.id, {
          title: edit.title.trim(),
          description: edit.description.trim(),
          status: edit.status,
        });
      } else {
        await patchExperiment(edit.id, {
          title: edit.title.trim(),
          description: edit.description.trim(),
          status: edit.status,
        });
      }
      setEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="experiments-page">
        <p className="muted">Loading experiments…</p>
      </section>
    );
  }

  return (
    <section className="experiments-page">
      <header className="runs-hero">
        <div className="runs-hero-main">
          <p className="eyebrow">Study catalog</p>
          <h2 className="runs-title">Experiments</h2>
          <p className="muted runs-subtitle">
            {stats.total} entries from <code>artifacts/experiments/</code> and overlay usage
          </p>
        </div>
        <button type="button" className="button-link" onClick={() => setShowCreate((open) => !open)}>
          {showCreate ? "Cancel" : "New experiment"}
        </button>
      </header>

      <div className="runs-kpis">
        <div className="kpi kpi-primary">
          <span className="kpi-label">Total</span>
          <span className="kpi-value">{stats.total}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">With runs</span>
          <span className="kpi-value">{stats.withRuns}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Used only</span>
          <span className="kpi-value">{stats.usedOnly}</span>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {showCreate ? (
        <div className="station-card experiments-create-card">
          <h3>Create experiment</h3>
          <form className="experiments-form" onSubmit={(event) => void onCreate(event)}>
            <label className="metadata-field">
              <span className="metadata-label">Id</span>
              <input
                value={newId}
                onChange={(event) => setNewId(event.target.value.toLowerCase())}
                placeholder="exp7-planner-treatment"
                spellCheck={false}
                required
              />
            </label>
            <label className="metadata-field">
              <span className="metadata-label">Title</span>
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
            </label>
            <label className="metadata-field metadata-field-block">
              <span className="metadata-label">Description</span>
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                rows={3}
              />
            </label>
            <div className="experiments-form-actions">
              <button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="runs-card">
        <div className="runs-toolbar">
          <input
            className="station-search runs-search"
            type="search"
            placeholder="Search id, title, description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-scroll">
          <table className="runs-table runs-table-modern experiments-table">
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Source</th>
                <th>Status</th>
                <th className="num">Runs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div className="experiment-name-cell">
                      <strong>{entry.title}</strong>
                      <code className="experiment-id-code">{entry.id}</code>
                      {entry.description ? (
                        <span className="muted experiment-desc-preview">{entry.description}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className={sourceBadge(entry.source)}>{sourceLabel(entry.source)}</span>
                  </td>
                  <td>{entry.status}</td>
                  <td className="num">{entry.run_count}</td>
                  <td>
                    <div className="run-actions">
                      {entry.run_count > 0 ? (
                        <Link className="run-action-link" to={`/?experiment=${encodeURIComponent(entry.id)}`}>
                          View runs
                        </Link>
                      ) : null}
                      <button type="button" className="metadata-text-btn" onClick={() => openEdit(entry)}>
                        Edit
                      </button>
                      {!entry.has_catalog ? (
                        <button
                          type="button"
                          className="metadata-text-btn"
                          disabled={saving}
                          onClick={() => void onMaterialize(entry)}
                        >
                          Materialize
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="runs-empty">
            <p>No experiments match your search.</p>
          </div>
        ) : null}
      </div>

      {edit ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) setEdit(null);
          }}
        >
          <div className="modal metadata-modal experiments-edit-modal" role="dialog" aria-modal="true">
            <header className="metadata-modal-head">
              <div>
                <p className="eyebrow">Experiment</p>
                <h2>{edit.hasCatalog ? "Edit" : "Materialize"} {edit.id}</h2>
                {!edit.hasCatalog ? (
                  <p className="muted metadata-modal-subtitle">
                    This slug is used on runs but has no catalog file yet. Saving creates{" "}
                    <code>artifacts/experiments/{edit.id}/experiment.json</code>.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="secondary metadata-modal-close"
                disabled={saving}
                aria-label="Close"
                onClick={() => setEdit(null)}
              >
                ✕
              </button>
            </header>
            <form className="metadata-form-body metadata-modal-body" onSubmit={(event) => void onSaveEdit(event)}>
              <label className="metadata-field metadata-field-block">
                <span className="metadata-label">Title</span>
                <input value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} />
              </label>
              <label className="metadata-field metadata-field-block">
                <span className="metadata-label">Description</span>
                <textarea
                  value={edit.description}
                  onChange={(event) => setEdit({ ...edit, description: event.target.value })}
                  rows={4}
                />
              </label>
              <div className="metadata-section-grid metadata-section-grid-2">
                <label className="metadata-field">
                  <span className="metadata-label">Status</span>
                  <select
                    value={edit.status}
                    onChange={(event) =>
                      setEdit({ ...edit, status: event.target.value as ExperimentRecord["status"] })
                    }
                  >
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </div>
              <footer className="metadata-footer metadata-modal-footer">
                <div className="metadata-footer-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? "Saving…" : edit.hasCatalog ? "Save changes" : "Create catalog file"}
                  </button>
                  <button type="button" className="secondary" disabled={saving} onClick={() => setEdit(null)}>
                    Cancel
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
