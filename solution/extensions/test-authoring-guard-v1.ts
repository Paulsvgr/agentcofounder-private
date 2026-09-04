/**
 * Q2-C — Test authoring guard v1
 *
 * When HARNESS_TEST_AUTHORING_GUARD_V1=1 (requires harness-owned VERIFY):
 * - Blocks canonical `verify` until F1–F5 RTL patterns are cleared (F6 report-only).
 * - Returns compact bounded BLOCK feedback (≤512 chars).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  evaluateTestAuthoringGuardBlock,
  testAuthoringGuardV1EnabledFromEnvironment,
} from "./test-authoring-guard.js";

function harnessOwnedVerifyEnabled(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export default function testAuthoringGuardV1(pi: ExtensionAPI) {
  if (!testAuthoringGuardV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabled()) return;

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "verify") return undefined;
    return evaluateTestAuthoringGuardBlock(process.cwd());
  });
}
