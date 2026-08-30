import type { RunResult } from "../types.js";
import type { ActivityBucket, ActivityPhase } from "./classify.js";
import type { RunManifest } from "./manifest.js";
import type { CallLedger, CallLedgerEntry } from "./normalize.js";
import { buildStationVerification, type StationVerification } from "./verification.js";

export type { StationTestRow, StationVerification, StationVerificationSource } from "./verification.js";

export const STATION_SCHEMA = "agentcofounder.analysis_station.v1" as const;

export interface StationTotals {
  model_calls: number;
  weighted_total: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export interface StationCallRow {
  index: number;
  turn: number;
  activity: ActivityPhase;
  weighted_cost: number;
  cumulative_weighted: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  seconds_since_start: number | null;
  tools: CallLedgerEntry["tools"];
}

export interface StationCumulativePoint {
  call_index: number;
  seconds_since_start: number | null;
  cumulative_weighted: number;
}

export interface StationActivityDelta {
  activity: ActivityPhase;
  weighted_delta: number;
  call_delta: number;
  primary_share: number;
  compare_share: number;
}

export interface StationCompareBlock {
  run_id: string;
  reconciliation_ok: boolean;
  totals: StationTotals;
  activity_summary: ActivityBucket[];
  activity_deltas: StationActivityDelta[];
  manifest?: RunManifest | null;
}

export interface StationReport {
  schema: typeof STATION_SCHEMA;
  generated_at: string;
  run_id: string;
  classifier_version: string;
  reconciliation_ok: boolean;
  totals: StationTotals;
  activity_summary: ActivityBucket[];
  cumulative_series: StationCumulativePoint[];
  calls: StationCallRow[];
  manifest: RunManifest | null;
  verification: StationVerification;
  compare?: StationCompareBlock;
}

function ledgerTotals(calls: CallLedgerEntry[]): StationTotals {
  return calls.reduce(
    (totals, call) => ({
      model_calls: totals.model_calls + 1,
      weighted_total: totals.weighted_total + call.weighted_cost,
      input_tokens: totals.input_tokens + call.input_tokens,
      output_tokens: totals.output_tokens + call.output_tokens,
      cache_read_tokens: totals.cache_read_tokens + call.cache_read_tokens,
    }),
    {
      model_calls: 0,
      weighted_total: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
    },
  );
}

function toCallRow(call: CallLedgerEntry): StationCallRow {
  return {
    index: call.index,
    turn: call.turn,
    activity: call.activity,
    weighted_cost: call.weighted_cost,
    cumulative_weighted: call.cumulative_weighted,
    model: call.model,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
    cache_read_tokens: call.cache_read_tokens,
    seconds_since_start: call.seconds_since_start,
    tools: call.tools,
  };
}

function activityDeltas(
  primary: ActivityBucket[],
  compare: ActivityBucket[],
): StationActivityDelta[] {
  const primaryMap = new Map(primary.map((bucket) => [bucket.activity, bucket]));
  const compareMap = new Map(compare.map((bucket) => [bucket.activity, bucket]));
  const activities = new Set<ActivityPhase>([
    ...primaryMap.keys(),
    ...compareMap.keys(),
  ]);

  return [...activities]
    .map((activity) => {
      const left = primaryMap.get(activity);
      const right = compareMap.get(activity);
      return {
        activity,
        weighted_delta: (left?.weighted_cost ?? 0) - (right?.weighted_cost ?? 0),
        call_delta: (left?.call_count ?? 0) - (right?.call_count ?? 0),
        primary_share: left?.share_of_total ?? 0,
        compare_share: right?.share_of_total ?? 0,
      };
    })
    .sort((left, right) => Math.abs(right.weighted_delta) - Math.abs(left.weighted_delta));
}

export function buildStationReport(
  ledger: CallLedger,
  options: {
    manifest?: RunManifest | null;
    runResult?: RunResult | null;
    compareLedger?: CallLedger;
    compareManifest?: RunManifest | null;
  } = {},
): StationReport {
  const { manifest = null, runResult = null, compareLedger, compareManifest = null } = options;
  const report: StationReport = {
    schema: STATION_SCHEMA,
    generated_at: new Date().toISOString(),
    run_id: ledger.run_id,
    classifier_version: ledger.classifier_version,
    reconciliation_ok: ledger.reconciliation.matched,
    totals: ledgerTotals(ledger.calls),
    activity_summary: ledger.activity_summary,
    cumulative_series: ledger.calls.map((call) => ({
      call_index: call.index,
      seconds_since_start: call.seconds_since_start,
      cumulative_weighted: call.cumulative_weighted,
    })),
    calls: ledger.calls.map(toCallRow),
    manifest,
    verification: buildStationVerification(ledger.calls, { runResult, manifest }),
  };

  if (compareLedger) {
    report.compare = {
      run_id: compareLedger.run_id,
      reconciliation_ok: compareLedger.reconciliation.matched,
      totals: ledgerTotals(compareLedger.calls),
      activity_summary: compareLedger.activity_summary,
      activity_deltas: activityDeltas(ledger.activity_summary, compareLedger.activity_summary),
      manifest: compareManifest,
    };
  }

  return report;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function manifestField(manifest: RunManifest, label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="manifest-row"><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(String(value))}</code></dd></div>`;
}

function renderManifestBlock(manifest: RunManifest | null | undefined, title: string): string {
  if (!manifest) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="caption">No run-manifest.json for this run (legacy).</p></section>`;
  }
  const model = manifest.model;
  const modelLine = [model.provider, model.model].filter(Boolean).join(" / ");
  const modelSettings = [
    model.thinking !== "off" ? `thinking=${model.thinking}` : "",
    model.max_tokens !== null ? `max_tokens=${model.max_tokens}` : "",
    model.context_window !== null ? `context_window=${model.context_window}` : "",
    `timeout_ms=${model.timeout_ms}`,
  ]
    .filter(Boolean)
    .join(", ");
  const rows = [
    manifestField(manifest, "Schema", manifest.schema),
    manifestField(manifest, "Config hash", manifest.config_hash),
    manifestField(manifest, "Config schema", manifest.config_schema_version),
    manifestField(manifest, "Template", manifest.template.id),
    manifestField(manifest, "Template tree", manifest.template.tree_sha256),
    manifestField(manifest, "Experiment cohort", manifest.experiment.cohort),
    manifestField(manifest, "Experiment arm", manifest.experiment.arm),
    manifestField(manifest, "Experiment rep", manifest.experiment.rep),
    manifestField(manifest, "Intervention", manifest.experiment.intervention),
    manifestField(manifest, "Git branch", manifest.git.branch),
    manifestField(manifest, "Git commit", manifest.git.commit),
    manifestField(manifest, "Git dirty", manifest.git.dirty ? "yes" : "no"),
    manifestField(manifest, "Model", modelLine || null),
    manifestField(manifest, "Model settings", modelSettings || null),
  ].join("");
  return `<section><h2>${escapeHtml(title)}</h2><dl class="manifest-dl">${rows}</dl></section>`;
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderStationHtml(report: StationReport): string {
  const payload = jsonForScript(report);
  const manifestHtml =
    renderManifestBlock(report.manifest, "Run manifest (provenance)") +
    (report.compare
      ? renderManifestBlock(report.compare.manifest, "Compare manifest")
      : "");
  const manifestHtmlJson = JSON.stringify(manifestHtml);
  const title = report.compare
    ? `${report.run_id} vs ${report.compare.run_id}`
    : report.run_id;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Analysis station — ${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f6f7f9;
      --surface: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #2563eb;
      --danger: #dc2626;
      --success: #059669;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f1115;
        --surface: #171a21;
        --text: #f3f4f6;
        --muted: #9ca3af;
        --border: #2d3340;
        --accent: #60a5fa;
        --danger: #f87171;
        --success: #34d399;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.45; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px 20px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 20px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 20px; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
    .stat-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-value { font-size: 1.25rem; font-weight: 600; margin-top: 4px; }
    section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    section h2 { font-size: 1rem; margin: 0 0 12px; }
    .bars { display: grid; gap: 8px; }
    .bar-row { display: grid; grid-template-columns: 88px 1fr 120px; gap: 8px; align-items: center; font-size: 0.8125rem; }
    .bar-tracks { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .token-mix-legend { display: flex; gap: 12px; margin-bottom: 10px; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); }
    .token-mix-key { display: inline-flex; align-items: center; gap: 5px; }
    .token-mix-key::before { content: ""; width: 10px; height: 10px; border-radius: 2px; }
    .token-mix-key-in::before { background: #2563eb; }
    .token-mix-key-out::before { background: #ea580c; }
    .token-mix-key-cache::before { background: #7c3aed; }
    .token-mix-track { display: flex; height: 6px; border-radius: 999px; overflow: hidden; background: var(--border); }
    .token-mix-seg { height: 100%; min-width: 1px; }
    .token-mix-in { background: #2563eb; }
    .token-mix-out { background: #ea580c; }
    .token-mix-cache { background: #7c3aed; }
    .token-mix-meta { display: block; font-size: 0.6875rem; color: var(--muted); white-space: nowrap; }
    .bar-track { height: 10px; background: var(--border); border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--accent); border-radius: 999px; }
    .bar-meta { text-align: right; color: var(--muted); white-space: nowrap; }
    .chart-wrap { overflow-x: auto; }
    svg.chart { width: 100%; min-width: 480px; height: 180px; display: block; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
    select, input[type="search"] {
      background: var(--bg); color: var(--text); border: 1px solid var(--border);
      border-radius: 6px; padding: 6px 10px; font: inherit;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    tr[data-open="true"] .tools { display: block; }
    .tools {
      display: none; margin-top: 6px; color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem;
    }
    .tool-block { margin-bottom: 8px; }
    .tool-output {
      margin: 4px 0 0; padding: 8px 10px; background: var(--bg); border-radius: 6px;
      white-space: pre-wrap; word-break: break-word; color: var(--text);
    }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--bg); border: 1px solid var(--border); font-size: 0.75rem; font-weight: 600; }
    .pill.activity-recon { background: #e0e7ff; border-color: #a5b4fc; color: #3730a3; }
    .pill.activity-source { background: #dcfce7; border-color: #86efac; color: #166534; }
    .pill.activity-css { background: #fae8ff; border-color: #e9d5ff; color: #7e22ce; }
    .pill.activity-test { background: #ffedd5; border-color: #fdba74; color: #c2410c; }
    .pill.activity-build { background: #cffafe; border-color: #67e8f9; color: #0e7490; }
    .pill.activity-finalize { background: #e0e7ff; border-color: #818cf8; color: #4338ca; }
    .pill.activity-repair { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
    .pill.activity-mixed { background: #f3f4f6; border-color: #d1d5db; color: #4b5563; }
    .pill.activity-other { background: #f9fafb; border-color: #e5e7eb; color: #6b7280; }
    @media (prefers-color-scheme: dark) {
      .pill.activity-recon { background: #1e1b4b; border-color: #4338ca; color: #c7d2fe; }
      .pill.activity-source { background: #052e16; border-color: #166534; color: #86efac; }
      .pill.activity-css { background: #3b0764; border-color: #7e22ce; color: #e9d5ff; }
      .pill.activity-test { background: #431407; border-color: #c2410c; color: #fdba74; }
      .pill.activity-build { background: #083344; border-color: #0e7490; color: #67e8f9; }
      .pill.activity-finalize { background: #1e1b4b; border-color: #4338ca; color: #a5b4fc; }
      .pill.activity-repair { background: #450a0a; border-color: #b91c1c; color: #fca5a5; }
      .pill.activity-mixed { background: #1f2937; border-color: #4b5563; color: #d1d5db; }
      .pill.activity-other { background: #111827; border-color: #374151; color: #9ca3af; }
    }
    .ok { color: var(--success); }
    .bad { color: var(--danger); }
    .delta-pos { color: var(--danger); }
    .delta-neg { color: var(--success); }
    .caption { color: var(--muted); font-size: 0.75rem; margin-top: 8px; }
    button.row-toggle { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }
    .manifest-dl { margin: 0; display: grid; gap: 6px; }
    .manifest-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; font-size: 0.8125rem; align-items: baseline; }
    .manifest-row dt { color: var(--muted); margin: 0; }
    .manifest-row dd { margin: 0; word-break: break-all; }
    .verify-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 12px; }
    .verify-stat { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
    .verify-pass { background: #ecfdf5; border-color: #6ee7b7; color: #047857; }
    .verify-fail { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }
    @media (prefers-color-scheme: dark) {
      .verify-pass { background: #052e16; border-color: #166534; color: #86efac; }
      .verify-fail { background: #450a0a; border-color: #b91c1c; color: #fca5a5; }
    }
    .verify-table td:last-child { white-space: nowrap; }
    .verify-detail-row td { padding-top: 0; border-bottom: 1px solid var(--border); }
    .verify-detail { margin: 0 0 8px; padding: 8px 10px; background: var(--bg); border-radius: 6px; font: 0.75rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; color: var(--text); }
    .verify-summary { color: var(--muted); font-size: 0.8125rem; margin: 0 0 12px; line-height: 1.45; }
  </style>
</head>
<body>
  <main id="app"></main>
  <script type="application/json" id="station-data">${payload}</script>
  <script>
    const report = JSON.parse(document.getElementById("station-data").textContent);
    const manifestHtml = ${manifestHtmlJson};
    function fmt(n) { return Math.round(n).toLocaleString(); }
    function pct(n) { return (n * 100).toFixed(1) + "%"; }
    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    function activityPill(activity) {
      return \`<span class="pill activity-\${activity}">\${activity}</span>\`;
    }
    function renderStats() {
      const reconcile = report.reconciliation_ok
        ? '<span class="ok">reconcile OK</span>'
        : '<span class="bad">reconcile MISMATCH</span>';
      const compareLine = report.compare ? \` vs <code>\${report.compare.run_id}</code>\` : "";
      return \`<h1>Analysis station</h1>
        <p class="sub"><code>\${report.run_id}</code>\${compareLine} · classifier \${report.classifier_version} · \${reconcile}</p>
        <div class="grid">
          <div class="stat"><div class="stat-label">Weighted total</div><div class="stat-value">\${fmt(report.totals.weighted_total)}</div></div>
          <div class="stat"><div class="stat-label">Model calls</div><div class="stat-value">\${fmt(report.totals.model_calls)}</div></div>
          <div class="stat"><div class="stat-label">Input tokens</div><div class="stat-value">\${fmt(report.totals.input_tokens)}</div></div>
          <div class="stat"><div class="stat-label">Output tokens</div><div class="stat-value">\${fmt(report.totals.output_tokens)}</div></div>
          <div class="stat"><div class="stat-label">Cache read</div><div class="stat-value">\${fmt(report.totals.cache_read_tokens)}</div></div>
        </div>\`;
    }
    function renderVerification() {
      const v = report.verification;
      if (!v) return "";
      const statusCls = v.status === "success" ? "ok" : v.status === "failed" ? "bad" : "";
      const journeyLine = v.tests_run.length
        ? \`\${v.tests_passed}/\${v.tests_passed + v.tests_failed} journeys passed\`
        : "no journey records";
      const harnessLine = v.harness_checks.length
        ? \`\${v.harness_passed}/\${v.harness_passed + v.harness_failed} harness checks passed\`
        : "no harness records";
      const rows = (items, title) => {
        if (!items.length) return "";
        const body = items.map((item) => {
          const detail = item.detail
            ? \`<tr class="verify-detail-row"><td colspan="4"><pre class="verify-detail">\${escapeHtml(item.detail)}</pre></td></tr>\`
            : "";
          return \`<tr><td>\${item.journey || item.command}</td><td><code>\${item.command}</code></td><td>\${verifyBadge(item.result)}</td></tr>\${detail}\`;
        }).join("");
        return \`<h3 style="margin:16px 0 8px;font-size:0.875rem">\${title}</h3>
          <table class="verify-table"><thead><tr><th>Check</th><th>Command</th><th>Result</th></tr></thead><tbody>\${body}</tbody></table>\`;
      };
      function verifyBadge(result) {
        const cls = result === "passed" ? "verify-pass" : "verify-fail";
        return \`<span class="pill \${cls}">\${result}</span>\`;
      }
      const summary = v.summary ? \`<p class="verify-summary">\${v.summary}</p>\` : "";
      return \`<section><h2>Verification & errors</h2>
        \${summary}
        <div class="verify-grid">
          <div class="verify-stat"><div class="stat-label">Run status</div><div class="stat-value \${statusCls}">\${v.status}</div></div>
          <div class="verify-stat"><div class="stat-label">Journeys</div><div class="stat-value">\${journeyLine}</div></div>
          <div class="verify-stat"><div class="stat-label">Harness</div><div class="stat-value">\${harnessLine}</div></div>
          <div class="verify-stat"><div class="stat-label">Agent tool errors</div><div class="stat-value">\${v.error_tool_count} tools · \${v.error_call_count} calls</div></div>
          <div class="verify-stat"><div class="stat-label">Repair calls</div><div class="stat-value">\${v.repair_call_count}</div></div>
          <div class="verify-stat"><div class="stat-label">First failing test</div><div class="stat-value">\${v.time_to_first_failing_test_s !== null ? v.time_to_first_failing_test_s.toFixed(1) + "s" : "—"}</div></div>
        </div>
        <p class="caption">Source: \${v.source}\${v.pi_exit_code !== null ? " · pi exit " + v.pi_exit_code : ""}</p>
        \${rows(v.tests_run, "Product journeys (tests_run)")}
        \${rows(v.harness_checks, "Harness checks")}
      </section>\`;
    }
    function renderActivityBars(summary, title) {
      const max = Math.max(...summary.map((b) => b.weighted_cost), 1);
      const hasTokenMix = summary.some((b) => (b.input_tokens ?? 0) + (b.output_tokens ?? 0) + (b.cache_read_tokens ?? 0) > 0);
      const legend = hasTokenMix
        ? \`<div class="token-mix-legend"><span class="token-mix-key token-mix-key-in">In</span><span class="token-mix-key token-mix-key-out">Out</span><span class="token-mix-key token-mix-key-cache">Cache</span></div>\`
        : "";
      const rows = summary.map((bucket) => {
        const width = (bucket.weighted_cost / max) * 100;
        const inputShare = bucket.input_share ?? 0;
        const outputShare = bucket.output_share ?? 0;
        const cacheShare = bucket.cache_read_share ?? 0;
        const tokenTotal = (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0) + (bucket.cache_read_tokens ?? 0);
        const tokenBar = hasTokenMix && tokenTotal > 0
          ? \`<div class="token-mix-track">
              \${inputShare > 0 ? \`<div class="token-mix-seg token-mix-in" style="width:\${inputShare * 100}%"></div>\` : ""}
              \${outputShare > 0 ? \`<div class="token-mix-seg token-mix-out" style="width:\${outputShare * 100}%"></div>\` : ""}
              \${cacheShare > 0 ? \`<div class="token-mix-seg token-mix-cache" style="width:\${cacheShare * 100}%"></div>\` : ""}
            </div>\`
          : "";
        const tokenMeta = hasTokenMix && tokenTotal > 0
          ? \`<span class="token-mix-meta">in \${pct(inputShare)} · out \${pct(outputShare)} · cache \${pct(cacheShare)}</span>\`
          : "";
        return \`<div class="bar-row">\${activityPill(bucket.activity)}
          <div class="bar-tracks">
            <div class="bar-track"><div class="bar-fill" style="width:\${width}%"></div></div>
            \${tokenBar}
          </div>
          <span class="bar-meta">\${fmt(bucket.weighted_cost)} · \${pct(bucket.share_of_total)}\${tokenMeta}</span></div>\`;
      }).join("");
      return \`<section><h2>\${title}</h2>\${legend}<div class="bars">\${rows}</div></section>\`;
    }
    function renderCompare() {
      if (!report.compare) return "";
      const rows = report.compare.activity_deltas.map((delta) => {
        const cls = delta.weighted_delta > 0 ? "delta-pos" : delta.weighted_delta < 0 ? "delta-neg" : "";
        const sign = delta.weighted_delta > 0 ? "+" : "";
        return \`<tr><td>\${activityPill(delta.activity)}</td>
          <td class="\${cls}">\${sign}\${fmt(delta.weighted_delta)}</td>
          <td>\${delta.call_delta >= 0 ? "+" : ""}\${delta.call_delta}</td>
          <td>\${pct(delta.primary_share)}</td><td>\${pct(delta.compare_share)}</td></tr>\`;
      }).join("");
      return \`<section><h2>Compare — activity deltas (primary − compare)</h2>
        <table><thead><tr><th>Activity</th><th>Weighted Δ</th><th>Calls Δ</th><th>Primary share</th><th>Compare share</th></tr></thead>
        <tbody>\${rows}</tbody></table>
        <p class="caption">Compare weighted total: \${fmt(report.compare.totals.weighted_total)} (\${report.compare.reconciliation_ok ? "reconcile OK" : "MISMATCH"})</p></section>\`;
    }
    function renderCumulativeChart() {
      const series = report.cumulative_series;
      if (series.length === 0) return "";
      const width = 960, height = 180, pad = { l: 48, r: 12, t: 12, b: 28 };
      const xs = series.map((p) => p.seconds_since_start ?? p.call_index);
      const ys = series.map((p) => p.cumulative_weighted);
      const minX = Math.min(...xs), maxX = Math.max(...xs, 1), maxY = Math.max(...ys, 1);
      const points = series.map((p, i) => {
        const x = pad.l + ((xs[i] - minX) / (maxX - minX || 1)) * (width - pad.l - pad.r);
        const y = pad.t + (1 - ys[i] / maxY) * (height - pad.t - pad.b);
        return \`\${x.toFixed(1)},\${y.toFixed(1)}\`;
      }).join(" ");
      return \`<section><h2>Cumulative weighted cost</h2><div class="chart-wrap">
        <svg class="chart" viewBox="0 0 \${width} \${height}" role="img" aria-label="Cumulative weighted cost">
          <polyline fill="none" stroke="var(--accent)" stroke-width="2" points="\${points}" /></svg></div>
        <p class="caption">X: seconds since start (fallback: call index). Y: cumulative weighted cost.</p></section>\`;
    }
    function renderCallTable() {
      const activities = [...new Set(report.calls.map((c) => c.activity))].sort();
      const options = ['<option value="">All activities</option>']
        .concat(activities.map((a) => \`<option value="\${a}">\${a}</option>\`)).join("");
      return \`<section><h2>Call ledger</h2><div class="controls">
        <label>Filter <select id="activity-filter">\${options}</select></label>
        <input id="call-search" type="search" placeholder="Search model or tool detail" /></div>
        <table id="call-table"><thead><tr>
          <th>#</th><th>Turn</th><th>Activity</th><th>Weighted</th><th>Cumulative</th><th>Model</th><th>Tools</th>
        </tr></thead><tbody></tbody></table></section>\`;
    }
    function toolSummary(tools) {
      if (!tools.length) return "—";
      return tools.map((t) => \`\${t.name}\${t.detail ? ": " + t.detail : ""}\${t.output ? " → " + t.output : ""}\`).join("; ");
    }
    function renderToolBlock(tool) {
      const head = \`\${tool.is_error ? "!" : ""}\${tool.name}\${tool.detail ? " · " + tool.detail : ""}\`;
      const output = tool.output
        ? \`<pre class="tool-output">\${escapeHtml(tool.output)}</pre>\`
        : "";
      return \`<div class="tool-block">\${head}\${output}</div>\`;
    }
    function renderCalls(filterActivity, search) {
      const tbody = document.querySelector("#call-table tbody");
      const needle = (search || "").toLowerCase();
      tbody.innerHTML = report.calls
        .filter((call) => !filterActivity || call.activity === filterActivity)
        .filter((call) => !needle || [call.model, call.activity, toolSummary(call.tools)].join(" ").toLowerCase().includes(needle))
        .map((call) => {
          const tools = call.tools.map((t) => renderToolBlock(t)).join("");
          return \`<tr data-index="\${call.index}"><td>\${call.index}</td><td>\${call.turn}</td>
            <td>\${activityPill(call.activity)}</td><td>\${fmt(call.weighted_cost)}</td>
            <td>\${fmt(call.cumulative_weighted)}</td><td>\${call.model}</td>
            <td><button type="button" class="row-toggle">show</button><div class="tools">\${tools || "—"}</div></td></tr>\`;
        }).join("");
      tbody.querySelectorAll(".row-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = btn.closest("tr");
          const open = row.getAttribute("data-open") === "true";
          row.setAttribute("data-open", open ? "false" : "true");
          btn.textContent = open ? "show" : "hide";
        });
      });
    }
    const app = document.getElementById("app");
    app.innerHTML = renderStats()
      + renderVerification()
      + manifestHtml
      + renderActivityBars(report.activity_summary, "Activity breakdown (weighted cost)")
      + (report.compare ? renderActivityBars(report.compare.activity_summary, "Compare activity breakdown") : "")
      + renderCompare() + renderCumulativeChart() + renderCallTable();
    const filter = document.getElementById("activity-filter");
    const search = document.getElementById("call-search");
    const refresh = () => renderCalls(filter.value, search.value);
    filter.addEventListener("change", refresh);
    search.addEventListener("input", refresh);
    refresh();
  </script>
</body>
</html>
`;
}
