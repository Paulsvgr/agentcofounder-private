import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RunMetadataPanel } from "../components/RunMetadataPanel.js";
import { ratingChipLabel } from "../components/AppRubricForm.js";
import {
  fetchPublishStatus,
  fetchRunDetail,
  fetchRunAppStatus,
  formatDuration,
  formatNumber,
  getStoredAccessKey,
  killRunApp,
  openRunApp,
  publishRunToTeam,
  setStoredAccessKey,
  streamJob,
  triggerAnalyze,
  triggerReconcile,
  type PublishRunResponse,
  type PublishStatus,
  type RunDetail,
  type RunStatus,
  type RunSummary,
  type StationReport,
  type StationVerification,
} from "../lib/api.js";

const MEGA_THRESHOLD = 5000;

const ACTIVITY_COLORS: Record<string, string> = {
  recon: "#6366f1",
  source: "#16a34a",
  css: "#9333ea",
  test: "#ea580c",
  build: "#0891b2",
  finalize: "#4338ca",
  repair: "#dc2626",
  mixed: "#6b7280",
  other: "#9ca3af",
};

function activityColor(activity: string): string {
  return ACTIVITY_COLORS[activity] ?? ACTIVITY_COLORS.other!;
}

function statusBadge(status: RunStatus): string {
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

function GeneratedAppBlock({
  appPath,
  appUrl,
  appRunning,
  appBusy,
  onStop,
}: {
  appPath: string | null;
  appUrl: string | null;
  appRunning: boolean;
  appBusy: boolean;
  onStop: () => void;
}) {
  if (!appPath && !appUrl) return null;
  return (
    <div className="station-card station-card-compact">
      <div className="station-card-head">
        <h3>Generated app</h3>
        {appRunning ? <span className="badge badge-success">Running</span> : null}
      </div>
      {appUrl ? (
        <p className="generated-app-link">
          <a href={appUrl} target="_blank" rel="noreferrer">
            {appUrl}
          </a>
        </p>
      ) : null}
      {appPath ? (
        <p className="muted station-caption">
          <code>{appPath}</code>
        </p>
      ) : null}
      {appRunning ? (
        <div className="generated-app-actions">
          <button type="button" className="secondary danger" disabled={appBusy} onClick={onStop}>
            {appBusy ? "Stopping…" : "Stop app"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ActivityPill({ activity }: { activity: string }) {
  return <span className={`pill activity-${activity}`}>{activity}</span>;
}

function formatPct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ManifestBlock({
  manifest,
  title,
}: {
  manifest: Record<string, unknown> | null | undefined;
  title: string;
}) {
  if (!manifest) {
    return (
      <div className="station-card station-card-compact">
        <h3>{title}</h3>
        <p className="muted">No run-manifest.json (legacy run).</p>
      </div>
    );
  }

  const model = manifest.model as Record<string, unknown> | undefined;
  const experiment = manifest.experiment as Record<string, unknown> | undefined;
  const git = manifest.git as Record<string, unknown> | undefined;
  const template = manifest.template as Record<string, unknown> | undefined;
  const modelLine = [model?.provider, model?.model].filter(Boolean).join(" / ");

  const groups: Array<{ label: string; rows: Array<[string, string]> }> = [
    {
      label: "Experiment",
      rows: [
        ["Experiment", String(experiment?.id ?? experiment?.cohort ?? "—")],
        ["Arm", String(experiment?.arm ?? "—")],
        ["Rep", String(experiment?.rep ?? "—")],
        ["Intervention", String(experiment?.intervention ?? "—")],
      ],
    },
    {
      label: "Model",
      rows: [
        ["Provider / model", modelLine || "—"],
        ["Thinking", String(model?.thinking ?? "—")],
        ["Timeout", model?.timeout_ms !== undefined ? `${String(model.timeout_ms)} ms` : "—"],
      ],
    },
    {
      label: "Provenance",
      rows: [
        ["Template", String(template?.id ?? "—")],
        ["Config hash", String(manifest.config_hash ?? "—").slice(0, 16)],
        ["Git", `${String(git?.branch ?? "—")} @ ${String(git?.commit ?? "—").slice(0, 8)}`],
        ["Dirty", git?.dirty ? "yes" : "no"],
      ],
    },
  ];

  return (
    <div className="station-card station-card-compact">
      <h3>{title}</h3>
      <div className="manifest-groups">
        {groups.map((group) => (
          <div className="manifest-group" key={group.label}>
            <p className="manifest-group-label">{group.label}</p>
            <dl className="manifest-grid">
              {group.rows.map(([label, value]) => (
                <Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function HarnessConfigBlock({ config }: { config: Record<string, unknown> | null | undefined }) {
  if (!config || Object.keys(config).length === 0) return null;
  return (
    <div className="station-card station-card-compact">
      <h3>Harness config</h3>
      <dl className="manifest-grid">
        {Object.entries(config).map(([key, value]) => (
          <Fragment key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function OutcomeBlock({ outcome }: { outcome: Record<string, unknown> | null | undefined }) {
  if (!outcome) return null;
  return (
    <div className="station-card station-card-compact">
      <h3>Outcome</h3>
      <dl className="manifest-grid">
        <dt>Status</dt>
        <dd>{String(outcome.status ?? "—")}</dd>
        <dt>Pi exit</dt>
        <dd>{String(outcome.pi_exit_code ?? "—")}</dd>
        <dt>Wall</dt>
        <dd>{formatNumber(Number(outcome.wall_ms ?? NaN))} ms</dd>
      </dl>
    </div>
  );
}

function testResultBadge(result: "passed" | "failed"): string {
  return result === "passed" ? "badge badge-success" : "badge badge-failed";
}

function normalizeVerificationRow(row: StationVerification["tests_run"][number]): StationVerification["tests_run"][number] {
  return {
    command: row.command,
    journey: row.journey,
    result: row.result,
    detail: row.detail ?? null,
  };
}

function verificationFromDetail(detail: RunDetail, station: StationReport | null): StationVerification | null {
  if (station?.verification) {
    return {
      ...station.verification,
      tests_run: station.verification.tests_run.map(normalizeVerificationRow),
      harness_checks: station.verification.harness_checks.map(normalizeVerificationRow),
      agent_tool_errors: station.verification.agent_tool_errors ?? [],
    };
  }

  const result = detail.result as {
    status?: StationVerification["status"];
    summary?: string;
    pi_exit_code?: number;
    tests_run?: Array<Omit<StationVerification["tests_run"][number], "detail"> & { detail?: string | null }>;
    harness_checks?: Array<Omit<StationVerification["harness_checks"][number], "detail"> & { detail?: string | null }>;
  } | null;
  if (!result) return null;

  const testsRun = (result.tests_run ?? []).map(normalizeVerificationRow);
  const harnessChecks = (result.harness_checks ?? []).map(normalizeVerificationRow);
  const testsFailed = testsRun.filter((row) => row.result === "failed").length;
  const harnessFailed = harnessChecks.filter((row) => row.result === "failed").length;

  return {
    status: result.status ?? "unknown",
    pi_exit_code: result.pi_exit_code ?? null,
    summary: result.summary ?? null,
    source: "result.json",
    tests_run: testsRun,
    harness_checks: harnessChecks,
    tests_passed: testsRun.length - testsFailed,
    tests_failed: testsFailed,
    harness_passed: harnessChecks.length - harnessFailed,
    harness_failed: harnessFailed,
    all_journeys_passed: testsRun.length > 0 ? testsFailed === 0 : null,
    all_harness_passed: harnessChecks.length > 0 ? harnessFailed === 0 : null,
    error_tool_count: 0,
    error_call_count: 0,
    repair_call_count: 0,
    first_error_call_index: null,
    first_error_seconds: null,
    npm_test_command_count: 0,
    npm_test_error_count: 0,
    time_to_first_failing_test_s: null,
    agent_tool_errors: [],
  };
}

function VerificationDetailRow({ detail }: { detail: string }) {
  return (
    <tr className="verify-detail-row">
      <td colSpan={3}>
        <pre className="verify-detail">{detail}</pre>
      </td>
    </tr>
  );
}

function VerificationSection({ verification }: { verification: StationVerification }) {
  const statusClass =
    verification.status === "success"
      ? "badge badge-success"
      : verification.status === "failed"
        ? "badge badge-failed"
        : verification.status === "partial"
          ? "badge badge-partial"
          : "badge badge-incomplete";

  return (
    <div className="station-card">
      <div className="station-card-head">
        <h3>Verification & errors</h3>
        <span className="station-card-meta">{verification.source}</span>
      </div>

      {verification.summary ? <p className="verify-summary">{verification.summary}</p> : null}

      <div className="verify-kpis">
        <div className="verify-kpi">
          <span className="verify-kpi-label">Status</span>
          <span className={statusClass}>{verification.status}</span>
        </div>
        <div className="verify-kpi">
          <span className="verify-kpi-label">Journeys</span>
          <span>
            {verification.tests_run.length > 0
              ? `${verification.tests_passed}/${verification.tests_passed + verification.tests_failed} passed`
              : "—"}
          </span>
        </div>
        <div className="verify-kpi">
          <span className="verify-kpi-label">Harness</span>
          <span>
            {verification.harness_checks.length > 0
              ? `${verification.harness_passed}/${verification.harness_passed + verification.harness_failed} passed`
              : "—"}
          </span>
        </div>
        <div className="verify-kpi">
          <span className="verify-kpi-label">Agent tool errors</span>
          <span>
            {verification.error_tool_count} tools · {verification.error_call_count} calls
          </span>
        </div>
        <div className="verify-kpi">
          <span className="verify-kpi-label">Repair calls</span>
          <span>{formatNumber(verification.repair_call_count)}</span>
        </div>
        <div className="verify-kpi">
          <span className="verify-kpi-label">First failing test</span>
          <span>
            {verification.time_to_first_failing_test_s !== null
              ? `${verification.time_to_first_failing_test_s.toFixed(1)}s`
              : "—"}
          </span>
        </div>
      </div>

      {verification.tests_run.length > 0 ? (
        <>
          <h4 className="verify-table-title">Product journeys</h4>
          <div className="table-scroll">
            <table className="station-table verify-table">
              <thead>
                <tr>
                  <th>Journey</th>
                  <th>Command</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {verification.tests_run.map((row) => (
                  <Fragment key={row.journey}>
                    <tr className={row.result === "failed" ? "verify-row-failed" : undefined}>
                      <td>{row.journey}</td>
                      <td>
                        <code>{row.command}</code>
                      </td>
                      <td>
                        <span className={testResultBadge(row.result)}>{row.result}</span>
                      </td>
                    </tr>
                    {row.detail ? <VerificationDetailRow detail={row.detail} /> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {verification.harness_checks.length > 0 ? (
        <>
          <h4 className="verify-table-title">Harness checks</h4>
          <div className="table-scroll">
            <table className="station-table verify-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Command</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {verification.harness_checks.map((row) => (
                  <Fragment key={row.journey}>
                    <tr className={row.result === "failed" ? "verify-row-failed" : undefined}>
                      <td>{row.journey}</td>
                      <td>
                        <code>{row.command}</code>
                      </td>
                      <td>
                        <span className={testResultBadge(row.result)}>{row.result}</span>
                      </td>
                    </tr>
                    {row.detail ? <VerificationDetailRow detail={row.detail} /> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {verification.agent_tool_errors && verification.agent_tool_errors.length > 0 ? (
        <>
          <h4 className="verify-table-title">Agent tool errors during run</h4>
          <div className="table-scroll">
            <table className="station-table verify-table">
              <thead>
                <tr>
                  <th>Call</th>
                  <th>Tool</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {verification.agent_tool_errors.map((error) => (
                  <tr key={`${error.call_index}-${error.tool_name}-${error.detail}`}>
                    <td>#{error.call_index}</td>
                    <td>{error.tool_name}</td>
                    <td>
                      <code>{error.detail}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="muted station-caption">
        {verification.pi_exit_code !== null ? `Pi exit ${verification.pi_exit_code}` : "Pi exit unknown"}
        {verification.first_error_call_index !== null
          ? ` · first tool error at call #${verification.first_error_call_index}`
          : ""}
      </p>
    </div>
  );
}

function OutputTokenChart({ callLog }: { callLog: Array<{ index: number; output_tokens: number }> }) {
  const max = Math.max(...callLog.map((entry) => entry.output_tokens), 1);
  return (
    <div className="station-card">
      <div className="station-card-head">
        <h3>Output tokens per call</h3>
        <span className="station-card-meta">{callLog.length} calls</span>
      </div>
      <div className="chart-bars" aria-label="Output tokens per call">
        {callLog.map((entry) => (
          <div
            key={entry.index}
            className={`chart-bar${entry.output_tokens >= MEGA_THRESHOLD ? " mega" : ""}`}
            style={{ height: `${Math.max(4, (entry.output_tokens / max) * 100)}%` }}
            data-label={`#${entry.index}: ${entry.output_tokens}`}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityBars({
  summary,
  title,
}: {
  summary: StationReport["activity_summary"];
  title: string;
}) {
  const max = Math.max(...summary.map((bucket) => bucket.weighted_cost), 1);
  const sorted = [...summary].sort((a, b) => b.weighted_cost - a.weighted_cost);
  const hasTokenMix = sorted.some(
    (bucket) =>
      (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0) + (bucket.cache_read_tokens ?? 0) > 0,
  );

  return (
    <div className="station-card">
      <div className="station-card-head">
        <h3>{title}</h3>
        <span className="station-card-meta">{sorted.length} phases</span>
      </div>
      {hasTokenMix ? (
        <div className="token-mix-legend" aria-hidden="true">
          <span className="token-mix-key token-mix-key-in">In</span>
          <span className="token-mix-key token-mix-key-out">Out</span>
          <span className="token-mix-key token-mix-key-cache">Cache</span>
        </div>
      ) : null}
      <div className="station-bars">
        {sorted.map((bucket) => {
          const inputShare = bucket.input_share ?? 0;
          const outputShare = bucket.output_share ?? 0;
          const cacheShare = bucket.cache_read_share ?? 0;
          const tokenTotal =
            (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0) + (bucket.cache_read_tokens ?? 0);

          return (
            <div className="bar-row" key={bucket.activity}>
              <div className="bar-label">
                <ActivityPill activity={bucket.activity} />
                <span className="bar-calls">{bucket.call_count} calls</span>
              </div>
              <div className="bar-tracks">
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(bucket.weighted_cost / max) * 100}%`,
                      background: activityColor(bucket.activity),
                    }}
                  />
                </div>
                {hasTokenMix && tokenTotal > 0 ? (
                  <div className="token-mix-track" title={`${formatNumber(bucket.input_tokens ?? 0)} in · ${formatNumber(bucket.output_tokens ?? 0)} out · ${formatNumber(bucket.cache_read_tokens ?? 0)} cache`}>
                    {inputShare > 0 ? (
                      <div className="token-mix-seg token-mix-in" style={{ width: `${inputShare * 100}%` }} />
                    ) : null}
                    {outputShare > 0 ? (
                      <div className="token-mix-seg token-mix-out" style={{ width: `${outputShare * 100}%` }} />
                    ) : null}
                    {cacheShare > 0 ? (
                      <div className="token-mix-seg token-mix-cache" style={{ width: `${cacheShare * 100}%` }} />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="bar-meta">
                <strong>{formatNumber(Math.round(bucket.weighted_cost))}</strong>
                <span>{formatPct(bucket.share_of_total)}</span>
                {hasTokenMix && tokenTotal > 0 ? (
                  <span className="token-mix-meta">
                    in {formatPct(inputShare)} · out {formatPct(outputShare)} · cache {formatPct(cacheShare)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CumulativeChart({ series }: { series: StationReport["cumulative_series"] }) {
  if (series.length === 0) return null;

  const width = 960;
  const height = 220;
  const pad = { l: 56, r: 16, t: 20, b: 36 };
  const xs = series.map((point) => point.seconds_since_start ?? point.call_index);
  const ys = series.map((point) => point.cumulative_weighted);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, 1);
  const maxY = Math.max(...ys, 1);

  const toPoint = (index: number): [number, number] => {
    const x = pad.l + ((xs[index]! - minX) / (maxX - minX || 1)) * (width - pad.l - pad.r);
    const y = pad.t + (1 - ys[index]! / maxY) * (height - pad.t - pad.b);
    return [x, y];
  };

  const linePoints = series.map((_, index) => toPoint(index).join(",")).join(" ");
  const areaPoints = [
    `${pad.l},${height - pad.b}`,
    ...series.map((_, index) => toPoint(index).join(",")),
    `${pad.l + ((xs[xs.length - 1]! - minX) / (maxX - minX || 1)) * (width - pad.l - pad.r)},${height - pad.b}`,
  ].join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const y = pad.t + (1 - fraction) * (height - pad.t - pad.b);
    const label = formatNumber(Math.round(maxY * fraction));
    return { y, label };
  });

  return (
    <div className="station-card">
      <div className="station-card-head">
        <h3>Cumulative weighted cost</h3>
        <span className="station-card-meta">{series.length} calls</span>
      </div>
      <div className="chart-wrap">
        <svg className="station-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative weighted cost">
          {gridLines.map(({ y, label }) => (
            <g key={label}>
              <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} className="chart-grid" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="chart-axis">
                {label}
              </text>
            </g>
          ))}
          <polygon points={areaPoints} className="chart-area" />
          <polyline fill="none" points={linePoints} className="chart-line" />
        </svg>
      </div>
      <p className="station-caption">Time on X (seconds since start), cumulative weighted cost on Y.</p>
    </div>
  );
}

function CompareDeltas({ report }: { report: StationReport }) {
  const compare = report.compare;
  if (!compare) return null;

  return (
    <div className="station-card">
      <div className="station-card-head">
        <h3>Compare deltas</h3>
        <span className="station-card-meta">primary − {compare.run_id}</span>
      </div>
      <div className="table-scroll">
        <table className="station-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Weighted Δ</th>
              <th>Calls Δ</th>
              <th>Primary</th>
              <th>Compare</th>
            </tr>
          </thead>
          <tbody>
            {compare.activity_deltas.map((delta) => {
              const deltaClass =
                delta.weighted_delta > 0
                  ? "delta-pos"
                  : delta.weighted_delta < 0
                    ? "delta-neg"
                    : "";
              const sign = delta.weighted_delta > 0 ? "+" : "";
              return (
                <tr key={delta.activity}>
                  <td>
                    <ActivityPill activity={delta.activity} />
                  </td>
                  <td className={`num ${deltaClass}`}>
                    {sign}
                    {formatNumber(Math.round(delta.weighted_delta))}
                  </td>
                  <td className="num">
                    {delta.call_delta >= 0 ? "+" : ""}
                    {delta.call_delta}
                  </td>
                  <td className="num">{formatPct(delta.primary_share)}</td>
                  <td className="num">{formatPct(delta.compare_share)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolOutput({ output }: { output: string }) {
  const causeMarker = "\n\nCause:";
  const causeIndex = output.indexOf(causeMarker);
  if (causeIndex === -1) {
    return <pre className="tool-output">{output}</pre>;
  }
  const summary = output.slice(0, causeIndex);
  const cause = output.slice(causeIndex + causeMarker.length).trim();
  return (
    <div className="tool-output-stack">
      <pre className="tool-output">{summary}</pre>
      <div className="tool-output-cause-wrap">
        <span className="tool-output-cause-label">Cause</span>
        <pre className="tool-output tool-output-cause">{cause}</pre>
      </div>
    </div>
  );
}

function toolSummary(tools: StationReport["calls"][number]["tools"]): string {
  if (!tools.length) return "—";
  return tools
    .map((tool) => `${tool.name}${tool.detail ? `: ${tool.detail}` : ""}${tool.output ? ` → ${tool.output}` : ""}`)
    .join("; ");
}

function CallLedgerTable({ calls }: { calls: StationReport["calls"] }) {
  const [filterActivity, setFilterActivity] = useState("");
  const [search, setSearch] = useState("");
  const [openRows, setOpenRows] = useState<Set<number>>(() => new Set());

  const activities = useMemo(
    () => [...new Set(calls.map((call) => call.activity))].sort(),
    [calls],
  );

  const filteredCalls = useMemo(() => {
    const needle = search.toLowerCase();
    return calls.filter((call) => {
      if (filterActivity && call.activity !== filterActivity) return false;
      if (!needle) return true;
      return [call.model, call.activity, toolSummary(call.tools)].join(" ").toLowerCase().includes(needle);
    });
  }, [calls, filterActivity, search]);

  function toggleRow(index: number): void {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="station-card station-card-wide">
      <div className="station-card-head">
        <h3>Call ledger</h3>
        <span className="station-card-meta">
          {filteredCalls.length} of {calls.length} calls
        </span>
      </div>

      <div className="station-toolbar">
        <div className="activity-filters" role="group" aria-label="Filter by activity">
          <button
            type="button"
            className={`filter-chip${filterActivity === "" ? " active" : ""}`}
            onClick={() => setFilterActivity("")}
          >
            All
          </button>
          {activities.map((activity) => (
            <button
              key={activity}
              type="button"
              className={`filter-chip activity-${activity}${filterActivity === activity ? " active" : ""}`}
              onClick={() => setFilterActivity(filterActivity === activity ? "" : activity)}
            >
              {activity}
            </button>
          ))}
        </div>
        <input
          className="station-search"
          type="search"
          placeholder="Search model or tools…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="table-scroll">
        <table className="station-table station-table-ledger">
          <thead>
            <tr>
              <th>#</th>
              <th>Turn</th>
              <th>Activity</th>
              <th>Weighted</th>
              <th>Cumulative</th>
              <th>Model</th>
              <th>Tools</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.map((call) => {
              const isOpen = openRows.has(call.index);
              return (
                <Fragment key={call.index}>
                  <tr className={isOpen ? "row-open" : undefined}>
                    <td className="num dim">{call.index}</td>
                    <td className="num dim">{call.turn}</td>
                    <td>
                      <ActivityPill activity={call.activity} />
                    </td>
                    <td className="num">{formatNumber(Math.round(call.weighted_cost))}</td>
                    <td className="num dim">{formatNumber(Math.round(call.cumulative_weighted))}</td>
                    <td className="model-cell" title={call.model}>
                      {call.model}
                    </td>
                    <td>
                      {call.tools.length === 0 ? (
                        <span className="dim">—</span>
                      ) : (
                        <button type="button" className="tool-chip" onClick={() => toggleRow(call.index)}>
                          {call.tools.length} tool{call.tools.length === 1 ? "" : "s"}
                          <span className="tool-chevron">{isOpen ? "▾" : "▸"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="tool-row">
                      <td colSpan={7}>
                        <div className="call-tools">
                          {call.tools.map((tool, index) => (
                            <div className={`tool-item${tool.is_error ? " tool-error" : ""}`} key={`${call.index}-${index}`}>
                              <div className="tool-item-head">
                                <span className="tool-name">{tool.name}</span>
                                {tool.detail ? <span className="tool-detail">{tool.detail}</span> : null}
                              </div>
                              {tool.output ? <ToolOutput output={tool.output} /> : null}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunKpis({ summary, station }: { summary: RunSummary; station: StationReport | null }) {
  if (station) {
    return (
      <div className="station-kpis">
        <div className="kpi kpi-primary">
          <span className="kpi-label">Weighted total</span>
          <span className="kpi-value">{formatNumber(Math.round(station.totals.weighted_total))}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Model calls</span>
          <span className="kpi-value">{formatNumber(station.totals.model_calls)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Input tokens</span>
          <span className="kpi-value">{formatNumber(station.totals.input_tokens)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Output tokens</span>
          <span className="kpi-value">{formatNumber(station.totals.output_tokens)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Cache read</span>
          <span className="kpi-value">{formatNumber(station.totals.cache_read_tokens)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="station-kpis">
      <div className="kpi kpi-primary">
        <span className="kpi-label">Weighted</span>
        <span className="kpi-value">{formatNumber(summary.weighted_cost)}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Calls</span>
        <span className="kpi-value">{formatNumber(summary.model_calls)}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Output tokens</span>
        <span className="kpi-value">{formatNumber(summary.output_tokens)}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Max / call</span>
        <span className="kpi-value">{formatNumber(summary.max_output_per_call)}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Wall time</span>
        <span className="kpi-value">{formatDuration(summary.wall_ms)}</span>
      </div>
    </div>
  );
}

export function RunDetailPage() {
  const { runId } = useParams();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobLines, setJobLines] = useState<string[]>([]);
  const [jobRunning, setJobRunning] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [appRunning, setAppRunning] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [publishAccessKey, setPublishAccessKey] = useState(getStoredAccessKey);
  const [publishKeyOpen, setPublishKeyOpen] = useState(false);
  const [publishRunning, setPublishRunning] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishRunResponse | null>(null);

  const load = useCallback(async () => {
    if (!runId) return;
    setError(null);
    try {
      setDetail(await fetchRunDetail(runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAppStatus = useCallback(async () => {
    if (!runId) return;
    try {
      const status = await fetchRunAppStatus(runId);
      setAppRunning(status.running);
      setAppUrl(status.running && status.url ? status.url : null);
    } catch {
      /* optional */
    }
  }, [runId]);

  useEffect(() => {
    void refreshAppStatus();
  }, [refreshAppStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchPublishStatus();
        if (!cancelled) setPublishStatus(status);
      } catch {
        /* publish optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const callLog = useMemo(() => {
    const log = detail?.result?.call_log;
    if (!Array.isArray(log)) return [];
    return log as Array<{ index: number; output_tokens: number }>;
  }, [detail]);

  async function runJob(kind: "analyze" | "reconcile"): Promise<void> {
    if (!runId) return;
    setJobLines([]);
    setJobRunning(true);
    try {
      const trigger = kind === "analyze" ? triggerAnalyze : triggerReconcile;
      const { job_id: jobId } = await trigger(runId);
      await new Promise<void>((resolve, reject) => {
        streamJob(
          jobId,
          (line) => setJobLines((prev) => [...prev, line]),
          (status) => {
            if (status === "succeeded") resolve();
            else reject(new Error(`${kind} job ${status}`));
          },
        );
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJobRunning(false);
    }
  }

  async function handleOpenApp(): Promise<void> {
    if (!runId) return;
    setJobLines(["Starting generated app…"]);
    setJobRunning(true);
    setError(null);
    try {
      const result = await openRunApp(runId);
      setAppUrl(result.url);
      setAppRunning(true);
      setJobLines([
        result.built_from_logs ? "Rebuilt app from session logs." : "Using saved generated app.",
        `Serving at ${result.url}`,
        `Path: ${result.app_path}`,
      ]);
      window.open(result.url, "_blank", "noopener,noreferrer");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJobRunning(false);
    }
  }

  async function handleStopApp(): Promise<void> {
    if (!runId) return;
    setAppBusy(true);
    setError(null);
    try {
      const result = await killRunApp(runId);
      if (result.stopped) {
        setAppRunning(false);
        setAppUrl(null);
        setJobLines(["Stopped generated app dev server."]);
      } else {
        setJobLines(["No dev server was running for this run."]);
        await refreshAppStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAppBusy(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!runId) return;
    const needsKey = !publishStatus?.has_server_access_key;
    const accessKey = publishAccessKey.trim();
    if (needsKey && !accessKey) {
      setPublishKeyOpen(true);
      return;
    }

    setPublishRunning(true);
    setError(null);
    setPublishResult(null);
    try {
      if (accessKey) {
        setStoredAccessKey(accessKey);
      }
      const result = await publishRunToTeam(runId, accessKey || undefined);
      setPublishResult(result);
      setPublishKeyOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishRunning(false);
    }
  }

  function handleSaveAccessKey(): void {
    const accessKey = publishAccessKey.trim();
    if (!accessKey) return;
    setStoredAccessKey(accessKey);
    setPublishKeyOpen(false);
  }

  if (!runId) return <p className="error-banner">Missing run id</p>;
  if (error && !detail) return <div className="error-banner">{error}</div>;
  if (!detail) return <p className="muted">Loading run…</p>;

  const station = detail.station as StationReport | null;
  const verification = verificationFromDetail(detail, station);
  const manifest = (station?.manifest ?? detail.manifest) as Record<string, unknown> | null;
  const config = manifest?.config as Record<string, unknown> | undefined;
  const outcome = manifest?.outcome as Record<string, unknown> | undefined;
  const summary = detail.summary;
  const canOpenApp =
    (summary.has_generated_app ?? false) ||
    (summary.can_replay ?? false) ||
    (summary.has_sessions ?? false);
  const generatedAppPath = detail.generated_app_path ?? summary.generated_app_path;
  const manifestGit = manifest?.git as { branch?: string; commit?: string } | undefined;
  const hasPublishKey = Boolean(publishStatus?.has_server_access_key || publishAccessKey.trim());
  const showPublishKeyForm = publishKeyOpen && !publishStatus?.has_server_access_key;

  return (
    <section className="station-page">
      <nav className="station-crumb">
        <Link to="/">Runs</Link>
        <span>/</span>
        <span>{runId}</span>
      </nav>

      {error ? <div className="error-banner">{error}</div> : null}

      <header className="station-hero">
        <div className="station-hero-main">
          <p className="eyebrow">Run</p>
          <h1 className="station-title">{runId}</h1>
          <div className="station-meta-row">
            <span className={statusBadge(summary.status)}>{summary.status}</span>
            {summary.mega_call_flag ? <span className="badge badge-mega">mega</span> : null}
            {summary.arm ? <span className="badge badge-arm">{summary.arm}</span> : null}
            {summary.experiment_id ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">{summary.experiment_id}</span>
              </>
            ) : null}
            {summary.display_label ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">{summary.display_label}</span>
              </>
            ) : null}
            {summary.author ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">{summary.author}</span>
              </>
            ) : null}
            {ratingChipLabel(summary.app_rating, summary.app_rubric) ? (
              <>
                <span className="meta-dot">·</span>
                <span className="badge badge-analyzed">
                  {ratingChipLabel(summary.app_rating, summary.app_rubric)}
                </span>
              </>
            ) : null}
            {summary.provider || summary.model ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">
                  {summary.provider ?? "?"} / {summary.model ?? "?"}
                </span>
              </>
            ) : null}
            {summary.wall_ms !== null ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">{formatDuration(summary.wall_ms)} wall</span>
              </>
            ) : null}
            {station ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">Analyzed {formatShortDate(station.generated_at)}</span>
                <span className="meta-dot">·</span>
                <span className="muted">{station.classifier_version}</span>
              </>
            ) : null}
            {station?.compare ? (
              <>
                <span className="meta-dot">·</span>
                <span className="muted">
                  vs <code>{station.compare.run_id}</code>
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="station-hero-actions">
          {station ? (
            <span className={`badge ${station.reconciliation_ok ? "badge-success" : "badge-failed"}`}>
              {station.reconciliation_ok ? "Reconcile OK" : "Reconcile mismatch"}
            </span>
          ) : null}
          {verification && verification.tests_failed > 0 ? (
            <span className="badge badge-failed">{verification.tests_failed} journey failures</span>
          ) : null}
          {verification && verification.harness_failed > 0 ? (
            <span className="badge badge-failed">{verification.harness_failed} harness failures</span>
          ) : null}
          {verification && verification.error_tool_count > 0 ? (
            <span className="badge badge-partial">{verification.error_tool_count} agent tool errors</span>
          ) : null}
        </div>
      </header>

      <div className="station-card station-actions-card">
        <div className="station-card-head">
          <h3>Actions</h3>
        </div>
        <div className="actions">
          {!summary.has_analysis ? (
            <button type="button" disabled={jobRunning} onClick={() => void runJob("analyze")}>
              Analyze
            </button>
          ) : null}
          <button
            type="button"
            disabled={jobRunning || !canOpenApp}
            title={
              canOpenApp
                ? appRunning
                  ? "Open the running app in a new tab"
                  : "Start the generated app in your browser"
                : "No saved app or session logs to rebuild from"
            }
            onClick={() => void handleOpenApp()}
          >
            {jobRunning ? "Opening app…" : appRunning ? "Open in browser" : "Open app"}
          </button>
          {appRunning ? (
            <button
              type="button"
              className="secondary danger"
              disabled={jobRunning || appBusy}
              onClick={() => void handleStopApp()}
            >
              {appBusy ? "Stopping…" : "Stop app"}
            </button>
          ) : null}
          {!summary.has_analysis && summary.has_result ? (
            <button type="button" className="secondary" disabled={jobRunning} onClick={() => void runJob("reconcile")}>
              Reconcile tokens
            </button>
          ) : null}
        </div>
        {jobLines.length > 0 ? <pre className="console">{jobLines.join("\n")}</pre> : null}
      </div>

      <div className="station-card publish-panel">
        <div className="publish-panel-head">
          <h3>Publish to team</h3>
          <p className="muted">Send overlay metadata and export to the shared runs DB.</p>
        </div>

        {showPublishKeyForm ? (
          <div className="publish-key-form">
            <label htmlFor="publish-access-key">Team access key</label>
            <input
              id="publish-access-key"
              type="password"
              className="publish-key-input"
              placeholder="Paste team key"
              value={publishAccessKey}
              onChange={(event) => setPublishAccessKey(event.target.value)}
              autoComplete="off"
            />
            <p className="muted publish-key-hint">Stored locally in this browser only — used for publish.</p>
            <div className="publish-key-actions">
              <button
                type="button"
                disabled={publishRunning || !publishAccessKey.trim()}
                onClick={() => void handlePublish()}
              >
                {publishRunning ? "Publishing…" : "Save & publish"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={publishRunning || !publishAccessKey.trim()}
                onClick={handleSaveAccessKey}
              >
                Save key only
              </button>
              <button
                type="button"
                className="button-link secondary"
                onClick={() => setPublishKeyOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : hasPublishKey ? (
          <div className="publish-ready-row">
            <button
              type="button"
              disabled={publishRunning}
              onClick={() => void handlePublish()}
            >
              {publishRunning ? "Publishing…" : "Publish run"}
            </button>
            {!publishStatus?.has_server_access_key ? (
              <button
                type="button"
                className="button-link secondary"
                onClick={() => setPublishKeyOpen(true)}
              >
                Change key
              </button>
            ) : null}
          </div>
        ) : (
          <div className="publish-key-prompt">
            <p className="muted">Add your team access key to publish this run.</p>
            <button type="button" className="secondary" onClick={() => setPublishKeyOpen(true)}>
              Add access key
            </button>
          </div>
        )}

        {publishResult ? (
          <div className="publish-result">
            <span className={`badge ${publishResult.created ? "badge-success" : "badge-partial"}`}>
              {publishResult.created ? "Published" : "Already on team app"}
            </span>
            {publishResult.view_url ? (
              <a href={publishResult.view_url} target="_blank" rel="noreferrer">
                Open in team runs app
              </a>
            ) : (
              <span className="muted">Published — open the team app and search for this run id.</span>
            )}
          </div>
        ) : null}
      </div>

      <RunKpis summary={summary} station={station} />

      {runId ? (
        <RunMetadataPanel
          runId={runId}
          open={metadataOpen}
          onOpenChange={setMetadataOpen}
          manifestGitBranch={manifestGit?.branch ?? null}
          manifestGitCommit={manifestGit?.commit ?? null}
          summaryLabel={summary.display_label}
          summaryAuthor={summary.author}
          summaryRating={summary.app_rating}
          summaryRubric={summary.app_rubric}
          onSaved={() => void load()}
        />
      ) : null}

      <div className="station-layout">
        <div className="station-main">
          {verification ? <VerificationSection verification={verification} /> : null}
          {station ? (
            <>
              <ActivityBars summary={station.activity_summary} title="Activity breakdown" />
              <CumulativeChart series={station.cumulative_series} />
              {station.compare ? (
                <ActivityBars summary={station.compare.activity_summary} title="Compare breakdown" />
              ) : null}
              <CompareDeltas report={station} />
            </>
          ) : (
            <>
              {!summary.has_analysis ? (
                <div className="station-card">
                  <h3>Analysis</h3>
                  <p className="muted">
                    No analysis yet. Click <strong>Analyze</strong> above to classify calls and build the activity
                    breakdown.
                  </p>
                </div>
              ) : null}
              {callLog.length > 0 ? <OutputTokenChart callLog={callLog} /> : null}
            </>
          )}
        </div>

        <aside className="station-sidebar">
          <ManifestBlock manifest={manifest} title="Run manifest" />
          {station?.compare ? (
            <ManifestBlock manifest={station.compare.manifest} title="Compare manifest" />
          ) : null}
          <HarnessConfigBlock config={config} />
          <OutcomeBlock outcome={outcome} />
          <GeneratedAppBlock
            appPath={generatedAppPath}
            appUrl={appUrl}
            appRunning={appRunning}
            appBusy={appBusy}
            onStop={() => void handleStopApp()}
          />
        </aside>
      </div>

      {station ? <CallLedgerTable calls={station.calls} /> : null}
    </section>
  );
}
