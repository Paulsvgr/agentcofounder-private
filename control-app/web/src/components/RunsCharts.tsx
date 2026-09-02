import { useMemo } from "react";
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
import { useTheme } from "../lib/theme";
import { experimentKey, methodLabel } from "../lib/classification";
import {
  formatNumber,
  medianWeightedByExperiment,
  weightedOf,
} from "../lib/stats";
import type { HackathonRunRecord } from "../types/runExport";

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

function chartTheme(dark: boolean) {
  return {
    tick: { fill: dark ? "#e8eaed" : "#16191d", fontSize: 12, fontWeight: 500 as const },
    grid: dark ? "#2e343d" : "#d8dbe0",
    axis: dark ? "#9aa3af" : "#5b6470",
    tooltip: {
      background: dark ? "#181c22" : "#ffffff",
      border: dark ? "1px solid #2e343d" : "1px solid #d8dbe0",
      borderRadius: 6,
      color: dark ? "#e8eaed" : "#16191d",
      fontSize: 13,
      fontWeight: 400,
    },
    labelFill: dark ? "#e8eaed" : "#16191d",
    pointStroke: dark ? "#e8eaed" : "#16191d",
  };
}

function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

function shortLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

type Props = {
  runs: HackathonRunRecord[];
  onSelectRun: (id: string) => void;
};

export function RunsCharts({ runs, onSelectRun }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === "dark");

  // Unrated runs still belong on this chart — plot them on a dedicated n/a row.
  const UNRATED_Y = -0.8;

  const scatter = useMemo(() => {
    return runs
      .map((run) => {
        const w = weightedOf(run);
        if (w === null) return null;
        const rawRating = run.data.app_rating ?? run.data.human?.app_rating;
        const rated = rawRating !== null && rawRating !== undefined;
        const experiment = experimentKey(run);
        const label = methodLabel(run);
        return {
          id: run.id,
          runId: run.data.export?.meta?.run_id || run.id.slice(0, 8),
          approach: experiment,
          label,
          weighted: w,
          rating: rated ? Number(rawRating) : UNRATED_Y,
          rated,
          ratingLabel: rated ? String(rawRating) : "n/a",
          fill: colorFor(experiment),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [runs]);

  const medianBars = useMemo(() => {
    const med = medianWeightedByExperiment(runs);
    return [...med.entries()]
      .map(([experiment, medianVal]) => ({
        approach: experiment,
        label: shortLabel(experiment.replace(/-/g, " ")),
        median: Math.round(medianVal),
        fill: colorFor(experiment),
      }))
      .sort((a, b) => a.median - b.median);
  }, [runs]);

  const successBars = useMemo(() => {
    const buckets = new Map<string, { ok: number; n: number }>();
    for (const run of runs) {
      const key = experimentKey(run);
      const b = buckets.get(key) ?? { ok: 0, n: 0 };
      b.n += 1;
      if ((run.data.export?.harness?.status || "").toLowerCase() === "success") {
        b.ok += 1;
      }
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
  }, [runs]);

  const barHeight = Math.max(280, medianBars.length * 28 + 48);

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
              <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="weighted"
                name="weighted"
                tick={ct.tick}
                stroke={ct.axis}
                label={{
                  value: "weighted_total (lower better)",
                  position: "insideBottom",
                  offset: -10,
                  fill: ct.labelFill,
                  fontSize: 12,
                  fontWeight: 700,
                }}
                tickFormatter={(v) => formatNumber(Number(v), 0)}
              />
              <YAxis
                type="number"
                dataKey="rating"
                name="rating"
                domain={[-1.5, 10]}
                ticks={[-0.8, 0, 2, 4, 6, 8, 10]}
                tick={ct.tick}
                stroke={ct.axis}
                tickFormatter={(v) => (Number(v) < 0 ? "n/a" : String(v))}
                label={{
                  value: "app rating",
                  angle: -90,
                  position: "insideLeft",
                  fill: ct.labelFill,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
              <ZAxis range={[90, 90]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: ct.axis }}
                contentStyle={ct.tooltip}
                itemStyle={{ color: ct.tooltip.color }}
                labelStyle={{ color: ct.tooltip.color, fontWeight: 700 }}
                formatter={(value, name, item) => {
                  const p = item?.payload as { rated?: boolean; ratingLabel?: string } | undefined;
                  if (String(name) === "rating") {
                    return [p?.ratingLabel ?? String(value ?? ""), "rating"];
                  }
                  return [
                    typeof value === "number" ? formatNumber(value) : String(value ?? ""),
                    String(name),
                  ];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as
                    | { label?: string; runId?: string }
                    | undefined;
                  return p ? `${p.label} · ${p.runId}` : "";
                }}
              />
              <Scatter
                data={scatter}
                onClick={(d) => {
                  const id = (d as { id?: string })?.id;
                  if (id) onSelectRun(id);
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
        <h3>Median weighted by experiment</h3>
        <p className="chart-hint">Lower is better. Grouped by structured experiment.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart
              layout="vertical"
              data={medianBars}
              margin={{ top: 8, right: 52, bottom: 8, left: 4 }}
            >
              <CartesianGrid stroke={ct.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={ct.tick}
                stroke={ct.axis}
                tickFormatter={(v) => formatNumber(Number(v), 0)}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={ct.tick}
                stroke={ct.axis}
                interval={0}
              />
              <Tooltip
                contentStyle={ct.tooltip}
                itemStyle={{ color: ct.tooltip.color }}
                labelStyle={{ color: ct.tooltip.color, fontWeight: 700 }}
                formatter={(value, _n, item) => {
                  const full = (item?.payload as { approach?: string } | undefined)?.approach;
                  return [formatNumber(Number(value), 0), full || "median"];
                }}
              />
              <Bar dataKey="median" radius={[0, 4, 4, 0]} barSize={18}>
                {medianBars.map((p) => (
                  <Cell key={p.approach} fill={p.fill} stroke={ct.pointStroke} strokeWidth={0.5} />
                ))}
                <LabelList
                  dataKey="median"
                  position="right"
                  fill={ct.labelFill}
                  fontSize={11}
                  fontWeight={700}
                  formatter={(v) => formatNumber(Number(v), 0)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Success rate by experiment</h3>
        <p className="chart-hint">Share of runs with status success.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart
              layout="vertical"
              data={successBars}
              margin={{ top: 8, right: 52, bottom: 8, left: 4 }}
            >
              <CartesianGrid stroke={ct.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={ct.tick} stroke={ct.axis} unit="%" />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={ct.tick}
                stroke={ct.axis}
                interval={0}
              />
              <Tooltip
                contentStyle={ct.tooltip}
                itemStyle={{ color: ct.tooltip.color }}
                labelStyle={{ color: ct.tooltip.color, fontWeight: 700 }}
                formatter={(value, _n, item) => {
                  const p = item?.payload as
                    | { approach?: string; counts?: string }
                    | undefined;
                  return [`${value}% (${p?.counts || ""})`, p?.approach || "success"];
                }}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                {successBars.map((p) => (
                  <Cell key={p.approach} fill={p.fill} stroke={ct.pointStroke} strokeWidth={0.5} />
                ))}
                <LabelList
                  dataKey="rate"
                  position="right"
                  fill={ct.labelFill}
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
