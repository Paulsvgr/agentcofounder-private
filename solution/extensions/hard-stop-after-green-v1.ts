/**
 * Hard-stop-after-green v1
 *
 * When HARNESS_HARD_STOP_AFTER_GREEN_V1=1:
 * - After first harness `verify` PASS, block further edit/bash/verify/etc.
 * - Allow write/edit of report.partial.json only.
 * - Steer Pi to write report and finish.
 */

import {
  isEditToolResult,
  isWriteToolResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  HARD_STOP_STEER_TEXT,
  hardStopAfterGreenV1EnabledFromEnvironment,
  hardStopBlockedToolReason,
  isReportPartialPath,
  isVerifyPassText,
} from "./hard-stop-after-green-core.js";

const ALLOWED_AFTER_GREEN = new Set(["write", "edit"]);

export default function hardStopAfterGreenV1(pi: ExtensionAPI) {
  if (!hardStopAfterGreenV1EnabledFromEnvironment()) return;

  let greenAchieved = false;
  let steered = false;
  let reportWritten = false;

  pi.on("session_start", async () => {
    greenAchieved = false;
    steered = false;
    reportWritten = false;
  });

  pi.on("tool_call", async (event) => {
    if (!greenAchieved) return undefined;

    const toolName = event.toolName;
    if (ALLOWED_AFTER_GREEN.has(toolName)) {
      const input = (event.input ?? {}) as Record<string, unknown>;
      const p = String(input.path ?? "");
      if (isReportPartialPath(p)) return undefined;
    }

    return {
      block: true,
      reason: hardStopBlockedToolReason(toolName),
    };
  });

  pi.on("tool_result", async (event) => {
    if (isWriteToolResult(event) || isEditToolResult(event)) {
      const p = String(event.input.path ?? "");
      if (!event.isError && isReportPartialPath(p)) {
        reportWritten = true;
      }
    }

    if (greenAchieved) return undefined;
    if (event.toolName !== "verify") return undefined;

    const text = Array.isArray(event.content)
      ? event.content
          .filter((c: { type?: string; text?: string }) => c.type === "text")
          .map((c: { text?: string }) => c.text ?? "")
          .join("\n")
      : String(event.content ?? "");

    if (!isVerifyPassText(text)) return undefined;

    greenAchieved = true;
    if (!steered) {
      steered = true;
      pi.sendMessage(
        {
          customType: "harness_hard_stop_after_green_v1",
          content: [{ type: "text", text: HARD_STOP_STEER_TEXT }],
          display: true,
          details: { green: true, report_written: reportWritten },
        },
        { deliverAs: "steer" },
      );
    }
    return undefined;
  });
}
