import type { BoardDecision } from "../../../shared/harness-board.js";
import { decisionBadgeClass } from "../../../shared/harness-board.js";

export function BoardDecisionBadge({ decision }: { decision: BoardDecision }) {
  return <span className={`badge ${decisionBadgeClass(decision)}`}>{decision}</span>;
}
