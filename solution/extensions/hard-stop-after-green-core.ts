/**
 * Hard-stop-after-green v1 — factual STOP on VERIFY PASS + mechanical tool block.
 * Flag: HARNESS_HARD_STOP_AFTER_GREEN_V1 (default OFF).
 *
 * When HARNESS_FULL_GREEN_GATE_V1 is on, hard-stop PASS decoration is skipped —
 * full-green owns finalize (build + harness report + terminate).
 */

import { fullGreenGateV1EnabledFromEnvironment } from "./full-green-gate-core.js";

export const HARD_STOP_AFTER_GREEN_V1_SCHEMA =
  "agentcofounder.hard_stop_after_green.v1" as const;

export function hardStopAfterGreenV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.HARNESS_HARD_STOP_AFTER_GREEN_V1;
  if (raw === undefined || raw.trim() === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isVerifyPassText(text: string): boolean {
  return /exit_code=0 \(PASS\)/.test(text) || /✅\s*PASS/.test(text);
}

export function formatHardStopBlock(): string {
  return [
    "HARD_STOP",
    "Verification is green.",
    "Write report.partial.json if missing, then finish.",
    "Further edits, bash, and re-verify are blocked.",
  ].join("\n");
}

/**
 * On VERIFY PASS + flag, append HARD_STOP after the status line.
 * FAIL / disabled → unchanged.
 */
export function processCanonicalVerifyForHardStopAfterGreen(
  formattedVerifyText: string,
  exitCode: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (fullGreenGateV1EnabledFromEnvironment(env)) return formattedVerifyText;
  if (!hardStopAfterGreenV1EnabledFromEnvironment(env)) return formattedVerifyText;
  if (exitCode !== 0) return formattedVerifyText;

  const block = formatHardStopBlock();
  const lines = formattedVerifyText.split("\n");
  const head = lines[0] ?? "";
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  return `${head}\n\n${block}\n\n${rest}`.trimEnd() + (formattedVerifyText.endsWith("\n") ? "\n" : "");
}

export function isReportPartialPath(relativePath: string): boolean {
  return relativePath.split("\\").join("/").replace(/^\.\//, "") === "report.partial.json";
}

export function hardStopBlockedToolReason(toolName: string): string {
  return (
    `HARD_STOP: verify already PASS. ` +
    `Tool \`${toolName}\` is blocked. Write report.partial.json if needed, then finish.`
  );
}

export const HARD_STOP_STEER_TEXT = [
  "HARD_STOP is active: verification is green.",
  "Write report.partial.json now (if not already written), then finish.",
  "Do not edit product/test code, run bash, or call verify again.",
].join(" ");
