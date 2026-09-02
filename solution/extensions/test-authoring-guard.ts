/**
 * Pre-VERIFY guard orchestration for test-authoring-guard-v1.
 */

import type { GuardViolation } from "./test-authoring-scan.js";
import { scanTestDirectory } from "./test-authoring-scan.js";

export const GUARD_BLOCK_MAX_CHARS = 512;
export const GUARD_HINT_MAX_CHARS = 120;

export interface GuardBlockEvaluation {
  block: true;
  reason: string;
  violation: GuardViolation;
}

export function testAuthoringGuardV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
  return raw === "1" || raw === "true";
}

function truncateHint(hint: string): string {
  if (hint.length <= GUARD_HINT_MAX_CHARS) return hint;
  return `${hint.slice(0, GUARD_HINT_MAX_CHARS - 1)}…`;
}

export function formatGuardBlockedMessage(violation: GuardViolation): string {
  const hint = truncateHint(violation.hint);
  const message = [
    "guard_result: BLOCKED",
    `guard_violation: ${violation.patternId}`,
    `file: ${violation.file}:${violation.line}`,
    `hint: ${hint}`,
  ].join("\n");
  if (message.length <= GUARD_BLOCK_MAX_CHARS) return message;
  return message.slice(0, GUARD_BLOCK_MAX_CHARS);
}

export function evaluateTestAuthoringGuardBlock(appRoot: string): GuardBlockEvaluation | undefined {
  if (!testAuthoringGuardV1EnabledFromEnvironment()) return undefined;

  let scan;
  try {
    scan = scanTestDirectory(appRoot);
  } catch {
    return {
      block: true,
      reason: [
        "guard_result: BLOCKED",
        "guard_violation: SCAN_ERROR",
        "file: src",
        "hint: Test guard scan failed; fix test syntax and retry verify",
      ].join("\n").slice(0, GUARD_BLOCK_MAX_CHARS),
      violation: {
        patternId: "F3",
        file: "src",
        line: 1,
        hint: "Test guard scan failed; fix test syntax and retry verify",
        blocking: true,
      },
    };
  }

  if (!scan.blockingHit) return undefined;

  return {
    block: true,
    reason: formatGuardBlockedMessage(scan.blockingHit),
    violation: scan.blockingHit,
  };
}
