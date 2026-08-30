import { Link } from "react-router-dom";
import { ExperimentTrajectoryCharts } from "./ExperimentTrajectoryCharts";
import type { ExperimentStudy } from "../types/experiment";
import type { HackathonRunRecord } from "../types/runExport";
import {
  studyById,
  studyHeadline,
  verdictBadgeClass,
  verdictLabel,
} from "../lib/experimentCatalog";

type Props = {
  study: ExperimentStudy;
  runs: HackathonRunRecord[];
  compact?: boolean;
};

export function ExperimentStudyCard({ study, runs, compact = false }: Props) {
  const runsHref = `/?study=${study.id}`;

  return (
    <article className={`experiment-card panel${compact ? " experiment-card-compact" : ""}`}>
      <div className="experiment-card-head">
        <div>
          <h3 className="experiment-card-title">
            {studyHeadline(study)}
            {study.line ? ` · Line ${study.line}` : ""}
          </h3>
          <p className="muted experiment-card-arms">
            {study.arms.map((a) => a.replace(/-/g, " ")).join(" · ")}
          </p>
        </div>
        <span className={verdictBadgeClass(study.verdict)}>{verdictLabel(study.verdict)}</span>
      </div>

      <dl className="experiment-dl">
        <div>
          <dt>Change</dt>
          <dd>{study.change}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{study.goal}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{study.result}</dd>
        </div>
      </dl>

      {!compact && <ExperimentTrajectoryCharts study={study} runs={runs} />}

      {(study.buildsOn || study.cohortPreset) && (
        <p className="muted experiment-links" style={{ marginBottom: 0 }}>
          {study.buildsOn && (
            <>
              Builds on{" "}
              <Link to={`/experiments#${study.buildsOn}`}>
                {studyById(study.buildsOn) ? studyHeadline(studyById(study.buildsOn)!) : study.buildsOn}
              </Link>
              {" · "}
            </>
          )}
          {study.cohortPreset && (
            <Link to={`/cohort${study.cohortPreset === "exp1-rtl" ? "?preset=exp1-rtl" : ""}`}>
              View cohort
            </Link>
          )}
        </p>
      )}

      {!compact && (
        <div className="experiment-card-actions">
          <Link to={runsHref} className="btn btn-sm">
            View runs
          </Link>
        </div>
      )}
    </article>
  );
}
