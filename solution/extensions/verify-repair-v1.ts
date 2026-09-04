/**
 * Q2-B — VERIFY repair orchestration v1
 *
 * When HARNESS_VERIFY_REPAIR_V1=1 (requires harness-owned VERIFY):
 * - Adds repair-first-test policy to the system prompt.
 * - Blocks partial vitest bash escapes with repair-specific reasons.
 * - Structured VERIFY FAIL output is applied by harness-owned-verify via shared formatter.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  evaluateVerifyRepairV1BashBlock,
  VERIFY_REPAIR_V1_POLICY_PROMPT,
} from "./verify-command-policy.js";
import { verifyRepairV1EnabledFromEnvironment } from "./verify-failure-format.js";

function harnessOwnedVerifyEnabled(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export default function verifyRepairV1(pi: ExtensionAPI) {
  if (!verifyRepairV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabled()) return;

  pi.on("before_agent_start", async () => ({
    systemPrompt: VERIFY_REPAIR_V1_POLICY_PROMPT,
  }));

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return undefined;
    const command = String((event.input as Record<string, unknown>).command ?? "");
    return evaluateVerifyRepairV1BashBlock(command);
  });
}
