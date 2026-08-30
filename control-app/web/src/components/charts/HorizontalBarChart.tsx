import { formatStatNumber } from "../../lib/run-stats.js";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  color: string;
  meta?: string;
};

type Props = {
  rows: BarRow[];
  maxValue?: number;
  formatValue?: (value: number) => string;
  unit?: string;
  emptyLabel?: string;
};

export function HorizontalBarChart({
  rows,
  maxValue,
  formatValue = (v) => formatStatNumber(v, 0),
  unit = "",
  emptyLabel = "No data",
}: Props) {
  if (rows.length === 0) {
    return <p className="muted compare-chart-empty">{emptyLabel}</p>;
  }

  const peak = maxValue ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="hbar-chart" role="list">
      {rows.map((row) => {
        const width = peak > 0 ? (row.value / peak) * 100 : 0;
        return (
          <div key={row.key} className="hbar-row" role="listitem">
            <div className="hbar-label" title={row.key}>
              {row.label}
            </div>
            <div className="hbar-track-wrap">
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${width}%`, background: row.color }}
                />
              </div>
              {row.meta ? <span className="hbar-meta">{row.meta}</span> : null}
            </div>
            <div className="hbar-value">
              {formatValue(row.value)}
              {unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}
