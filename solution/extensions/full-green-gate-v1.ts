/**
 * Full-green gate v1
 *
 * When HARNESS_FULL_GREEN_GATE_V1=1:
 * - VERIFY PASS triggers harness canonical BUILD (in harness-owned-verify).
 * - BUILD PASS → FULL_GREEN: harness writes report; verify tool returns terminate:true.
 * - This extension blocks any subsequent tool calls with terminate (belt).
 * - Does NOT steer Pi (steering would trigger another model turn).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  fullGreenBlockedToolReason,
  fullGreenGateV1EnabledFromEnvironment,
  isFullGreenAchieved,
  resetFullGreenGateState,
} from "./full-green-gate-core.js";

export default function fullGreenGateV1(pi: ExtensionAPI) {
  if (!fullGreenGateV1EnabledFromEnvironment()) return;

  pi.on("session_start", async () => {
    resetFullGreenGateState();
  });

  pi.on("tool_call", async (event) => {
    if (!isFullGreenAchieved()) return undefined;
    return {
      block: true,
      reason: fullGreenBlockedToolReason(event.toolName),
      terminate: true,
    };
  });
}
