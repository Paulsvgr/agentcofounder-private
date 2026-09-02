import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  curveComparisonRows,
  stageComparisonRows,
  trajectoryGroupsForStudy,
} from "../lib/experimentTrajectory";
import { useTheme } from "../lib/theme";
import type { ExperimentStudy } from "../types/experiment";
import type { HackathonRunRecord } from "../types/runExport";

type Props = {
  study: ExperimentStudy;
  runs: HackathonRunRecord[];
};

const GROUP_COLORS = {
  control: "#64748b",
  treatment: "#2563eb",
} as const;

function chartTheme(dark: boolean) {
  return {
    tick: { fill: dark ? "#e8eaed" : "#16191d", fontSize: 11, fontWeight: 500 as const },
    grid: dark ? "#2e343d" : "#d8dbe0",
    axis: dark ? "#9aa3af" : "#5b6470",
    tooltip: {
      background: dark ? "#181c22" : "#ffffff",
      border: dark ? "1px solid #2e343d" : "1px solid #d8dbe0",
      borderRadius: 6,
      color: dark ? "#e8eaed" : "#16191d",
      fontSize: 12,
    },
    labelFill: dark ? "#e8eaed" : "#16191d",
  };
}

export function ExperimentTrajectoryCharts({ study, runs }: Props) {
  const { theme } = useTheme();
  const ct = chartTheme(theme === "dark");

  const groups = useMemo(() => trajectoryGroupsForStudy(runs, study), [runs, study]);
  const curveRows = useMemo(() => curveComparisonRows(groups), [groups]);
  const stageRows = useMemo(() => stageComparisonRows(groups), [groups]);

  if (!groups.length) {
    return (
      <p className="muted experiment-trajectory-empty">
        No v2 action-flow runs in DB for this experiment yet — publish exports to compare trajectories.
      </p>
    );
  }

  const totalRuns = groups.reduce((n, g) => n + g.runCount, 0);

  return (
    <div className="experiment-trajectory stack">
      <p className="muted experiment-trajectory-meta">
        Normalized trajectories from {totalRuns} v2 run{totalRuns === 1 ? "" : "s"} with action_flow
        {groups.length === 1 ? ` (${groups[0]!.label.toLowerCase()} only)` : ""}.
      </p>

      <div className="experiment-trajectory-grid">
        <div className="experiment-trajectory-chart">
          <h4>Cumulative weighted curve</h4>
          <p className="chart-hint">
            X = progress through model calls (%). Y = cumulative weighted tokens (% of final total).
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={curveRows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="progress"
                  tick={ct.tick}
                  stroke={ct.axis}
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: "Run progress",
                    position: "insideBottom",
                    offset: -2,
                    fill: ct.labelFill,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={ct.tick}
                  stroke={ct.axis}
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: "Cumulative weighted",
                    angle: -90,
                    position: "insideLeft",
                    fill: ct.labelFill,
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={ct.tooltip}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, ""]}
                  labelFormatter={(label) => `Progress ${label}%`}
                />
                <Legend />
                {groups.map((g) => (
                  <Line
                    key={g.key}
                    type="monotone"
                    dataKey={g.key}
                    name={`${g.label} (n=${g.runCount})`}
                    stroke={GROUP_COLORS[g.key]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="experiment-trajectory-chart">
          <h4>Stage mix (% weighted)</h4>
          <p className="chart-hint">
            Median share of weighted tokens per action-flow stage — control vs treatment.
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={stageRows}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={ct.tick}
                  stroke={ct.axis}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={92}
                  tick={ct.tick}
                  stroke={ct.axis}
                />
                <Tooltip
                  contentStyle={ct.tooltip}
                  formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                />
                <Legend />
                {groups.some((g) => g.key === "control") && (
                  <Bar dataKey="control" name="Control" fill={GROUP_COLORS.control} radius={[0, 3, 3, 0]} />
                )}
                {groups.some((g) => g.key === "treatment") && (
                  <Bar
                    dataKey="treatment"
                    name="Treatment"
                    fill={GROUP_COLORS.treatment}
                    radius={[0, 3, 3, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
