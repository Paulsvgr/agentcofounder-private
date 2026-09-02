import { Link } from "react-router-dom";
import type { ExperimentStudy } from "../types/experiment";
import {
  studyHeadline,
  verdictBadgeClass,
  verdictLabel,
} from "../lib/experimentCatalog";

type Props = {
  study: ExperimentStudy;
  onApplyFilter?: () => void;
};

export function ExperimentStudyPanel({ study, onApplyFilter }: Props) {
  return (
    <aside className="experiment-context panel">
      <div className="experiment-card-head">
        <div>
          <h3 className="experiment-context-title">{studyHeadline(study)}</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            {study.result}
          </p>
        </div>
        <span className={verdictBadgeClass(study.verdict)}>{verdictLabel(study.verdict)}</span>
      </div>
      <p className="muted experiment-context-detail">
        <strong>Change:</strong> {study.change}
      </p>
      <div className="experiment-context-actions">
        {onApplyFilter && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onApplyFilter}>
            Filter all arms
          </button>
        )}
        <Link to={`/experiments#${study.id}`} className="btn btn-sm btn-ghost">
          Full write-up
        </Link>
      </div>
    </aside>
  );
}
