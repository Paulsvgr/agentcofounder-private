/**
 * SS2b — Scope & sequence v2b
 *
 * When HARNESS_SCOPE_SEQUENCE_V2B=1:
 * - On first write/edit tool_call to qualifying src product-code (.ts/.tsx), steer the
 *   frozen SS1 message before the tool executes (exactly once per run).
 * - Export scope-sequence.v2b.json per run.
 *
 * Explicitly out of scope: auto-VERIFY, blocking, caps, S1, SS1, SS2, AGENTS/system-prompt edits.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  SS1_MESSAGE_FROZEN,
  SS2B_ANCHOR_ID,
  getScopeSequenceV2bSessionState,
  normalizeRelativePath,
  resetScopeSequenceV2bSession,
  resolveScopeSequenceRunIdFromEnvironment,
  resolveScopeSequenceV2bDelivery,
  resolveScopeSequenceV2bExportPath,
  scopeSequenceV2bEnabledFromEnvironment,
  writeScopeSequenceV2bExport,
} from "./scope-sequence-core.js";

export default function scopeSequenceV2b(pi: ExtensionAPI) {
  if (!scopeSequenceV2bEnabledFromEnvironment()) return;

  let toolCallIndex = 0;

  const persistExport = (): void => {
    const exportPath = resolveScopeSequenceV2bExportPath();
    if (!exportPath) return;
    const exportRecord = getScopeSequenceV2bSessionState()?.exportRecord;
    if (exportRecord) writeScopeSequenceV2bExport(exportPath, exportRecord);
  };

  pi.on("session_start", async () => {
    toolCallIndex = 0;
    resetScopeSequenceV2bSession(resolveScopeSequenceRunIdFromEnvironment());
    persistExport();
  });

  pi.on("tool_call", async (event) => {
    toolCallIndex += 1;

    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    const relativePath = String((event.input as Record<string, unknown>).path ?? "");
    const resolution = resolveScopeSequenceV2bDelivery({
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
        customType: "harness_scope_sequence_v2b",
        content: [{ type: "text", text: SS1_MESSAGE_FROZEN }],
        display: true,
        details: {
          anchor: SS2B_ANCHOR_ID,
          path: normalizeRelativePath(relativePath),
          tool_call_index: toolCallIndex,
        },
      },
      { deliverAs: "steer" },
    );

    return undefined;
  });
}
