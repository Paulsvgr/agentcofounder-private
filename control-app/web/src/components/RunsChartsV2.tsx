import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { RunSummary } from "../lib/api.js";
import { APP_RUBRIC_TOTAL_MAX, effectiveRatingForCompare } from "../../../shared/app-rubric.js";
import {
  experimentKey,
  formatStatNumber,
  groupKeyForRun,
  medianWeightedByExperiment,
  type ChartGroupKey,
} from "../lib/run-stats.js";

const COLORS = [
  "#2563eb",
  "#64748b",
  "#0891b2",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0d9488",
  "#9333ea",
  "#475569",
  "#0369a1",
];

const UNRATED_Y = -0.8;

function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

function shortLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const GROUP_LABELS: Record<ChartGroupKey, string> = {
  experiment: "experiment",
  model: "model",
  provider: "provider",
  author: "author",
};

type Props = {
  runs: RunSummary[];
  groupBy: ChartGroupKey;
};

export function RunsChartsV2({ runs, groupBy }: Props) {
  const navigate = useNavigate();

  const scatter = useMemo(() => {
    return runs
      .map((run) => {
        const w = run.weighted_cost;
        if (w === null) return null;
        const effectiveRating = effectiveRatingForCompare(run.app_rating, run.app_rubric);
        const rated = effectiveRating !== null;
        const group = groupKeyForRun(run, groupBy);
        const label = experimentKey(run);
        return {
          id: run.run_id,
          runId: run.run_id.slice(0, 19),
          approach: group,
          label,
          weighted: w,
          rating: rated ? effectiveRating! : UNRATED_Y,
          rated,
          ratingLabel: rated ? String(effectiveRating) : "n/a",
          fill: colorFor(group),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [runs, groupBy]);

  const medianBars = useMemo(() => {
    const med =
      groupBy === "experiment"
        ? medianWeightedByExperiment(runs)
        : medianWeightedByGroup(runs, groupBy);
    return [...med.entries()]
      .map(([key, medianVal]) => ({
        approach: key,
        label: shortLabel(key.replace(/-/g, " ")),
        median: Math.round(medianVal),
        fill: colorFor(key),
      }))
      .sort((a, b) => a.median - b.median);
  }, [runs, groupBy]);

  const successBars = useMemo(() => {
    const buckets = new Map<string, { ok: number; n: number }>();
    for (const run of runs) {
      const key = groupKeyForRun(run, groupBy);
      const b = buckets.get(key) ?? { ok: 0, n: 0 };
      b.n += 1;
      if (run.status === "success") b.ok += 1;
      buckets.set(key, b);
    }
    return [...buckets.entries()]
      .map(([approach, { ok, n }]) => ({
        approach,
        label: shortLabel(approach),
        rate: n ? Math.round((ok / n) * 100) : 0,
        counts: `${ok}/${n}`,
        fill: colorFor(approach),
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [runs, groupBy]);

  const barHeight = Math.max(280, medianBars.length * 28 + 48);
  const groupLabel = GROUP_LABELS[groupBy];

  if (runs.length === 0) {
    return <p className="muted chart-empty">No runs in this filter set for charts.</p>;
  }

  return (
    <div className="charts-grid">
      <div className="chart-card chart-card-wide">
        <h3>Weighted vs rating</h3>
        <p className="chart-hint">
          Lower weighted + higher rating is better. Unrated runs sit on the n/a row. Click a point.
        </p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 12, right: 20, bottom: 28, left: 12 }}>
              <CartesianGrid stroke="#d8dbe0" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="weighted"
                name="weighted"
                tick={{ fill: "#16191d", fontSize: 12, fontWeight: 500 }}
                stroke="#5b6470"
                label={{
                  value: "weighted_total (lower better)",
                  position: "insideBottom",
                  offset: -10,
                  fill: "#16191d",
                  fontSize: 12,
                  fontWeight: 700,
                }}
                tickFormatter={(v) => formatStatNumber(Number(v), 0)}
              />
              <YAxis
                type="number"
                dataKey="rating"
                name="rating"
                domain={[-1.5, APP_RUBRIC_TOTAL_MAX]}
                ticks={[-0.8, 0, 20, 40, 60, 80, 100]}
                tick={{ fill: "#16191d", fontSize: 12, fontWeight: 500 }}
                stroke="#5b6470"
                tickFormatter={(v) => (Number(v) < 0 ? "n/a" : String(v))}
                label={{
                  value: "app rating",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#16191d",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
              <ZAxis range={[90, 90]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#5b6470" }}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #d8dbe0",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                formatter={(value, name, item) => {
                  const p = item?.payload as { rated?: boolean; ratingLabel?: string } | undefined;
                  if (String(name) === "rating") {
                    return [p?.ratingLabel ?? String(value ?? ""), "rating"];
                  }
                  return [
                    typeof value === "number" ? formatStatNumber(value) : String(value ?? ""),
                    String(name),
                  ];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { label?: string; runId?: string } | undefined;
                  return p ? `${p.label} · ${p.runId}` : "";
                }}
              />
              <Scatter
                data={scatter}
                onClick={(d) => {
                  const id = (d as { id?: string })?.id;
                  if (id) void navigate(`/runs/${encodeURIComponent(id)}`);
                }}
              >
                {scatter.map((p) => (
                  <Cell
                    key={p.id}
                    fill={p.rated ? p.fill : "transparent"}
                    stroke={p.fill}
                    strokeWidth={p.rated ? 1 : 2}
                    cursor="pointer"
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Median weighted by {groupLabel}</h3>
        <p className="chart-hint">Lower is better. Grouped by {groupLabel}.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart
              layout="vertical"
              data={medianBars}
              margin={{ top: 8, right: 52, bottom: 8, left: 4 }}
            >
              <CartesianGrid stroke="#d8dbe0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#16191d", fontSize: 12, fontWeight: 500 }}
                stroke="#5b6470"
                tickFormatter={(v) => formatStatNumber(Number(v), 0)}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: "#16191d", fontSize: 12, fontWeight: 500 }}
                stroke="#5b6470"
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #d8dbe0",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                formatter={(value, _n, item) => {
                  const full = (item?.payload as { approach?: string } | undefined)?.approach;
                  return [formatStatNumber(Number(value), 0), full || "median"];
                }}
              />
              <Bar dataKey="median" radius={[0, 4, 4, 0]} barSize={18}>
                {medianBars.map((p) => (
                  <Cell key={p.approach} fill={p.fill} stroke="#16191d" strokeWidth={0.5} />
                ))}
                <LabelList
                  dataKey="median"
                  position="right"
                  fill="#16191d"
                  fontSize={11}
                  fontWeight={700}
                  formatter={(v) => formatStatNumber(Number(v), 0)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Success rate by {groupLabel}</h3>
        <p className="chart-hint">Share of runs with status success.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart
              layout="vertical"
              data={successBars}
              margin={{ top: 8, right: 52, bottom: 8, left: 4 }}
            >
              <CartesianGrid stroke="#d8dbe0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#16191d", fontSize: 12 }} stroke="#5b6470" unit="%" />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: "#16191d", fontSize: 12, fontWeight: 500 }}
                stroke="#5b6470"
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #d8dbe0",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                formatter={(value, _n, item) => {
                  const p = item?.payload as { approach?: string; counts?: string } | undefined;
                  return [`${value}% (${p?.counts || ""})`, p?.approach || "success"];
                }}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                {successBars.map((p) => (
                  <Cell key={p.approach} fill={p.fill} stroke="#16191d" strokeWidth={0.5} />
                ))}
                <LabelList
                  dataKey="rate"
                  position="right"
                  fill="#16191d"
                  fontSize={11}
                  fontWeight={700}
                  formatter={(v) => `${v}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function medianWeightedByGroup(runs: RunSummary[], groupBy: ChartGroupKey): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const run of runs) {
    const key = groupKeyForRun(run, groupBy);
    const w = run.weighted_cost;
    if (w === null) continue;
    const list = buckets.get(key) ?? [];
    list.push(w);
    buckets.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, vals] of buckets) {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const m =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    out.set(key, m);
  }
  return out;
}
