/**
 * Q2-E — Harness-owned test structure v1
 *
 * When HARNESS_OWNED_TEST_STRUCTURE_V1=1 (requires harness-owned VERIFY):
 * - Seed exactly one src/App.test.tsx shell with 0 authored tests at session start.
 * - After each completed Pi tool, enforce +0/+1 authored-test growth on qualifying files only.
 * - On violation, restore qualifying test-file state and inject compact feedback.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  authoredTestCountInSnapshot,
  createEmptyTestStructureExport,
  evaluatePostToolTestStructure,
  formatTestStructureRejectionFeedback,
  readQualifyingTestSnapshot,
  restoreQualifyingTestSnapshot,
  resolveTestStructureExportPath,
  seedHarnessOwnedTestShell,
  testStructureV1EnabledFromEnvironment,
  writeTestStructureExport,
  type TestFileSnapshot,
  type TestStructureExport,
} from "./test-structure-core.js";

function harnessOwnedVerifyEnabled(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export default function harnessOwnedTestStructureV1(pi: ExtensionAPI) {
  if (!testStructureV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabled()) return;

  let lastAcceptedSnapshot: TestFileSnapshot = {};
  let toolResultIndex = 0;
  let exportRecord = createEmptyTestStructureExport(0);

  const persistExport = (): void => {
    const exportPath = resolveTestStructureExportPath();
    if (!exportPath) return;
    writeTestStructureExport(exportPath, exportRecord);
  };

  pi.on("session_start", async (_event, ctx) => {
    toolResultIndex = 0;
    try {
      lastAcceptedSnapshot = seedHarnessOwnedTestShell(ctx.cwd);
      const skeletonCount = authoredTestCountInSnapshot(lastAcceptedSnapshot);
      exportRecord = createEmptyTestStructureExport(skeletonCount);
      exportRecord.skeleton_authored_count_at_start = skeletonCount;
    } catch {
      exportRecord = createEmptyTestStructureExport(0);
      exportRecord.test_structure_error = true;
      lastAcceptedSnapshot = {};
    }
    persistExport();
  });

  pi.on("tool_result", async (_event, ctx) => {
    toolResultIndex += 1;
    let currentSnapshot: TestFileSnapshot;
    try {
      currentSnapshot = readQualifyingTestSnapshot(ctx.cwd);
    } catch {
      exportRecord.test_structure_error = true;
      persistExport();
      return;
    }

    const evaluation = evaluatePostToolTestStructure({
      lastAcceptedSnapshot,
      currentSnapshot,
    });

    if (!evaluation.accepted) {
      let restoredPaths: string[] = [];
      try {
        restoredPaths = restoreQualifyingTestSnapshot(ctx.cwd, lastAcceptedSnapshot);
      } catch {
        exportRecord.test_structure_error = true;
        persistExport();
        return;
      }

      exportRecord.increment_guard_rejections += 1;
      const reason = evaluation.violation.reason;
      exportRecord.increment_guard_rejection_reasons[reason] =
        (exportRecord.increment_guard_rejection_reasons[reason] ?? 0) + 1;
      exportRecord.rejections.push({
        tool_result_index: toolResultIndex,
        violation: reason,
        accepted_count: evaluation.violation.accepted_count,
        observed_count: evaluation.violation.observed_count,
        restored_paths: restoredPaths,
      });

      const feedback = formatTestStructureRejectionFeedback(evaluation.violation);
      pi.sendMessage(
        {
          customType: "harness_test_structure_v1_rejected",
          content: [{ type: "text", text: feedback }],
          display: true,
          details: {
            violation: reason,
            accepted_count: evaluation.violation.accepted_count,
            observed_count: evaluation.violation.observed_count,
            restored_paths: restoredPaths,
          },
        },
        { deliverAs: "steer" },
      );
      persistExport();
      return;
    }

    lastAcceptedSnapshot = currentSnapshot;
    if (evaluation.authored_delta > exportRecord.max_accepted_single_step_delta) {
      exportRecord.max_accepted_single_step_delta = evaluation.authored_delta;
    }
    if (
      evaluation.authored_delta === 1 &&
      exportRecord.first_successful_authored_test_addition_tool_result_index === null
    ) {
      exportRecord.first_successful_authored_test_addition_tool_result_index = toolResultIndex;
    }
    persistExport();
  });
}
