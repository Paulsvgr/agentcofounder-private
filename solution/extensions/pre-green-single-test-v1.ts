/**
 * Pre-green single-test budget v1
 *
 * When HARNESS_PRE_GREEN_SINGLE_TEST_V1=1:
 * - Until VERIFY PASS, at most one agent test file under src/ may be created.
 * - First test write (or sole existing file) becomes the allowed path.
 * - Edits to that path are free; new test paths are blocked (write + bash).
 * - Unlock on VERIFY PASS.
 *
 * No prompt advice — mechanical block only.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  engagePreGreenSingleTestOnSessionStart,
  evaluatePreGreenSingleTestBashBlock,
  evaluatePreGreenSingleTestWriteBlock,
  preGreenSingleTestV1EnabledFromEnvironment,
  releasePreGreenSingleTestOnVerifyPass,
  resetPreGreenSingleTestState,
} from "./pre-green-single-test-core.js";
import { isVerifyPassText } from "./repair-surface-lock-core.js";

function extractToolText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .filter((c: { type?: string; text?: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("\n");
  }
  return String(content ?? "");
}

export default function preGreenSingleTestV1(pi: ExtensionAPI) {
  if (!preGreenSingleTestV1EnabledFromEnvironment()) return;

  pi.on("session_start", async (_event, ctx) => {
    resetPreGreenSingleTestState();
    engagePreGreenSingleTestOnSessionStart(ctx.cwd);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "write") {
      const p = String((event.input as Record<string, unknown>).path ?? "");
      return evaluatePreGreenSingleTestWriteBlock(p, "write", ctx.cwd);
    }
    if (event.toolName === "bash") {
      const command = String((event.input as Record<string, unknown>).command ?? "");
      return evaluatePreGreenSingleTestBashBlock(command, ctx.cwd);
    }
    return undefined;
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "verify") return undefined;
    const text = extractToolText(event.content);
    if (isVerifyPassText(text)) {
      releasePreGreenSingleTestOnVerifyPass(text);
    }
    return undefined;
  });
}
