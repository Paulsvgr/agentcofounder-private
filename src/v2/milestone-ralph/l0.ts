import type { AppVerification } from "../../types.js";
import { isDeferredVerificationCheck } from "../../verify-app.js";
import type { L0Snapshot } from "./state.js";

function checkPassed(verification: AppVerification, commandNeedle: string): boolean {
  return verification.checks.some(
    (check) => check.result === "passed" && check.command.toLowerCase().includes(commandNeedle),
  );
}

export function snapshotL0(verification: AppVerification): L0Snapshot {
  const lines = verification.checks.map(
    (check) => `- ${check.command}: ${check.result} — ${check.journey}`,
  );
  const gatingChecks = verification.checks.filter((check) => !isDeferredVerificationCheck(check));
  const passed = gatingChecks.length > 0 && gatingChecks.every((check) => check.result === "passed");
  const missingProductTests = verification.checks.some(
    (check) =>
      check.result === "failed" &&
      /at least one completed test/i.test(`${check.command} ${check.journey}`),
  );
  if (missingProductTests) {
    lines.unshift(
      "Cause: no product tests (App.tsx may still be the seed). Replace src/App.tsx and add src/**/*.test.tsx.",
    );
  }
  return {
    passed,
    tests_passed: checkPassed(verification, "vitest") || checkPassed(verification, "test"),
    build_passed: checkPassed(verification, "build"),
    http_passed: checkPassed(verification, "dev") || checkPassed(verification, "http"),
    summary: [`L0 ${passed ? "PASS" : "FAIL"}`, ...lines].join("\n"),
  };
}
