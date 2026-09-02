import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatStatNumber } from "../../lib/run-stats.js";
import { APP_RUBRIC_TOTAL_MAX } from "../../../../shared/app-rubric.js";

export type ScatterPoint = {
  id: string;
  x: number;
  y: number | null;
  label: string;
  sublabel: string;
  color: string;
  rated: boolean;
};

type Props = {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
};

const PAD = { top: 16, right: 20, bottom: 44, left: 44 };
const Y_MIN = 0;
const Y_MAX = APP_RUBRIC_TOTAL_MAX;

export function RatingScatter({ points, xLabel, yLabel }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);

  const ratedPoints = useMemo(
    () => points.filter((p) => p.rated && p.y !== null),
    [points],
  );
  const unratedCount = points.length - ratedPoints.length;

  const layout = useMemo(() => {
    const xs = ratedPoints.map((p) => p.x);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 1;
    const xPad = (xMax - xMin) * 0.08 || 1000;
    return {
      xMin: Math.max(0, xMin - xPad),
      xMax: xMax + xPad,
    };
  }, [ratedPoints]);

  const width = 720;
  const height = 300;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  function xScale(x: number): number {
    const { xMin, xMax } = layout;
    if (xMax <= xMin) return PAD.left + innerW / 2;
    return PAD.left + ((x - xMin) / (xMax - xMin)) * innerW;
  }

  function yScale(y: number): number {
    return PAD.top + innerH - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;
  }

  const yTicks = [0, 20, 40, 60, 80, 100];
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const t = i / (xTickCount - 1);
    return layout.xMin + t * (layout.xMax - layout.xMin);
  });

  if (points.length === 0) {
    return <p className="muted compare-chart-empty">No weighted runs to plot.</p>;
  }

  if (ratedPoints.length === 0) {
    return (
      <div className="scatter-wrap">
        <p className="muted compare-chart-empty">
          No rated runs to plot.
          {unratedCount > 0
            ? ` ${unratedCount} unrated run${unratedCount === 1 ? "" : "s"} with weighted cost are hidden.`
            : null}
        </p>
      </div>
    );
  }

  return (
    <div className="scatter-wrap">
      <div className="scatter-meta">
        <span>
          {ratedPoints.length} rated run{ratedPoints.length === 1 ? "" : "s"}
        </span>
        {unratedCount > 0 ? (
          <>
            <span className="muted">·</span>
            <span className="muted">
              {unratedCount} unrated not shown
            </span>
          </>
        ) : null}
      </div>
      <div className="scatter-svg-frame">
        <svg
          className="scatter-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${xLabel} vs ${yLabel}`}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                className="scatter-grid"
              />
              <text x={PAD.left - 8} y={yScale(tick) + 4} className="scatter-tick" textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {xTicks.map((tick, index) => (
            <g key={`${tick}-${index}`}>
              <line
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={PAD.top}
                y2={height - PAD.bottom}
                className="scatter-grid scatter-grid-vert"
              />
              <text
                x={xScale(tick)}
                y={height - PAD.bottom + 20}
                className="scatter-tick"
                textAnchor="middle"
              >
                {formatStatNumber(tick, 0)}
              </text>
            </g>
          ))}
          <text x={width / 2} y={height - 6} className="scatter-axis-label" textAnchor="middle">
            {xLabel}
          </text>
          <text
            x={14}
            y={height / 2}
            className="scatter-axis-label"
            textAnchor="middle"
            transform={`rotate(-90 14 ${height / 2})`}
          >
            {yLabel}
          </text>
          {ratedPoints.map((point) => {
            const cy = yScale(point.y!);
            const active = hovered?.id === point.id;
            return (
              <circle
                key={point.id}
                cx={xScale(point.x)}
                cy={cy}
                r={active ? 7 : 5}
                fill={point.color}
                stroke={point.color}
                strokeWidth={1.5}
                className="scatter-point"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(point)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => void navigate(`/runs/${encodeURIComponent(point.id)}`)}
              />
            );
          })}
        </svg>
      </div>
      {hovered ? (
        <div className="scatter-tooltip">
          <strong>{hovered.label}</strong>
          <span>{hovered.sublabel}</span>
          <span>
            weighted {formatStatNumber(hovered.x, 0)}
            {hovered.y !== null ? ` · rating ${hovered.y}/${APP_RUBRIC_TOTAL_MAX}` : ""}
          </span>
        </div>
      ) : (
        <p className="muted scatter-hint">
          Lower left is cheaper and higher-rated. Click a point to open the run.
        </p>
      )}
    </div>
  );
}
