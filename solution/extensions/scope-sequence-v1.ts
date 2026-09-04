/**
 * SS1 — Scope & sequence v1
 *
 * When HARNESS_SCOPE_SEQUENCE_V1=1:
 * - On first successful content-changing write/edit to src/App.tsx, append frozen message
 *   to that tool result (exactly once per run).
 * - Export scope-sequence.v1.json per run.
 *
 * Explicitly out of scope: auto-VERIFY, blocking, caps, S1, AGENTS/system-prompt edits.
 */

import {
  isEditToolResult,
  isWriteToolResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  getScopeSequenceSessionState,
  resetScopeSequenceSession,
  resolveScopeSequenceRunIdFromEnvironment,
  resolveScopeSequenceDelivery,
  resolveScopeSequenceExportPath,
  scopeSequenceV1EnabledFromEnvironment,
  writeScopeSequenceExport,
} from "./scope-sequence-core.js";

export default function scopeSequenceV1(pi: ExtensionAPI) {
  if (!scopeSequenceV1EnabledFromEnvironment()) return;

  let toolResultIndex = 0;

  const persistExport = (): void => {
    const exportPath = resolveScopeSequenceExportPath();
    if (!exportPath) return;
    const exportRecord = getScopeSequenceSessionState()?.exportRecord;
    if (exportRecord) writeScopeSequenceExport(exportPath, exportRecord);
  };

  pi.on("session_start", async () => {
    toolResultIndex = 0;
    resetScopeSequenceSession(resolveScopeSequenceRunIdFromEnvironment());
    persistExport();
  });

  pi.on("tool_result", async (event) => {
    toolResultIndex += 1;

    let toolName = "";
    let relativePath = "";
    let editDiff: string | null = null;

    if (isWriteToolResult(event)) {
      toolName = "write";
      relativePath = String(event.input.path ?? "");
    } else if (isEditToolResult(event)) {
      toolName = "edit";
      relativePath = String(event.input.path ?? "");
      editDiff = event.details?.diff ?? null;
    } else {
      persistExport();
      return undefined;
    }

    const resolution = resolveScopeSequenceDelivery({
      toolName,
      path: relativePath,
      isError: event.isError,
      editDiff,
      toolResultIndex,
      content: event.content,
    });

    persistExport();

    if (!resolution.modifiedContent) {
      return undefined;
    }

    return { content: resolution.modifiedContent };
  });
}
