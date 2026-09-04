/**
 * v2.2 control retro for Q2-D prereg — post-mutation VERIFY anchors and source-derived counts.
 *
 * Reconstructs filesystem state at first post-mutation canonical VERIFY from events.jsonl
 * (same write/edit replay as replay-run.ts; same source parser as Q2-D treatment).
 *
 * Usage: node --import tsx scripts/retro-analyze-q2-early-verify-control.ts
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildCallLedgerFromEvents } from "../src/v2/normalize.js";
import { buildTrajectoryMetrics } from "../src/v2/trajectory-metrics.js";
import {
  buildEarlyVerifyRunMetrics,
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

async function analyzeControlRun(runId: string) {
  const runDir = path.resolve("artifacts/runs", runId);
  const eventsPath = path.join(runDir, "events.jsonl");
  const events = readFileSync(eventsPath, "utf8");
  const ledger = buildCallLedgerFromEvents(events, runId, eventsPath);
  const trajectory = buildTrajectoryMetrics(ledger);

  const inferred = inferFirstTestMutationCallFromLedger(ledger);
  const firstPost = findFirstPostMutationCanonicalVerify(trajectory, inferred.call_index);

  const appDir = path.join(runDir, "app");
  const runEndAuthored = existsSync(appDir) ? countAuthoredTestsInApp(appDir) : null;

  let resultJourneys: number | null = null;
  const resultPath = path.join(runDir, "result.json");
  if (existsSync(resultPath)) {
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as { tests_run?: unknown[] };
    resultJourneys = result.tests_run?.length ?? null;
  }

  const metrics = buildEarlyVerifyRunMetrics({
    ledger,
    trajectory,
    runDirectory: runDir,
    runEndJourneyTestCount: resultJourneys,
    runEndAuthoredTestCount: runEndAuthored?.authored_test_count ?? null,
  });

  const preMutationVerify = trajectory.verification_runs.find(
    (run) =>
      run.canonical &&
      (inferred.call_index === null || run.call_index < inferred.call_index),
  );

  let authored_test_count_at_first_post_mutation_verify: number | null = null;
  let test_loc_at_first_post_mutation_verify: number | null = null;
  let reconstruction: Record<string, unknown> | null = null;

  if (firstPost?.call_index !== undefined && firstPost.call_index !== null) {
    const snapshot = await reconstructAppAtVerifyAnchor({
      runDirectory: runDir,
      anchorCallIndex: firstPost.call_index,
    });
    try {
      authored_test_count_at_first_post_mutation_verify =
        snapshot.metrics.authored_test_count_at_anchor;
      test_loc_at_first_post_mutation_verify = snapshot.metrics.test_loc_at_anchor;
      reconstruction = {
        method: snapshot.metrics.reconstruction_method,
        test_file_ops_replayed: snapshot.metrics.test_file_ops_replayed,
        test_file_edit_failures: snapshot.metrics.test_file_edit_failures,
        qualifying_test_files: snapshot.metrics.qualifying_test_files,
      };
    } finally {
      snapshot.cleanup();
    }
  }

  return {
    run_id: runId,
    first_test_mutation_call: inferred.call_index,
    first_test_mutation_paths: inferred.paths,
    first_canonical_verify_call: trajectory.verification_runs.find((run) => run.canonical)?.call_index ?? null,
    first_pre_mutation_canonical_verify_call: preMutationVerify?.call_index ?? null,
    first_post_mutation_canonical_verify_call: firstPost?.call_index ?? null,
    first_post_mutation_canonical_verify_source: metrics.first_post_mutation_canonical_verify_source,
    authored_test_count_at_first_post_mutation_verify,
    test_loc_at_first_post_mutation_verify,
    authored_test_count_from_vitest_at_anchor: firstPost?.total ?? null,
    weighted_mutation_to_first_post_mutation_verify:
      metrics.weighted_mutation_to_first_post_mutation_verify,
    weighted_to_first_post_mutation_verify: metrics.weighted_to_first_post_mutation_verify,
    total_canonical_verify_count: metrics.total_canonical_verify_count,
    run_end_authored_test_count: runEndAuthored?.authored_test_count ?? null,
    run_end_journey_test_count: resultJourneys,
    anchor_is_pre_mutation:
      firstPost !== null &&
      inferred.call_index !== null &&
      firstPost.call_index < inferred.call_index,
    reconstruction,
  };
}

const reps = await Promise.all(V22_RUN_IDS.map(analyzeControlRun));

const authoredAtAnchor = reps
  .map((rep) => rep.authored_test_count_at_first_post_mutation_verify)
  .filter((value): value is number => value !== null);

const testLocAtAnchor = reps
  .map((rep) => rep.test_loc_at_first_post_mutation_verify)
  .filter((value): value is number => value !== null);

const vitestAtAnchor = reps
  .map((rep) => rep.authored_test_count_from_vitest_at_anchor)
  .filter((value): value is number => value !== null);

const weightedMutationToPost = reps
  .map((rep) => rep.weighted_mutation_to_first_post_mutation_verify)
  .filter((value): value is number => value !== null);

const callSpan = reps
  .map((rep) =>
    rep.first_post_mutation_canonical_verify_call !== null &&
    rep.first_test_mutation_call !== null
      ? rep.first_post_mutation_canonical_verify_call - rep.first_test_mutation_call
      : null,
  )
  .filter((value): value is number => value !== null);

console.log(
  JSON.stringify(
    {
      experiment: "q2-early-verify-v1-control-retro",
      baseline: "v2.2",
      source_metric_definition:
        "countAuthoredTestsInApp at first post-mutation canonical VERIFY — events replay through anchor call; brace-balanced it()/test() parse",
      reps,
      locked_control_medians_for_prereg: {
        authored_test_count_at_first_post_mutation_verify: authoredAtAnchor.length
          ? median(authoredAtAnchor)
          : null,
        test_loc_at_first_post_mutation_verify: testLocAtAnchor.length
          ? median(testLocAtAnchor)
          : null,
        weighted_mutation_to_first_post_mutation_verify: weightedMutationToPost.length
          ? median(weightedMutationToPost)
          : null,
        call_span_mutation_to_first_post_mutation_verify: callSpan.length ? median(callSpan) : null,
        vitest_total_at_first_post_mutation_verify_note:
          "Vitest-reported total at anchor — comparison context only, not used for Gate A",
        vitest_total_at_first_post_mutation_verify: vitestAtAnchor.length
          ? median(vitestAtAnchor)
          : null,
        runs_with_pre_mutation_canonical_verify: reps.filter(
          (rep) => rep.first_pre_mutation_canonical_verify_call !== null,
        ).length,
        runs_with_wrong_anchor: reps.filter((rep) => rep.anchor_is_pre_mutation).length,
        runs_with_reconstructed_source_metrics: reps.filter(
          (rep) => rep.authored_test_count_at_first_post_mutation_verify !== null,
        ).length,
      },
    },
    null,
    2,
  ),
);
