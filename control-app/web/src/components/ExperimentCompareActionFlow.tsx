import { useMemo, useState } from "react";
import { shortRunId, type ActionFlowRuler } from "../lib/actionFlow";
import { methodLabel } from "../lib/classification";
import type { HackathonRunRecord } from "../types/runExport";
import { hasActionFlow } from "../types/runExport";
import { ActionFlowChart } from "./ActionFlowChart";

type Props = {
  runs: HackathonRunRecord[];
  labels?: Map<string, string>;
};

export function ExperimentCompareActionFlow({ runs, labels }: Props) {
  const [ruler, setRuler] = useState<ActionFlowRuler>("weighted");
  const chartRuns = useMemo(
    () => runs.filter((r) => hasActionFlow(r.data.export)),
    [runs],
  );

  if (chartRuns.length < 2) {
    return (
      <p className="muted">
        Need at least two v2 runs with action_flow in this set to compare side-by-side.
      </p>
    );
  }

  return (
    <div className="cohort-flow stack">
      <div className="ruler-tabs" role="tablist" aria-label="Compare ruler">
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

      <div className="cohort-flow-grid">
        {chartRuns.map((run) => {
          const runId = run.data.export?.meta?.run_id || "";
          const label =
            labels?.get(runId) ||
            methodLabel(run) ||
            shortRunId(runId);
          return (
            <div key={run.id} className="cohort-flow-card panel">
              <div className="cohort-flow-card-head">
                <strong>{label}</strong>
                <span className="muted">{shortRunId(runId)}</span>
              </div>
              <ActionFlowChart
                exportDoc={run.data.export}
                compact
                highlightStages
                ruler={ruler}
                hideRulerTabs
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated use ExperimentCompareActionFlow */
export { ExperimentCompareActionFlow as CohortActionFlow };
