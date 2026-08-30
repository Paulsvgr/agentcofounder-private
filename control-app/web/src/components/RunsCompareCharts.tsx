import { useMemo } from "react";
import type { RunSummary } from "../lib/api.js";
import {
  chartPalette,
  experimentKey,
  formatStatNumber,
  groupKeyForRun,
  medianWeightedByGroup,
  shortChartLabel,
  successRateByGroup,
  type ChartGroupKey,
} from "../lib/run-stats.js";
import { HorizontalBarChart } from "./charts/HorizontalBarChart.js";
import { RatingScatter, type ScatterPoint } from "./charts/RatingScatter.js";

const GROUP_OPTIONS: Array<{ value: ChartGroupKey; label: string }> = [
  { value: "experiment", label: "Experiment" },
  { value: "model", label: "Model" },
  { value: "provider", label: "Provider" },
  { value: "author", label: "Author" },
];

type Props = {
  runs: RunSummary[];
  groupBy: ChartGroupKey;
  onGroupByChange: (next: ChartGroupKey) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function RunsCompareCharts({
  runs,
  groupBy,
  onGroupByChange,
  collapsed = false,
  onToggleCollapsed,
}: Props) {
  const scatterPoints = useMemo((): ScatterPoint[] => {
    return runs
      .filter((run) => run.weighted_cost !== null)
      .map((run) => {
        const group = groupKeyForRun(run, groupBy);
        return {
          id: run.run_id,
          x: run.weighted_cost!,
          y: run.app_rating,
          label: experimentKey(run),
          sublabel: run.run_id.replace("T", " ").slice(0, 19),
          color: chartPalette(group),
          rated: run.app_rating !== null,
        };
      });
  }, [runs, groupBy]);

  const medianRows = useMemo(() => {
    const med = medianWeightedByGroup(runs, groupBy);
    return [...med.entries()]
      .map(([key, value]) => ({
        key,
        label: shortChartLabel(key),
        value: Math.round(value),
        color: chartPalette(key),
      }))
      .sort((a, b) => a.value - b.value);
  }, [runs, groupBy]);

  const successRows = useMemo(() => {
    return successRateByGroup(runs, groupBy).map((row) => ({
      key: row.key,
      label: shortChartLabel(row.key),
      value: Math.round(row.rate * 100),
      color: chartPalette(row.key),
      meta: `${row.success}/${row.total}`,
    }));
  }, [runs, groupBy]);

  const groupLabel = GROUP_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Group";

  if (runs.length === 0) {
    return (
      <section className="runs-compare">
        <div className="runs-compare-header">
          <div>
            <h3>Compare</h3>
            <p className="muted">Efficiency and quality across dimensions.</p>
          </div>
        </div>
        <p className="muted compare-chart-empty">No runs in this filter set.</p>
      </section>
    );
  }

  return (
    <section className="runs-compare">
      <div className="runs-compare-header">
        <div>
          <h3>Compare</h3>
          <p className="muted">Efficiency and quality across dimensions.</p>
        </div>
        <div className="runs-compare-controls">
          {!collapsed ? (
            <div className="segment-control" role="group" aria-label="Group charts by">
              {GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segment-btn${groupBy === option.value ? " active" : ""}`}
                  onClick={() => onGroupByChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {onToggleCollapsed ? (
            <button type="button" className="button-link secondary" onClick={onToggleCollapsed}>
              {collapsed ? "Show charts" : "Hide charts"}
            </button>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
      <div className="compare-grid">
        <div className="compare-card compare-card-wide">
          <h4>Cost vs quality</h4>
          <p className="muted compare-card-hint">Rated runs only — cheaper and higher-rated cluster toward the bottom-left.</p>
          <RatingScatter
            points={scatterPoints}
            xLabel="Weighted cost (lower is better)"
            yLabel="App rating"
          />
        </div>

        <div className="compare-card">
          <h4>Median weighted · {groupLabel}</h4>
          <p className="muted compare-card-hint">Typical cost per {groupLabel.toLowerCase()}.</p>
          <HorizontalBarChart rows={medianRows} />
        </div>

        <div className="compare-card">
          <h4>Success rate · {groupLabel}</h4>
          <p className="muted compare-card-hint">Share of runs that finished successfully.</p>
          <HorizontalBarChart
            rows={successRows}
            maxValue={100}
            unit="%"
            formatValue={(v) => String(v)}
          />
        </div>
      </div>
      )}
    </section>
  );
}
