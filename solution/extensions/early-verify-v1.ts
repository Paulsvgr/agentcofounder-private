/**
 * Q2-D — Early VERIFY v1
 *
 * When HARNESS_EARLY_VERIFY_V1=1 (requires harness-owned VERIFY):
 * - After each completed Pi tool, detect first filesystem mutation to qualifying src test files.
 * - Run exactly one automatic canonical VERIFY tagged verify_source: auto_early_v1.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  countAuthoredTestsInApp,
  createEmptyEarlyVerifyExport,
  detectFilesystemTestMutation,
  earlyVerifyV1EnabledFromEnvironment,
  resolveEarlyVerifyExportPath,
  runAutoEarlyCanonicalVerify,
  snapshotQualifyingTestFileHashes,
  writeEarlyVerifyExport,
  type EarlyVerifyExport,
  type TestFileHashSnapshot,
} from "./early-verify-core.js";

function harnessOwnedVerifyEnabled(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export default function earlyVerifyV1(pi: ExtensionAPI) {
  if (!earlyVerifyV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabled()) return;

  let baselineSnapshot: TestFileHashSnapshot = {};
  let previousSnapshot: TestFileHashSnapshot | null = null;
  let firstMutationRecorded = false;
  let autoEarlyVerifyFired = false;
  let toolResultIndex = 0;
  let exportRecord = createEmptyEarlyVerifyExport();

  const persistExport = (): void => {
    const exportPath = resolveEarlyVerifyExportPath();
    if (!exportPath) return;
    writeEarlyVerifyExport(exportPath, exportRecord);
  };

  pi.on("session_start", async (_event, ctx) => {
    baselineSnapshot = snapshotQualifyingTestFileHashes(ctx.cwd);
    previousSnapshot = null;
    firstMutationRecorded = false;
    autoEarlyVerifyFired = false;
    toolResultIndex = 0;
    exportRecord = createEmptyEarlyVerifyExport();
    persistExport();
  });

  pi.on("tool_result", async (_event, ctx) => {
    toolResultIndex += 1;
    let currentSnapshot: TestFileHashSnapshot;
    try {
      currentSnapshot = snapshotQualifyingTestFileHashes(ctx.cwd);
    } catch {
      exportRecord.early_verify_error = true;
      persistExport();
      previousSnapshot = previousSnapshot ?? {};
      return;
    }

    const detection = detectFilesystemTestMutation({
      baseline: baselineSnapshot,
      previous: previousSnapshot,
      current: currentSnapshot,
      firstMutationAlreadyRecorded: firstMutationRecorded,
    });

    if (detection.isFirstMutation) {
      firstMutationRecorded = true;
      exportRecord.first_test_mutation_tool_result_index = toolResultIndex;
      exportRecord.first_test_mutation_paths = detection.mutatedPaths;

      if (!autoEarlyVerifyFired) {
        autoEarlyVerifyFired = true;
        exportRecord.auto_early_verify_fired = true;

        const metrics = countAuthoredTestsInApp(ctx.cwd);
        try {
          const verify = runAutoEarlyCanonicalVerify(ctx.cwd);
          exportRecord.auto_early_verify = {
            verify_source: "auto_early_v1",
            tool_result_index: toolResultIndex,
            mutated_paths: detection.mutatedPaths,
            authored_test_count_at_mutation: metrics.authored_test_count,
            test_loc_at_mutation: metrics.test_loc,
            exit_code: verify.exitCode,
            output: verify.formatted,
            error: null,
          };

          pi.sendMessage(
            {
              customType: "harness_auto_early_verify",
              content: [{ type: "text", text: verify.formatted }],
              display: true,
              details: {
                verify_source: "auto_early_v1",
                exit_code: verify.exitCode,
                mutated_paths: detection.mutatedPaths,
              },
            },
            { deliverAs: "steer" },
          );
        } catch (error) {
          exportRecord.early_verify_error = true;
          exportRecord.auto_early_verify = {
            verify_source: "auto_early_v1",
            tool_result_index: toolResultIndex,
            mutated_paths: detection.mutatedPaths,
            authored_test_count_at_mutation: metrics.authored_test_count,
            test_loc_at_mutation: metrics.test_loc,
            exit_code: 1,
            output: "",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    previousSnapshot = currentSnapshot;
    persistExport();
  });
}
