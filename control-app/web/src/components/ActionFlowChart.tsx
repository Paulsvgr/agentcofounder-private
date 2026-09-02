import { useMemo, useState } from "react";
import {
  formatRulerValue,
  orderedSegments,
  rulerTotal,
  rulerUnit,
  segmentValue,
  STAGE_COLORS,
  STAGE_LABELS,
  type ActionFlowRuler,
} from "../lib/actionFlow";
import type { RunExport } from "../types/runExport";

type Props = {
  exportDoc: RunExport;
  compact?: boolean;
  highlightStages?: boolean;
  ruler?: ActionFlowRuler;
  onRulerChange?: (ruler: ActionFlowRuler) => void;
  hideRulerTabs?: boolean;
};

export function ActionFlowChart({
  exportDoc,
  compact = false,
  highlightStages = false,
  ruler: rulerProp,
  onRulerChange,
  hideRulerTabs = false,
}: Props) {
  const [rulerState, setRulerState] = useState<ActionFlowRuler>("weighted");
  const ruler = rulerProp ?? rulerState;
  const setRuler = (next: ActionFlowRuler) => {
    onRulerChange?.(next);
    if (rulerProp === undefined) setRulerState(next);
  };
  const segments = useMemo(() => orderedSegments(exportDoc.efficiency.action_flow), [exportDoc]);
  const total = useMemo(() => rulerTotal(exportDoc, ruler), [exportDoc, ruler]);

  if (!segments.length) return null;

  const source = exportDoc.efficiency.action_flow_source;

  return (
    <div className={`action-flow ${compact ? "action-flow-compact" : ""}`}>
      {!compact && (
        <div className="action-flow-head">
          <h3>Action flow</h3>
          {source === "derived+override" && (
            <span className="badge badge-warn">manual segment override</span>
          )}
        </div>
      )}

      {!hideRulerTabs && (
        <div className="ruler-tabs" role="tablist" aria-label="Action flow ruler">
          {(["time", "raw", "weighted"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={ruler === key}
              className={ruler === key ? "ruler-tab active" : "ruler-tab"}
              onClick={() => setRuler(key)}
            >
              {key === "time" ? "Time" : key === "raw" ? "Raw tokens" : "Weighted"}
            </button>
          ))}
        </div>
      )}

      <div className="action-flow-bar" title={`Total: ${formatRulerValue(total, ruler)}${rulerUnit(ruler)}`}>
        {segments.map((segment) => {
          const value = segmentValue(segment, ruler);
          const pct = total > 0 ? (value / total) * 100 : 0;
          if (pct <= 0) return null;
          const highlight =
            highlightStages && (segment.stage === "repair_loop" || segment.stage === "extra_verify");
          return (
            <div
              key={segment.stage}
              className={`action-flow-seg${highlight ? " action-flow-seg-hi" : ""}`}
              style={{
                width: `${pct}%`,
                backgroundColor: STAGE_COLORS[segment.stage],
              }}
              title={[
                STAGE_LABELS[segment.stage],
                `${segment.call_count} calls`,
                `${formatRulerValue(value, ruler)}${rulerUnit(ruler)}`,
                `${pct.toFixed(1)}% of total`,
                segment.note || "",
              ]
                .filter(Boolean)
                .join("\n")}
            />
          );
        })}
      </div>

      <div className="action-flow-legend">
        {segments.map((segment) => {
          const value = segmentValue(segment, ruler);
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={segment.stage} className="action-flow-legend-item">
              <span
                className="action-flow-swatch"
                style={{ backgroundColor: STAGE_COLORS[segment.stage] }}
              />
              <span className="action-flow-legend-label">{STAGE_LABELS[segment.stage]}</span>
              <span className="muted">
                {segment.call_count} · {formatRulerValue(value, ruler)}
                {rulerUnit(ruler)} · {pct.toFixed(0)}%
              </span>
              {segment.note && !compact && (
                <div className="action-flow-note">{segment.note}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
