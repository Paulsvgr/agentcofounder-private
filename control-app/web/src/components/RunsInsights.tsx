import { useMemo } from "react";
import {
  aggregateRunStats,
  formatStatNumber,
  type TokenBreakdown,
  type WeightedParts,
} from "../lib/run-stats.js";
import type { RunSummary } from "../lib/api.js";

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

type MixRow = {
  key: string;
  label: string;
  value: number;
  className: string;
};

function tokenMixRows(tokens: TokenBreakdown): MixRow[] {
  return [
    { key: "input", label: "Input", value: tokens.input, className: "token-mix-in" },
    { key: "output", label: "Output", value: tokens.output, className: "token-mix-out" },
    { key: "cacheRead", label: "Cache read", value: tokens.cacheRead, className: "token-mix-cache" },
  ].filter((row) => row.value > 0);
}

function weightedRows(parts: WeightedParts): MixRow[] {
  return [
    { key: "input", label: "Input ×1", value: parts.input, className: "token-mix-in" },
    { key: "output", label: "Output ×3", value: parts.output, className: "token-mix-out" },
    { key: "cacheRead", label: "Cache read ×0.1", value: parts.cacheRead, className: "token-mix-cache" },
  ].filter((row) => row.value > 0);
}

function MixPanel({
  title,
  hint,
  rows,
  total,
}: {
  title: string;
  hint: string;
  rows: MixRow[];
  total: number;
}) {
  if (rows.length === 0 || total <= 0) {
    return (
      <div className="insights-mix-panel">
        <h4>{title}</h4>
        <p className="muted">{hint}</p>
        <p className="muted">No token data in this filter set.</p>
      </div>
    );
  }

  return (
    <div className="insights-mix-panel">
      <h4>{title}</h4>
      <p className="muted insights-mix-hint">{hint}</p>
      <div className="token-mix-legend">
        {rows.map((row) => (
          <span key={row.key} className={`token-mix-key token-mix-key-${row.key === "cacheRead" ? "cache" : row.key === "output" ? "out" : "in"}`}>
            {row.label}
          </span>
        ))}
      </div>
      <div className="token-mix-track insights-mix-track" role="img" aria-label={title}>
        {rows.map((row) => (
          <div
            key={row.key}
            className={`token-mix-seg ${row.className}`}
            style={{ width: `${pct(row.value, total)}%` }}
            title={`${row.label}: ${formatStatNumber(row.value, 0)}`}
          />
        ))}
      </div>
      <ul className="insights-mix-rows">
        {rows.map((row) => (
          <li key={row.key}>
            <span className="insights-mix-label">{row.label}</span>
            <span className="insights-mix-value">{formatStatNumber(row.value, 0)}</span>
            <span className="insights-mix-pct">{formatStatNumber(pct(row.value, total), 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  runs: RunSummary[];
  totalRuns: number;
};

export function RunsInsights({ runs, totalRuns }: Props) {
  const stats = useMemo(() => aggregateRunStats(runs), [runs]);

  if (!stats) {
    return (
      <section className="runs-insights">
        <p className="muted">No runs match the current filters.</p>
      </section>
    );
  }

  const filtered = runs.length !== totalRuns;

  return (
    <section className="runs-insights">
      <div className="runs-insights-header">
        <div>
          <h3>Insights</h3>
          <p className="muted runs-insights-sub">
            {filtered
              ? `${stats.runCount} of ${totalRuns} runs · weighted = input + output×3 + cache_read×0.1`
              : `All ${stats.runCount} runs · weighted = input + output×3 + cache_read×0.1`}
          </p>
        </div>
      </div>

      <div className="runs-insights-kpis">
        <div className="kpi kpi-primary">
          <span className="kpi-label">Filtered runs</span>
          <span className="kpi-value">{stats.runCount}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Success rate</span>
          <span className="kpi-value">
            {stats.successRate === null ? "—" : `${formatStatNumber(stats.successRate * 100, 0)}%`}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Median weighted</span>
          <span className="kpi-value">{formatStatNumber(stats.medianWeighted, 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Median calls</span>
          <span className="kpi-value">{formatStatNumber(stats.medianCalls, 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Median wall</span>
          <span className="kpi-value">
            {stats.medianWall === null ? "—" : `${formatStatNumber(stats.medianWall)}s`}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Cache hit</span>
          <span className="kpi-value">
            {stats.cacheHitRatio === null ? "—" : `${formatStatNumber(stats.cacheHitRatio * 100, 0)}%`}
          </span>
        </div>
        <div className="kpi kpi-compact">
          <span className="kpi-label">Tokens / call</span>
          <span className="kpi-value">{formatStatNumber(stats.tokensPerCall, 0)}</span>
        </div>
        <div className="kpi kpi-compact">
          <span className="kpi-label">Out / in</span>
          <span className="kpi-value">{formatStatNumber(stats.outputToInput, 2)}</span>
        </div>
      </div>

      <div className="insights-mix-grid">
        <MixPanel
          title="Token mix"
          hint="Raw token volume across the filtered set."
          rows={tokenMixRows(stats.tokens)}
          total={stats.totalTokens}
        />
        <MixPanel
          title="Weighted cost drivers"
          hint="What contributes to the scoreboard number."
          rows={weightedRows(stats.weightedParts)}
          total={stats.weightedParts.total}
        />
      </div>
    </section>
  );
}
