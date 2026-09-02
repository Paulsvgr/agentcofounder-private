/**
 * S1 — Convergence intervention v1 — pure core (classifier, signatures, export).
 */

import { basename } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const CONVERGENCE_INTERVENTION_EXPORT_FILENAME = "convergence-intervention.v1.json";

export const TIER1_MESSAGE =
  "[harness] Repair the current failure directly. Keep test scope unchanged; do not add diagnostic test files. Make the smallest fix, then run canonical VERIFY.";

export const TIER2_MESSAGE =
  "[harness] Repair is not converging and debugging surface has expanded. Remove temporary debug tests, return to the existing test suite, make the smallest direct fix, then run canonical VERIFY.";

export type ConvergenceState = "converging" | "stalled" | "regressing" | "unknown";

export interface NormalizedSignatureRecord {
  family: string;
  signature: string;
  file: string;
  test_name: string;
  message: string;
}

export interface ConvergenceTransitionRecord {
  ordinal: number;
  state: ConvergenceState;
  counts_known: boolean;
  failed_before: number | null;
  failed_after: number | null;
  signatures_before: string[];
  signatures_after: string[];
  intervention_tier: 0 | 1 | 2;
  delivery: "appended_to_verify_result" | "none";
  debug_sidecar_detected: boolean;
  signature_fallback: boolean;
}

export interface ConvergenceInterventionExport {
  schema: "agentcofounder.convergence_intervention.v1";
  run_id: string;
  transitions: ConvergenceTransitionRecord[];
  false_positive_converging_interventions: number;
  tier1_count: number;
  tier2_count: number;
}

export function convergenceInterventionV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  return raw === "1" || raw === "true";
}

function normWs(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function parseStructuredBlock(block: string): {
  file: string;
  test_name: string;
  err_type: string;
  message: string;
} | null {
  const fileMatch = block.match(/FAIL\s+(\S+\.(?:tsx?|jsx?))/);
  const testMatch = block.match(/TEST\s+(.+?)(?:\n|TYPE)/s);
  const typeMatch = block.match(/TYPE\s+(\S+)/);
  const atMatch = block.match(/AT\s+(\S+)/);
  const messageMatch = block.match(/MESSAGE\s*\n(.+?)(?:\n\n|\n\[|\Z)/s);

  const filePath = fileMatch?.[1] ?? atMatch?.[1] ?? "";
  const testName = testMatch?.[1] ? normWs(testMatch[1]) : "";
  const errType = typeMatch?.[1] ?? "";
  const message = messageMatch?.[1] ? normWs(messageMatch[1]) : normWs(block);

  if (!filePath && !testName && !message) return null;

  return {
    file: filePath ? basename(filePath) : "",
    test_name: testName.slice(0, 80),
    err_type: errType,
    message,
  };
}

export function normalizeSignatures(text: string): NormalizedSignatureRecord[] {
  const records: NormalizedSignatureRecord[] = [];
  if (!text || (!text.includes("FAIL") && !text.includes("Error"))) {
    return records;
  }

  const blocks = text.split(/\[\d+\/\d+\]/);
  const chunks =
    blocks.length > 1
      ? blocks.slice(1)
      : text.includes("FAIL") || text.includes("Error")
        ? [text]
        : [];

  for (const block of chunks) {
    const parsed = parseStructuredBlock(block);
    if (!parsed) continue;

    const msg = parsed.message;
    let family = "unknown";
    let signature = msg;

    if (/Failed to resolve import/i.test(msg)) {
      family = "import_resolve";
      const importMatch = msg.match(/Failed to resolve import "([^"]+)"/);
      signature = `import_resolve|${importMatch?.[1] ?? msg.slice(0, 60)}`;
    } else if (msg.includes("expect is not defined")) {
      family = "missing_global_setup";
      signature = `missing_global_setup|${parsed.file}|expect is not defined`;
    } else if (/SyntaxError|Transform failed/i.test(msg)) {
      family = "syntax_transform";
      signature = `syntax_transform|${parsed.file}|${msg.slice(0, 80)}`;
    } else if (/multiple elements|Found multiple/i.test(msg)) {
      family = "rtl_duplicate_element";
      const duplicateMatch = msg.match(/name: "([^"]+)"|getByRole\([^)]+\)/);
      signature = `rtl_duplicate|${duplicateMatch?.[1] ?? msg.slice(0, 70)}`;
    } else if (msg.includes("Unable to find") || msg.includes("TestingLibraryElementError")) {
      family = "rtl_selector";
      const selectorMatch = msg.match(
        /role="([^"]+)"[^"]*name="([^"]+)"|getByRole\(["']([^"']+)["'](?:,\s*\{[^}]*name:\s*["']([^"']+)["'])?|text:?\s*([^.\n]+)|getByText\(["']([^"']+)["']|getByLabelText\(["']([^"']+)["']|getByTestId\(["']([^"']+)["']/i,
      );
      if (selectorMatch) {
        const parts = selectorMatch.slice(1).filter((part): part is string => Boolean(part));
        signature = `rtl_selector|${parts.slice(0, 3).join("|")}`;
      } else {
        const snippet = normWs(msg.replace(/TestingLibraryElementError:\s*/i, "")).slice(0, 90);
        signature = `rtl_selector|${snippet}`;
      }
    } else if (msg.includes("Expected") || msg.includes("Received") || msg.includes("AssertionError")) {
      family = "assertion";
      signature = `assertion|${parsed.file}|${msg.slice(0, 90)}`;
    } else if (parsed.err_type) {
      family = parsed.err_type.toLowerCase();
      signature = `${family}|${parsed.file}|${msg.slice(0, 90)}`;
    } else {
      family = "unparsed";
      signature = `unparsed|${parsed.file}|${msg.slice(0, 90)}`;
    }

    records.push({
      family,
      signature,
      file: parsed.file,
      test_name: parsed.test_name,
      message: msg.slice(0, 160),
    });
  }

  if (records.length === 0 && text) {
    if (text.includes("Failed to resolve import")) {
      const importMatch = text.match(/Failed to resolve import "([^"]+)"/);
      records.push({
        family: "import_resolve",
        signature: `import_resolve|${importMatch?.[1] ?? "unknown"}`,
        file: "",
        test_name: "",
        message: normWs(text).slice(0, 160),
      });
    } else if (text.includes("Unable to find") || text.includes("TestingLibraryElementError")) {
      const snippet = normWs(text).slice(0, 100);
      records.push({
        family: "rtl_selector",
        signature: `rtl_selector|${snippet}`,
        file: "",
        test_name: "",
        message: snippet,
      });
    } else if (text.includes("expect is not defined")) {
      records.push({
        family: "missing_global_setup",
        signature: "missing_global_setup|expect is not defined",
        file: "",
        test_name: "",
        message: "expect is not defined",
      });
    }
  }

  return records;
}

export function parseFailedCount(text: string): number | null {
  const match = text.match(/FAIL\s*(\d+)\/(\d+)\s*tests\s*·\s*(\d+)\s*failed/i);
  if (!match) return null;
  return Number(match[3]);
}

export function classifyConvergenceState(input: {
  failedBefore: number | null;
  failedAfter: number | null;
  isFirstVerify: boolean;
  isPass: boolean;
}): ConvergenceState {
  if (input.isFirstVerify || input.isPass) return "converging";
  if (input.failedBefore === null || input.failedAfter === null) return "unknown";
  if (input.failedAfter < input.failedBefore) return "converging";
  if (input.failedAfter === input.failedBefore) return "stalled";
  return "regressing";
}

export function hasExactSignatureRepeat(signaturesBefore: string[], signaturesAfter: string[]): boolean {
  if (signaturesBefore.length === 0 || signaturesAfter.length === 0) return false;
  const before = new Set(signaturesBefore);
  return signaturesAfter.some((signature) => before.has(signature));
}

export function decideInterventionTier(input: {
  state: ConvergenceState;
  signaturesBefore: string[];
  signaturesAfter: string[];
  debugSidecarSinceLastVerify: boolean;
}): { tier: 0 | 1 | 2; signatureFallback: boolean } {
  if (input.state === "converging") {
    return { tier: 0, signatureFallback: false };
  }

  let tier: 0 | 1 | 2 = 0;
  let signatureFallback = false;

  if (input.state === "stalled" || input.state === "regressing") {
    tier = 1;
  } else if (
    input.state === "unknown" &&
    hasExactSignatureRepeat(input.signaturesBefore, input.signaturesAfter)
  ) {
    tier = 1;
    signatureFallback = true;
  }

  if (
    tier === 1 &&
    input.debugSidecarSinceLastVerify &&
    (input.state === "stalled" || input.state === "regressing")
  ) {
    tier = 2;
  }

  return { tier, signatureFallback };
}

export function appendInterventionTier(formattedVerifyText: string, tier: 0 | 1 | 2): string {
  if (tier === 0) return formattedVerifyText;
  const message = tier === 2 ? TIER2_MESSAGE : TIER1_MESSAGE;
  return `${formattedVerifyText}\n\n${message}`;
}

export function isDebugSidecarWritePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return /debug\.test\./i.test(normalized);
}

export function isDebugSidecarBashCommand(command: string): boolean {
  if (/debug\.test/i.test(command)) return true;
  return /\/tmp\//.test(command) && /\.test\./i.test(command);
}

export function createEmptyConvergenceExport(runId = ""): ConvergenceInterventionExport {
  return {
    schema: "agentcofounder.convergence_intervention.v1",
    run_id: runId,
    transitions: [],
    false_positive_converging_interventions: 0,
    tier1_count: 0,
    tier2_count: 0,
  };
}

export function resolveConvergenceExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, CONVERGENCE_INTERVENTION_EXPORT_FILENAME);
}

export function writeConvergenceExport(exportPath: string, record: ConvergenceInterventionExport): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export interface ConvergenceSessionState {
  ordinal: number;
  previousFailedCount: number | null;
  previousSignatures: string[];
  debugSidecarSinceLastVerify: boolean;
  exportRecord: ConvergenceInterventionExport;
}

let activeSession: ConvergenceSessionState | null = null;

function resolveRunIdFromArtifactDir(): string {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return "";
  return basename(artifactDir);
}

export function resetConvergenceSession(): void {
  activeSession = {
    ordinal: 0,
    previousFailedCount: null,
    previousSignatures: [],
    debugSidecarSinceLastVerify: false,
    exportRecord: createEmptyConvergenceExport(resolveRunIdFromArtifactDir()),
  };
}

export function getConvergenceSessionState(): ConvergenceSessionState | null {
  return activeSession;
}

export function markDebugSidecarFromToolCall(toolName: string, input: Record<string, unknown>): void {
  if (!activeSession) return;
  if (toolName === "verify") return;

  if (toolName === "bash") {
    const command = String(input.command ?? "");
    if (isDebugSidecarBashCommand(command)) {
      activeSession.debugSidecarSinceLastVerify = true;
    }
    return;
  }

  if (toolName === "write" || toolName === "edit") {
    const candidate = String(input.path ?? "");
    if (isDebugSidecarWritePath(candidate)) {
      activeSession.debugSidecarSinceLastVerify = true;
    }
  }
}

export function processCanonicalVerifyForConvergence(
  formattedVerifyText: string,
  exitCode: number,
): string {
  if (!convergenceInterventionV1EnabledFromEnvironment()) {
    return formattedVerifyText;
  }

  if (!activeSession) {
    resetConvergenceSession();
  }
  const session = activeSession!;

  session.ordinal += 1;
  const failedAfter = exitCode === 0 ? 0 : parseFailedCount(formattedVerifyText);
  const signaturesAfter = normalizeSignatures(formattedVerifyText).map((record) => record.signature);
  const isFirstVerify = session.ordinal === 1;
  const isPass = exitCode === 0;
  const state = classifyConvergenceState({
    failedBefore: session.previousFailedCount,
    failedAfter,
    isFirstVerify,
    isPass,
  });

  const { tier, signatureFallback } = decideInterventionTier({
    state,
    signaturesBefore: session.previousSignatures,
    signaturesAfter,
    debugSidecarSinceLastVerify: session.debugSidecarSinceLastVerify,
  });

  const debugSidecarDetected = session.debugSidecarSinceLastVerify;
  const countsKnown = session.previousFailedCount !== null && failedAfter !== null && !isFirstVerify;

  if (tier > 0 && state === "converging") {
    session.exportRecord.false_positive_converging_interventions += 1;
  }

  session.exportRecord.transitions.push({
    ordinal: session.ordinal,
    state,
    counts_known: countsKnown,
    failed_before: session.previousFailedCount,
    failed_after: failedAfter,
    signatures_before: [...session.previousSignatures],
    signatures_after: signaturesAfter,
    intervention_tier: tier,
    delivery: tier > 0 ? "appended_to_verify_result" : "none",
    debug_sidecar_detected: debugSidecarDetected,
    signature_fallback: signatureFallback,
  });

  if (tier === 1) session.exportRecord.tier1_count += 1;
  if (tier === 2) session.exportRecord.tier2_count += 1;

  session.previousFailedCount = failedAfter;
  session.previousSignatures = signaturesAfter;
  session.debugSidecarSinceLastVerify = false;

  const exportPath = resolveConvergenceExportPath();
  if (exportPath) {
    writeConvergenceExport(exportPath, session.exportRecord);
  }

  return appendInterventionTier(formattedVerifyText, tier);
}
