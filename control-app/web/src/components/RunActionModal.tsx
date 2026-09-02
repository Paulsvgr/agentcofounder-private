import { useNavigate } from "react-router-dom";
import { methodLabel } from "../lib/classification";
import { shortRunId } from "../lib/actionFlow";
import { formatNumber, weightedOf } from "../lib/stats";
import type { HackathonRunRecord } from "../types/runExport";

type Props = {
  run: HackathonRunRecord;
  onClose: () => void;
};

export function RunActionModal({ run, onClose }: Props) {
  const navigate = useNavigate();
  const exp = run.data.export;
  const runId = exp?.meta?.run_id || run.id;
  const weighted = weightedOf(run);
  const status = exp?.harness?.status || "—";

  function go(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal panel" role="dialog" aria-labelledby="run-action-title">
        <h2 id="run-action-title">Run actions</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {methodLabel(run)} · {shortRunId(runId)} · {run.person}
        </p>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
          status {status}
          {weighted !== null ? ` · weighted ${formatNumber(weighted, 0)}` : ""}
        </p>

        <div className="modal-actions stack">
          <button type="button" className="btn" onClick={() => go(`/runs/${run.id}`)}>
            View run detail
          </button>
          <button type="button" className="btn" onClick={() => go(`/runs/${run.id}/rate`)}>
            Fix rating only
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => go(`/runs/${run.id}/edit`)}>
            Edit full run
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
