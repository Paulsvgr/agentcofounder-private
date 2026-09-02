/**
 * Bash test-command blocking policy for harness-owned VERIFY and verify-repair-v1.
 */

export function isTestCommand(command: string): boolean {
  if (/\bnpm\s+(?:run\s+)?test\b/i.test(command)) return true;
  return /(?:^|[;&|]\s*|\/)\.?\/?vitest(?:\s|$)/i.test(command) || /\bnpx\s+vitest\b/i.test(command);
}

export function isPipedTestCommand(command: string): boolean {
  return /\|\s*(?:tail|grep|head|awk|sed|tee)\b/i.test(command);
}

/** Partial or scoped vitest invocations (non-canonical full suite). */
export function isNonCanonicalVitestCommand(command: string): boolean {
  if (!/(?:^|[;&|]\s*|\/)\.?\/?vitest\b/i.test(command) && !/\bnpx\s+vitest\b/i.test(command)) {
    return false;
  }
  if (/\bvitest\s+run\b/i.test(command)) return true;
  if (/\bvitest\b[^\n]*\s(?:src\/|test\/|\.\/)/i.test(command)) return true;
  if (/\bvitest\b[^\n]*(?:\s-t\s|\s--testNamePattern\b|\s-u\s|\s--update\b)/i.test(command)) {
    return true;
  }
  return false;
}

export interface TestBashBlockEvaluation {
  block: true;
  reason: string;
}

export function evaluateHarnessOwnedVerifyBashBlock(command: string): TestBashBlockEvaluation | undefined {
  if (!isTestCommand(command)) return undefined;

  if (isPipedTestCommand(command)) {
    return {
      block: true,
      reason:
        "Piped test commands are blocked. Use the `verify` tool — it runs npm test with a real exit code and full compact reporter output.",
    };
  }

  return {
    block: true,
    reason:
      "Direct test bash is blocked when harness-owned VERIFY is active. Use the `verify` tool instead of npm test / vitest bash.",
  };
}

export function evaluateVerifyRepairV1BashBlock(command: string): TestBashBlockEvaluation | undefined {
  if (!isTestCommand(command)) return undefined;

  if (isPipedTestCommand(command)) {
    return {
      block: true,
      reason:
        "Piped test commands are blocked before first green. Use the `verify` tool for the full suite — it returns authoritative PASS/FAIL with structured failure hints.",
    };
  }

  if (isNonCanonicalVitestCommand(command)) {
    return {
      block: true,
      reason:
        "Partial or file-scoped vitest bash is blocked. Use the `verify` tool to run the full suite — no `-t`, single-file, or `vitest run` escapes.",
    };
  }

  return {
    block: true,
    reason:
      "Direct test bash is blocked when VERIFY repair orchestration is active. Use the `verify` tool for the full suite.",
  };
}

export const VERIFY_REPAIR_V1_POLICY_PROMPT = [
  "",
  "## VERIFY repair orchestration (q2-verify-repair-v1)",
  "- After VERIFY reports FAIL, treat the failure as a **test or query problem** unless output clearly shows a product runtime exception unrelated to queries.",
  "- Prefer editing `*.test.ts(x)` selectors and structure before product source on the first repair pass.",
  "- Do not run file-scoped or filtered vitest via bash; use `verify` for the full suite.",
  "- After edits, call `verify` once — avoid exploratory test sidecars.",
].join("\n");
