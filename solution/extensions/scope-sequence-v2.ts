/**
 * SS2 — Scope & sequence v2
 *
 * When HARNESS_SCOPE_SEQUENCE_V2=1:
 * - On first write/edit tool_call to src/App.tsx, steer the frozen SS1 message
 *   before the tool executes (exactly once per run).
 * - Export scope-sequence.v2.json per run.
 *
 * Explicitly out of scope: auto-VERIFY, blocking, caps, S1, SS1, AGENTS/system-prompt edits.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  SS1_MESSAGE_FROZEN,
  SS2_ANCHOR_ID,
  getScopeSequenceV2SessionState,
  resetScopeSequenceV2Session,
  resolveScopeSequenceRunIdFromEnvironment,
  resolveScopeSequenceV2Delivery,
  resolveScopeSequenceV2ExportPath,
  scopeSequenceV2EnabledFromEnvironment,
  writeScopeSequenceV2Export,
} from "./scope-sequence-core.js";

export default function scopeSequenceV2(pi: ExtensionAPI) {
  if (!scopeSequenceV2EnabledFromEnvironment()) return;

  let toolCallIndex = 0;

  const persistExport = (): void => {
    const exportPath = resolveScopeSequenceV2ExportPath();
    if (!exportPath) return;
    const exportRecord = getScopeSequenceV2SessionState()?.exportRecord;
    if (exportRecord) writeScopeSequenceV2Export(exportPath, exportRecord);
  };

  pi.on("session_start", async () => {
    toolCallIndex = 0;
    resetScopeSequenceV2Session(resolveScopeSequenceRunIdFromEnvironment());
    persistExport();
  });

  pi.on("tool_call", async (event) => {
    toolCallIndex += 1;

    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    const relativePath = String((event.input as Record<string, unknown>).path ?? "");
    const resolution = resolveScopeSequenceV2Delivery({
      toolName: event.toolName,
      path: relativePath,
      toolCallIndex,
    });

    persistExport();

    if (!resolution.shouldDeliverSteer) {
      return undefined;
    }

    pi.sendMessage(
      {
        customType: "harness_scope_sequence_v2",
        content: [{ type: "text", text: SS1_MESSAGE_FROZEN }],
        display: true,
        details: {
          anchor: SS2_ANCHOR_ID,
          path: relativePath,
          tool_call_index: toolCallIndex,
        },
      },
      { deliverAs: "steer" },
    );

    return undefined;
  });
}
