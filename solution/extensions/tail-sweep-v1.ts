/**
 * Tail sweep v1 — harness-owned final checks after report.partial.json
 *
 * When HARNESS_TAIL_SWEEP_V1=1 (requires harness-owned VERIFY):
 * - After Pi writes report.partial.json, run test + build + localhost:3000 probe in one harness sweep.
 * - Steer Pi to stop immediately (no post-report build or closing summary).
 * - Export tail-sweep.v1.json per run.
 */

import {
  isEditToolResult,
  isWriteToolResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  createEmptyTailSweepExport,
  harnessOwnedVerifyEnabledFromEnvironment,
  isBuildCommand,
  isDevServerCommand,
  isReportPartialPath,
  resolveTailSweepArtifactDirectory,
  resolveTailSweepExportPath,
  resolveTailSweepRunIdFromEnvironment,
  runTailSweep,
  tailSweepV1EnabledFromEnvironment,
  TAIL_SWEEP_V1_POLICY_PROMPT,
  writeTailSweepExport,
  type TailSweepExport,
} from "./tail-sweep-core.js";

export default function tailSweepV1(pi: ExtensionAPI) {
  if (!tailSweepV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabledFromEnvironment()) return;

  let toolResultIndex = 0;
  let reportPartialWritten = false;
  let tailSweepFired = false;
  let exportRecord: TailSweepExport = createEmptyTailSweepExport();

  const persistExport = (): void => {
    const exportPath = resolveTailSweepExportPath();
    if (!exportPath) return;
    writeTailSweepExport(exportPath, exportRecord);
  };

  pi.on("session_start", async () => {
    toolResultIndex = 0;
    reportPartialWritten = false;
    tailSweepFired = false;
    exportRecord = createEmptyTailSweepExport(resolveTailSweepRunIdFromEnvironment());
    persistExport();
  });

  pi.on("before_agent_start", async () => ({
    systemPrompt: TAIL_SWEEP_V1_POLICY_PROMPT,
  }));

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return undefined;
    if (!reportPartialWritten && !tailSweepFired) return undefined;

    const command = String((event.input as Record<string, unknown>).command ?? "");
    if (isBuildCommand(command)) {
      return {
        block: true,
        reason:
          "Post-report build is blocked when harness tail sweep is active. Final build already ran (or will run) in the harness sweep.",
      };
    }
    if (isDevServerCommand(command)) {
      return {
        block: true,
        reason:
          "Post-report dev server start is blocked when harness tail sweep is active. Final localhost:3000 probe already ran (or will run) in the harness sweep.",
      };
    }
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    toolResultIndex += 1;

    if (tailSweepFired) {
      persistExport();
      return undefined;
    }

    let relativePath = "";
    if (isWriteToolResult(event)) {
      relativePath = String(event.input.path ?? "");
    } else if (isEditToolResult(event)) {
      relativePath = String(event.input.path ?? "");
    } else {
      persistExport();
      return undefined;
    }

    if (event.isError || !isReportPartialPath(relativePath)) {
      persistExport();
      return undefined;
    }

    reportPartialWritten = true;
    tailSweepFired = true;
    exportRecord.fired = true;
    exportRecord.trigger = "report.partial.json write";
    exportRecord.tool_result_index = toolResultIndex;

    const artifactDirectory = resolveTailSweepArtifactDirectory();
    if (!artifactDirectory) {
      exportRecord.error = "CHALLENGE_RUN_ARTIFACT_DIR was not set";
      exportRecord.passed = false;
      persistExport();
      return undefined;
    }

    const sweep = await runTailSweep(ctx.cwd, artifactDirectory);
    exportRecord.passed = sweep.passed;
    exportRecord.checks = sweep.checks;
    exportRecord.compact_text = sweep.compactText;
    exportRecord.error = sweep.error;
    persistExport();

    pi.sendMessage(
      {
        customType: "harness_tail_sweep_v1",
        content: [{ type: "text", text: sweep.compactText }],
        display: true,
        details: {
          passed: sweep.passed,
          checks: sweep.checks,
        },
      },
      { deliverAs: "steer" },
    );

    return undefined;
  });
}
