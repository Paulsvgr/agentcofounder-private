import { useMemo } from "react";
import {
  aggregateTokenStats,
  formatNumber,
  type TokenBreakdown,
  type TokenStatsSummary,
  type WeightedParts,
  tokensOf,
  weightedPartsOf,
} from "../lib/stats";
import type { HackathonRunRecord } from "../types/runExport";

const MIX_COLORS = {
  input: "#2563eb",
  output: "#64748b",
  cacheRead: "#b45309",
  cacheWrite: "#7c3aed",
  reasoning: "#be123c",
} as const;

const WEIGHT_COLORS = {
  input: "#2563eb",
  output: "#64748b",
  cacheRead: "#b45309",
} as const;

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function mixRows(tokens: TokenBreakdown) {
  return [
    { key: "input" as const, label: "input", value: tokens.input },
    { key: "output" as const, label: "output", value: tokens.output },
    { key: "cacheRead" as const, label: "cache read", value: tokens.cacheRead },
    { key: "cacheWrite" as const, label: "cache write", value: tokens.cacheWrite },
    { key: "reasoning" as const, label: "reasoning", value: tokens.reasoning },
  ];
}

function TokenMixBar({ tokens, total }: { tokens: TokenBreakdown; total: number }) {
  if (total <= 0) {
    return <p className="muted">No token data in this set.</p>;
  }
  const parts = mixRows(tokens);
  return (
    <div className="mix-stack">
      <div className="mix-bar" role="img" aria-label="Token mix">
        {parts.map((p) => {
          const width = pct(p.value, total);
          if (width <= 0) return null;
          return (
            <div
              key={p.key}
              className="mix-seg"
              style={{ width: `${width}%`, background: MIX_COLORS[p.key] }}
              title={`${p.label}: ${formatNumber(p.value, 0)} (${formatNumber(width, 0)}%)`}
            />
          );
        })}
      </div>
      <ul className="mix-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="mix-swatch" style={{ background: MIX_COLORS[p.key] }} />
            <span>
              {p.label} <strong>{formatNumber(p.value, 0)}</strong>{" "}
              <span className="muted">({formatNumber(pct(p.value, total), 0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeightedMixBar({ parts }: { parts: WeightedParts }) {
  if (parts.total <= 0) {
    return <p className="muted">No weighted contribution data.</p>;
  }
  const rows: { key: keyof typeof WEIGHT_COLORS; label: string; value: number }[] = [
    { key: "input", label: "input ×1", value: parts.input },
    { key: "output", label: "output ×3", value: parts.output },
    { key: "cacheRead", label: "cache_read ×0.1", value: parts.cacheRead },
  ];
  return (
    <div className="mix-stack">
      <div className="mix-bar" role="img" aria-label="Weighted contribution">
        {rows.map((p) => {
          const width = pct(p.value, parts.total);
          if (width <= 0) return null;
          return (
            <div
              key={p.key}
              className="mix-seg"
              style={{ width: `${width}%`, background: WEIGHT_COLORS[p.key] }}
              title={`${p.label}: ${formatNumber(p.value, 0)} (${formatNumber(width, 0)}%)`}
            />
          );
        })}
      </div>
      <ul className="mix-legend">
        {rows.map((p) => (
          <li key={p.key}>
            <span className="mix-swatch" style={{ background: WEIGHT_COLORS[p.key] }} />
            <span>
              {p.label} <strong>{formatNumber(p.value, 0)}</strong>{" "}
              <span className="muted">({formatNumber(pct(p.value, parts.total), 0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryStrip({ stats, scope }: { stats: TokenStatsSummary; scope: string }) {
  return (
    <div className="stat-grid token-summary">
      <div className="stat">
        <div className="label">{scope}</div>
        <div className="value">{stats.runCount}</div>
      </div>
      <div className="stat">
        <div className="label">Success rate</div>
        <div className="value">
          {stats.successRate === null ? "—" : `${formatNumber(stats.successRate * 100, 0)}%`}
        </div>
      </div>
      <div className="stat">
        <div className="label">Median weighted</div>
        <div className="value">{formatNumber(stats.medianWeighted, 0)}</div>
      </div>
      <div className="stat">
        <div className="label">Median calls</div>
        <div className="value">{formatNumber(stats.medianCalls, 0)}</div>
      </div>
      <div className="stat">
        <div className="label">Median wall s</div>
        <div className="value">{formatNumber(stats.medianWall)}</div>
      </div>
      <div className="stat">
        <div className="label">Cache hit ratio</div>
        <div className="value">
          {stats.cacheHitRatio === null
            ? "—"
            : `${formatNumber(stats.cacheHitRatio * 100, 0)}%`}
        </div>
      </div>
      <div className="stat">
        <div className="label">Tokens / call</div>
        <div className="value">{formatNumber(stats.tokensPerCall, 0)}</div>
      </div>
      <div className="stat">
        <div className="label">Output / input</div>
        <div className="value">{formatNumber(stats.outputToInput, 2)}</div>
      </div>
    </div>
  );
}

type AggregateProps = {
  runs: HackathonRunRecord[];
  title?: string;
};

/** Filtered-set token stats for Compare runs. */
export function TokenStatsPanel({ runs, title = "Token & cost stats" }: AggregateProps) {
  const stats = useMemo(() => aggregateTokenStats(runs), [runs]);

  if (!stats) {
    return (
      <div className="token-stats">
        <h3>{title}</h3>
        <p className="muted">No runs in this filter.</p>
      </div>
    );
  }

  return (
    <div className="token-stats">
      <h3>{title}</h3>
      <p className="muted chart-hint">
        Same filters as the table. Weighted ≈ input + output×3 + cache_read×0.1.
      </p>
      <SummaryStrip stats={stats} scope="Runs" />
      <div className="token-panels">
        <div className="token-panel">
          <h4>Token mix</h4>
          <p className="muted chart-hint">Raw token counts across filtered runs.</p>
          <TokenMixBar tokens={stats.tokens} total={stats.totalTokens} />
        </div>
        <div className="token-panel">
          <h4>Weighted contribution</h4>
          <p className="muted chart-hint">What drives the official scoreboard cost.</p>
          <WeightedMixBar parts={stats.weightedParts} />
        </div>
      </div>
    </div>
  );
}

type SingleProps = {
  run: HackathonRunRecord;
};

/** Per-run token stats for detail page. */
export function RunTokenStats({ run }: SingleProps) {
  const tokens = tokensOf(run);
  const summary = useMemo(() => aggregateTokenStats([run]), [run]);

  if (!tokens || !summary) {
    return (
      <section className="panel">
        <h3>Token stats</h3>
        <p className="muted">No harness token fields on this run.</p>
      </section>
    );
  }

  const parts = weightedPartsOf(tokens);

  return (
    <section className="panel">
      <h3>Token stats</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Official weighted ≈ input + output×3 + cache_read×0.1.
      </p>
      <SummaryStrip stats={summary} scope="This run" />
      <div className="token-panels">
        <div className="token-panel">
          <h4>Token mix</h4>
          <TokenMixBar tokens={tokens} total={summary.totalTokens} />
        </div>
        <div className="token-panel">
          <h4>Weighted contribution</h4>
          <WeightedMixBar parts={parts} />
        </div>
      </div>
    </section>
  );
}
