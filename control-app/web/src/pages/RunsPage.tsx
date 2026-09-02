import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RunsCompareCharts } from "../components/RunsCompareCharts.js";
import { RunsFilterBar } from "../components/RunsFilterBar.js";
import { RunsInsights } from "../components/RunsInsights.js";
import {
  fetchAuthors,
  fetchExperiments,
  fetchRuns,
  formatDuration,
  formatNumber,
  type ExperimentListEntry,
  type RunSummary,
} from "../lib/api.js";
import { formatAppRating } from "../../../shared/app-rubric.js";
import type { ChartGroupKey } from "../lib/run-stats.js";

type SortKey = keyof RunSummary | "provider_model";
type TriFilter = "all" | "yes" | "no";

const URL_FILTER_KEYS = ["experiment", "status", "provider", "model", "author", "q"] as const;
type UrlFilterKey = (typeof URL_FILTER_KEYS)[number];

function statusBadge(status: RunSummary["status"]): string {
  switch (status) {
    case "success":
      return "badge badge-success";
    case "failed":
      return "badge badge-failed";
    case "partial":
      return "badge badge-partial";
    case "incomplete":
      return "badge badge-incomplete";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function providerModel(run: RunSummary): string {
  if (!run.provider && !run.model) return "—";
  return `${run.provider ?? "?"} / ${run.model ?? "?"}`;
}

function formatRunLabel(runId: string): { primary: string; secondary: string | null } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}-\d{2}-\d{2})/.exec(runId);
  if (!match) return { primary: runId, secondary: null };
  const date = match[1]!;
  const time = match[2]!.replace(/-/g, ":");
  return { primary: `${date} ${time}`, secondary: runId };
}

function runDatePrefix(runId: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(runId);
  return match?.[1] ?? null;
}

function sortIndicator(active: boolean, asc: boolean): string {
  if (!active) return "↕";
  return asc ? "↑" : "↓";
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort();
}

function matchesTri(value: boolean, filter: TriFilter): boolean {
  if (filter === "all") return true;
  return filter === "yes" ? value : !value;
}

function readUrlFilter(params: URLSearchParams, key: UrlFilterKey): string {
  return params.get(key) ?? "all";
}

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [experiments, setExperiments] = useState<ExperimentListEntry[]>([]);
  const [knownAuthors, setKnownAuthors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCompare, setShowCompare] = useState(true);
  const [chartGroupBy, setChartGroupBy] = useState<ChartGroupKey>("experiment");

  const experimentFilter = readUrlFilter(searchParams, "experiment");
  const statusFilter = readUrlFilter(searchParams, "status");
  const providerFilter = readUrlFilter(searchParams, "provider");
  const modelFilter = readUrlFilter(searchParams, "model");
  const authorFilter = readUrlFilter(searchParams, "author");
  const search = searchParams.get("q") ?? "";

  const setUrlFilter = useCallback(
    (key: UrlFilterKey, value: string): void => {
      const next = new URLSearchParams(searchParams);
      if (key === "q") {
        if (!value.trim()) next.delete("q");
        else next.set("q", value);
      } else if (value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const [analysisFilter, setAnalysisFilter] = useState<TriFilter>("all");
  const [megaFilter, setMegaFilter] = useState<TriFilter>("all");
  const [manifestFilter, setManifestFilter] = useState<TriFilter>("all");
  const [resultFilter, setResultFilter] = useState<TriFilter>("all");
  const [thinkingFilter, setThinkingFilter] = useState<string>("all");
  const [armFilter, setArmFilter] = useState<string>("all");
  const [interventionFilter, setInterventionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minCalls, setMinCalls] = useState("");
  const [minWeighted, setMinWeighted] = useState("");
  const [minOutput, setMinOutput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("run_id");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchRuns()
      .then((body) => {
        if (!cancelled) setRuns(body.runs);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void fetchExperiments()
      .then((body) => {
        if (!cancelled) setExperiments(body.experiments);
      })
      .catch(() => undefined);
    void fetchAuthors()
      .then((body) => {
        if (!cancelled) setKnownAuthors(body.authors);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => ({
      providers: uniqueStrings(runs.map((run) => run.provider)),
      models: uniqueStrings(runs.map((run) => run.model)),
      authors: uniqueStrings([...knownAuthors, ...runs.map((run) => run.author)]),
      thinking: uniqueStrings(runs.map((run) => run.thinking)),
      arms: uniqueStrings(runs.map((run) => run.arm)),
      interventions: uniqueStrings(runs.map((run) => run.intervention)),
    }),
    [runs, knownAuthors],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const minCallsNum = minCalls.trim() ? Number(minCalls) : null;
    const minWeightedNum = minWeighted.trim() ? Number(minWeighted) : null;
    const minOutputNum = minOutput.trim() ? Number(minOutput) : null;

    return runs.filter((run) => {
      if (statusFilter !== "all" && run.status !== statusFilter) return false;
      if (providerFilter !== "all" && run.provider !== providerFilter) return false;
      if (modelFilter !== "all" && run.model !== modelFilter) return false;
      if (authorFilter !== "all" && (run.author ?? "") !== authorFilter) return false;
      if (experimentFilter !== "all" && run.experiment_slug !== experimentFilter && run.experiment_id !== experimentFilter) {
        return false;
      }
      if (!matchesTri(run.has_analysis, analysisFilter)) return false;
      if (!matchesTri(run.mega_call_flag, megaFilter)) return false;
      if (!matchesTri(run.has_manifest, manifestFilter)) return false;
      if (!matchesTri(run.has_result, resultFilter)) return false;
      if (thinkingFilter !== "all" && (run.thinking ?? "off") !== thinkingFilter) return false;
      if (armFilter !== "all" && run.arm !== armFilter) return false;
      if (interventionFilter !== "all" && run.intervention !== interventionFilter) return false;

      const runDate = runDatePrefix(run.run_id);
      if (dateFrom && (!runDate || runDate < dateFrom)) return false;
      if (dateTo && (!runDate || runDate > dateTo)) return false;

      if (minCallsNum !== null && !Number.isNaN(minCallsNum)) {
        if ((run.model_calls ?? 0) < minCallsNum) return false;
      }
      if (minWeightedNum !== null && !Number.isNaN(minWeightedNum)) {
        if ((run.weighted_cost ?? 0) < minWeightedNum) return false;
      }
      if (minOutputNum !== null && !Number.isNaN(minOutputNum)) {
        if ((run.output_tokens ?? 0) < minOutputNum) return false;
      }

      if (!needle) return true;
      const haystack = [
        run.run_id,
        run.provider,
        run.model,
        run.experiment_id,
        run.arm,
        run.intervention,
        run.thinking,
        run.config_hash,
        run.author,
        run.display_label,
        run.experiment_slug,
        run.app_comment,
        run.run_comment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [
    runs,
    statusFilter,
    providerFilter,
    modelFilter,
    authorFilter,
    experimentFilter,
    analysisFilter,
    megaFilter,
    manifestFilter,
    resultFilter,
    thinkingFilter,
    armFilter,
    interventionFilter,
    dateFrom,
    dateTo,
    minCalls,
    minWeighted,
    minOutput,
    search,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let left: string | number | boolean | null;
      let right: string | number | boolean | null;
      if (sortKey === "provider_model") {
        left = providerModel(a);
        right = providerModel(b);
      } else {
        left = a[sortKey] as string | number | boolean | null;
        right = b[sortKey] as string | number | boolean | null;
      }
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (left < right) return sortAsc ? -1 : 1;
      if (left > right) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
      return;
    }
    setSortKey(key);
    setSortAsc(false);
  }

  function clearFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: true });
    setAnalysisFilter("all");
    setMegaFilter("all");
    setManifestFilter("all");
    setResultFilter("all");
    setThinkingFilter("all");
    setArmFilter("all");
    setInterventionFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinCalls("");
    setMinWeighted("");
    setMinOutput("");
  }

  const activeUrlFilters = useMemo(() => {
    const chips: Array<{ key: UrlFilterKey; label: string; value: string }> = [];
    for (const key of URL_FILTER_KEYS) {
      const value = key === "q" ? search.trim() : readUrlFilter(searchParams, key);
      if (key === "q") {
        if (value) chips.push({ key, label: "Search", value });
      } else if (value !== "all") {
        const label =
          key === "experiment"
            ? (experiments.find((e) => e.id === value)?.title ?? value)
            : value;
        chips.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), value: label });
      }
    }
    return chips;
  }, [searchParams, search, experiments]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (analysisFilter !== "all") count += 1;
    if (megaFilter !== "all") count += 1;
    if (manifestFilter !== "all") count += 1;
    if (resultFilter !== "all") count += 1;
    if (thinkingFilter !== "all") count += 1;
    if (armFilter !== "all") count += 1;
    if (interventionFilter !== "all") count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    if (minCalls.trim()) count += 1;
    if (minWeighted.trim()) count += 1;
    if (minOutput.trim()) count += 1;
    return count;
  }, [
    analysisFilter,
    megaFilter,
    manifestFilter,
    resultFilter,
    thinkingFilter,
    armFilter,
    interventionFilter,
    dateFrom,
    dateTo,
    minCalls,
    minWeighted,
    minOutput,
  ]);

  const hasActiveFilters = activeUrlFilters.length > 0 || activeAdvancedCount > 0;

  if (loading) {
    return (
      <section className="runs-page">
        <div className="runs-loading">
          <p className="eyebrow">Local artifacts</p>
          <p className="muted">Loading runs…</p>
        </div>
      </section>
    );
  }

  if (error) return <div className="error-banner">{error}</div>;

  return (
    <section className="runs-page">
      <header className="runs-hero">
        <div className="runs-hero-main">
          <p className="eyebrow">Local artifacts</p>
          <h2 className="runs-title">Runs</h2>
          <p className="muted runs-subtitle">
            {runs.length} runs in <code>artifacts/runs/</code>
          </p>
        </div>
        <Link className="button-link" to="/new">
          New run
        </Link>
      </header>

      <div className="runs-card runs-filter-card">
        <RunsFilterBar
        experiments={experiments}
        filterOptions={filterOptions}
        experimentFilter={experimentFilter}
        statusFilter={statusFilter}
        providerFilter={providerFilter}
        modelFilter={modelFilter}
        authorFilter={authorFilter}
        search={search}
        analysisFilter={analysisFilter}
        megaFilter={megaFilter}
        manifestFilter={manifestFilter}
        resultFilter={resultFilter}
        thinkingFilter={thinkingFilter}
        armFilter={armFilter}
        interventionFilter={interventionFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        minCalls={minCalls}
        minWeighted={minWeighted}
        minOutput={minOutput}
        showAdvanced={showAdvanced}
        activeUrlFilters={activeUrlFilters}
        activeAdvancedCount={activeAdvancedCount}
        hasActiveFilters={hasActiveFilters}
        onUrlFilter={setUrlFilter}
        onAnalysisFilter={setAnalysisFilter}
        onMegaFilter={setMegaFilter}
        onManifestFilter={setManifestFilter}
        onResultFilter={setResultFilter}
        onThinkingFilter={setThinkingFilter}
        onArmFilter={setArmFilter}
        onInterventionFilter={setInterventionFilter}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        onMinCalls={setMinCalls}
        onMinWeighted={setMinWeighted}
        onMinOutput={setMinOutput}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        onClearAll={clearFilters}
        />
      </div>

      <div className="runs-card">
        <RunsInsights runs={filtered} totalRuns={runs.length} />
      </div>

      <div className="runs-card">
        <RunsCompareCharts
          runs={filtered}
          groupBy={chartGroupBy}
          onGroupByChange={setChartGroupBy}
          collapsed={!showCompare}
          onToggleCollapsed={() => setShowCompare(!showCompare)}
        />
      </div>

      <div className="runs-card runs-table-card">
        <div className="runs-table-header">
          <h3>Run list</h3>
          <span className="muted">{sorted.length} rows</span>
        </div>

        {sorted.length === 0 ? (
          <div className="runs-empty">
            <p>No runs match the current filters.</p>
            <button type="button" className="button-link secondary" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="runs-table runs-table-modern">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("run_id")}>
                    Run <span className="sort-mark">{sortIndicator(sortKey === "run_id", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("status")}>
                    Status <span className="sort-mark">{sortIndicator(sortKey === "status", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("provider_model")}>
                    Model <span className="sort-mark">{sortIndicator(sortKey === "provider_model", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("model_calls")}>
                    Calls <span className="sort-mark">{sortIndicator(sortKey === "model_calls", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("output_tokens")}>
                    Output <span className="sort-mark">{sortIndicator(sortKey === "output_tokens", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("weighted_cost")}>
                    Weighted <span className="sort-mark">{sortIndicator(sortKey === "weighted_cost", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("wall_ms")}>
                    Wall <span className="sort-mark">{sortIndicator(sortKey === "wall_ms", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("display_label")}>
                    Method <span className="sort-mark">{sortIndicator(sortKey === "display_label", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("author")}>
                    Author <span className="sort-mark">{sortIndicator(sortKey === "author", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("app_rating")}>
                    Rating <span className="sort-mark">{sortIndicator(sortKey === "app_rating", sortAsc)}</span>
                  </th>
                  <th onClick={() => toggleSort("experiment_id")}>
                    Experiment <span className="sort-mark">{sortIndicator(sortKey === "experiment_id", sortAsc)}</span>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((run) => {
                  const label = formatRunLabel(run.run_id);
                  return (
                    <tr key={run.run_id} className={run.mega_call_flag ? "mega-call" : undefined}>
                      <td className="run-id-cell">
                        <Link to={`/runs/${run.run_id}`} className="run-id-link" title={run.run_id}>
                          <span className="run-id-primary">{label.primary}</span>
                          {label.secondary ? (
                            <span className="run-id-secondary">{label.secondary}</span>
                          ) : null}
                        </Link>
                      </td>
                      <td>
                        <div className="run-status-cell">
                          <span className={statusBadge(run.status)}>{run.status}</span>
                          {run.mega_call_flag ? <span className="badge badge-mega">mega</span> : null}
                          {run.has_analysis ? <span className="badge badge-analyzed">analyzed</span> : null}
                          {run.has_replay && run.replay_verdict ? (
                            <span className={`badge badge-replay-${run.replay_verdict}`}>{run.replay_verdict}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="model-cell">
                        <span className="model-provider">{run.provider ?? "—"}</span>
                        <span className="model-name">{run.model ?? "—"}</span>
                        {run.thinking && run.thinking !== "off" ? (
                          <span className="model-thinking">think: {run.thinking}</span>
                        ) : null}
                      </td>
                      <td className="num">{formatNumber(run.model_calls)}</td>
                      <td className="num">{formatNumber(run.output_tokens)}</td>
                      <td className="num">{formatNumber(run.weighted_cost)}</td>
                      <td className="num dim">{formatDuration(run.wall_ms)}</td>
                      <td className="method-cell">
                        <span>{run.display_label ?? "—"}</span>
                        {run.experiment_slug && run.experiment_slug !== run.display_label ? (
                          <span className="cohort-arm">{run.experiment_slug}</span>
                        ) : null}
                      </td>
                      <td>{run.author ?? "—"}</td>
                      <td className="num">{formatAppRating(run.app_rating, run.app_rubric)}</td>
                      <td className="cohort-cell">
                        <span>{run.experiment_id ?? "—"}</span>
                        {run.arm ? <span className="cohort-arm">{run.arm}</span> : null}
                      </td>
                      <td>
                        <div className="run-actions">
                          <Link className="run-action-link" to={`/runs/${run.run_id}`}>
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
