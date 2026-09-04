/**
 * Repair-surface lock v1
 *
 * When HARNESS_REPAIR_SURFACE_LOCK_V1=1:
 * - On first harness `verify` FAIL, freeze current src/test surface file set.
 * - Block `write` (and bash create) of new product/test files not in that set.
 * - Allow edit/write of frozen paths; allow report.partial.json.
 * - Unlock on VERIFY PASS.
 *
 * No prompt advice — mechanical block + factual VERIFY line only.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  appendLockBlockToVerifyText,
  engageRepairSurfaceLockOnVerifyFail,
  evaluateRepairSurfaceBashBlock,
  evaluateRepairSurfaceWriteBlock,
  isVerifyFailText,
  isVerifyPassText,
  releaseRepairSurfaceLockOnVerifyPass,
  repairSurfaceLockV1EnabledFromEnvironment,
  resetRepairSurfaceLockState,
} from "./repair-surface-lock-core.js";

function extractToolText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .filter((c: { type?: string; text?: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("\n");
  }
  return String(content ?? "");
}

export default function repairSurfaceLockV1(pi: ExtensionAPI) {
  if (!repairSurfaceLockV1EnabledFromEnvironment()) return;

  pi.on("session_start", async () => {
    resetRepairSurfaceLockState();
  });

  pi.on("tool_call", async (event) => {
    if (event.toolName === "write") {
      const p = String((event.input as Record<string, unknown>).path ?? "");
      return evaluateRepairSurfaceWriteBlock(p, "write");
    }
    if (event.toolName === "bash") {
      const command = String((event.input as Record<string, unknown>).command ?? "");
      return evaluateRepairSurfaceBashBlock(command);
    }
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "verify") return undefined;

    const text = extractToolText(event.content);
    if (isVerifyFailText(text)) {
      const block = engageRepairSurfaceLockOnVerifyFail(ctx.cwd, text);
      if (!block) return undefined;
      const next = appendLockBlockToVerifyText(text, block);
      return {
        content: [{ type: "text", text: next }],
        details: {
          ...(typeof event.details === "object" && event.details !== null
            ? (event.details as Record<string, unknown>)
            : {}),
          repair_surface_lock: true,
        },
      };
    }

    if (isVerifyPassText(text)) {
      releaseRepairSurfaceLockOnVerifyPass(text);
    }
    return undefined;
  });
}
