import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CohortActionFlow } from "../components/CohortActionFlow";
import { RunActionModal } from "../components/RunActionModal";
import {
  COHORT_PRESETS,
  cohortLabelMap,
  type CohortPreset,
} from "../lib/cohortStudy";
import { listRuns } from "../lib/api";
import { shortRunId } from "../lib/actionFlow";
import { loadClassificationManifest } from "../lib/classification";
import { formatNumber } from "../lib/stats";
import { hasActionFlow, type HackathonRunRecord } from "../types/runExport";

function parsePreset(value: string | null): CohortPreset {
  return value === "exp1-rtl" ? "exp1-rtl" : "study";
}

export function CohortPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = parsePreset(searchParams.get("preset"));
  const config = COHORT_PRESETS[preset];

  const [runs, setRuns] = useState<HackathonRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionRun, setActionRun] = useState<HackathonRunRecord | null>(null);

  const labels = useMemo(() => cohortLabelMap(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadClassificationManifest();
        const data = await listRuns();
        if (!cancelled) setRuns(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load runs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cohortRuns = useMemo(() => {
    const byRunId = new Map<string, HackathonRunRecord>();
    for (const run of runs) {
      const id = run.data.export?.meta?.run_id || run.data.run_id;
      if (id) byRunId.set(id, run);
    }
    return config.entries.map((entry) => ({
      entry,
      run: byRunId.get(entry.run_id) ?? null,
    }));
  }, [runs, config.entries]);

  const matched = cohortRuns.filter((c) => c.run).map((c) => c.run!);
  const v2Count = matched.filter((r) => hasActionFlow(r.data.export)).length;

  return (
    <div className="stack page-center">
      <section className="panel">
        <div className="detail-head">
          <div>
            <h2>{config.title}</h2>
            <p className="muted lead">{config.description}</p>
          </div>
          <div className="detail-badges">
            <button
              type="button"
              className={preset === "study" ? "badge badge-ok" : "badge"}
              onClick={() => setSearchParams({})}
            >
              Study (7)
            </button>
            <button
              type="button"
              className={preset === "exp1-rtl" ? "badge badge-ok" : "badge"}
              onClick={() => setSearchParams({ preset: "exp1-rtl" })}
            >
              Exp1 RTL (10)
            </button>
          </div>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <>
            <p className="muted">
              {matched.length} / {config.entries.length} runs in DB · {v2Count} with v2
              action_flow
            </p>

            <div className="table-wrap">
              <table className="runs">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>run_id</th>
                    <th>In DB</th>
                    <th>Schema</th>
                    <th>weighted</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortRuns.map(({ entry, run }) => (
                    <tr
                      key={entry.run_id}
                      className={run ? "clickable" : undefined}
                      onClick={() => run && setActionRun(run)}
                    >
                      <td>{entry.label}</td>
                      <td>{shortRunId(entry.run_id)}</td>
                      <td>{run ? "yes" : "—"}</td>
                      <td>
                        {run?.data.export?.schema?.includes("v2") ? "v2" : run ? "v1" : "—"}
                      </td>
                      <td>
                        {run
                          ? formatNumber(run.data.export?.efficiency?.weighted_total)
                          : "—"}
                      </td>
                      <td className="muted">{entry.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CohortActionFlow runs={matched} labels={labels} />

            <p className="muted">
              Paste v2 exports from <code>setup/measure</code> for missing runs, or seed via{" "}
              <code>scripts/seed_runs_from_artifacts.py --only …</code>.{" "}
              <Link to="/add">Add run</Link>
            </p>
          </>
        )}
      </section>

      {actionRun && (
        <RunActionModal run={actionRun} onClose={() => setActionRun(null)} />
      )}
    </div>
  );
}
