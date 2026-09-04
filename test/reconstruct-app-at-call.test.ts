import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCallLedgerFromEvents } from "../src/v2/normalize.js";
import { buildTrajectoryMetrics } from "../src/v2/trajectory-metrics.js";
import {
  findFirstPostMutationCanonicalVerify,
  inferFirstTestMutationCallFromLedger,
} from "../src/v2/early-verify-metrics.js";
import { countAuthoredTestsInApp } from "../solution/extensions/early-verify-core.js";
import { reconstructAppAtVerifyAnchor } from "../src/v2/reconstruct-app-at-call.js";

const V22_RUN_IDS = [
  "2026-08-31T21-16-45-263Z",
  "2026-08-31T21-19-44-728Z",
  "2026-08-31T21-22-09-667Z",
  "2026-08-31T21-24-11-541Z",
  "2026-08-31T21-28-10-966Z",
];

describe("v2.2 control anchor reconstruction", () => {
  it.each(V22_RUN_IDS)("reconstructs source-derived metrics for %s", async (runId) => {
    const runDir = path.resolve("artifacts/runs", runId);
    const events = readFileSync(path.join(runDir, "events.jsonl"), "utf8");
    const ledger = buildCallLedgerFromEvents(events, runId, "events.jsonl");
    const trajectory = buildTrajectoryMetrics(ledger);
    const mutation = inferFirstTestMutationCallFromLedger(ledger);
    const anchor = findFirstPostMutationCanonicalVerify(trajectory, mutation.call_index);

    expect(anchor?.call_index).toBeTypeOf("number");

    const snapshot = await reconstructAppAtVerifyAnchor({
      runDirectory: runDir,
      anchorCallIndex: anchor!.call_index,
    });

    try {
      expect(snapshot.metrics.test_file_edit_failures).toBe(0);
      expect(snapshot.metrics.authored_test_count_at_anchor).toBeGreaterThan(0);
      expect(snapshot.metrics.test_loc_at_anchor).toBeGreaterThan(0);
      expect(snapshot.metrics.qualifying_test_files.length).toBeGreaterThan(0);

      const recount = countAuthoredTestsInApp(snapshot.appRoot);
      expect(recount.authored_test_count).toBe(snapshot.metrics.authored_test_count_at_anchor);
      expect(recount.test_loc).toBe(snapshot.metrics.test_loc_at_anchor);
    } finally {
      snapshot.cleanup();
    }
  });

  it("rep 1 anchor matches initial test write only (no post-anchor edits)", async () => {
    const runId = "2026-08-31T21-16-45-263Z";
    const runDir = path.resolve("artifacts/runs", runId);
    const snapshot = await reconstructAppAtVerifyAnchor({
      runDirectory: runDir,
      anchorCallIndex: 10,
    });
    try {
      expect(snapshot.metrics.test_file_ops_replayed).toBe(1);
      expect(snapshot.metrics.authored_test_count_at_anchor).toBe(8);
    } finally {
      snapshot.cleanup();
    }
  });
});
