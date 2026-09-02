/**
 * S1 — Convergence intervention v1
 *
 * When HARNESS_CONVERGENCE_INTERVENTION_V1=1 (requires harness-owned VERIFY):
 * - Track debug sidecar signals between canonical VERIFY calls.
 * - Classify convergence vs previous VERIFY; append Tier 1/2 to verify result text only.
 * - Export convergence-intervention.v1.json per run.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  convergenceInterventionV1EnabledFromEnvironment,
  getConvergenceSessionState,
  markDebugSidecarFromToolCall,
  resetConvergenceSession,
  resolveConvergenceExportPath,
  writeConvergenceExport,
} from "./convergence-intervention-core.js";

function harnessOwnedVerifyEnabled(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export default function convergenceInterventionV1(pi: ExtensionAPI) {
  if (!convergenceInterventionV1EnabledFromEnvironment()) return;
  if (!harnessOwnedVerifyEnabled()) return;

  const persistExport = (): void => {
    const exportPath = resolveConvergenceExportPath();
    if (!exportPath) return;
    const exportRecord = getConvergenceSessionState()?.exportRecord;
    if (exportRecord) writeConvergenceExport(exportPath, exportRecord);
  };

  pi.on("session_start", async () => {
    resetConvergenceSession();
    persistExport();
  });

  pi.on("tool_call", async (event) => {
    markDebugSidecarFromToolCall(
      event.toolName,
      event.input as Record<string, unknown>,
    );
    return undefined;
  });
}
