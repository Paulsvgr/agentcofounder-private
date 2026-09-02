/**
 * Structured VERIFY failure formatting for q2-verify-repair-v1.
 * Pure functions — no Pi extension dependency.
 */

export type VerifyFailureClass =
  | "ambiguous_text"
  | "ambiguous_role"
  | "missing_accessible_name"
  | "async_timing"
  | "suite_error"
  | "other";

export interface VerifyFailureDetails {
  failure_class: VerifyFailureClass;
  test_name: string | null;
  file: string | null;
  hint: string;
}

const FAILURE_CLASS_HINTS: Record<VerifyFailureClass, string> = {
  ambiguous_text:
    "Scope with within(...) or use getByRole / getByLabelText with an accessible name",
  ambiguous_role: "Add accessible name or scope query to the target row/region",
  missing_accessible_name: "Add label/aria-label in product or query by role+name",
  async_timing: "Fix async flow or await user events before assert",
  suite_error: "Fix imports/syntax before re-running VERIFY",
  other: "Inspect failing test block; prefer narrowing query over rewriting product",
};

export function verifyRepairV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_VERIFY_REPAIR_V1;
  return raw === "1" || raw === "true";
}

export function classifyVerifyFailure(output: string): VerifyFailureClass {
  if (output.includes("Found multiple elements with the text:")) return "ambiguous_text";
  if (output.includes("Found multiple elements with the role")) return "ambiguous_role";
  if (
    output.includes("Unable to find an accessible element") ||
    output.includes("Unable to find a label")
  ) {
    return "missing_accessible_name";
  }
  if (
    output.includes("waitFor") ||
    output.includes("not wrapped in act") ||
    output.includes("Timed out in waitFor")
  ) {
    return "async_timing";
  }
  if (
    output.includes("SyntaxError") ||
    output.includes("Cannot find module") ||
    output.includes("FAIL 0/0") ||
    output.includes("Error: Collect")
  ) {
    return "suite_error";
  }
  return "other";
}

export function parseVerifyFailureLocation(output: string): {
  test_name: string | null;
  file: string | null;
} {
  const failLine = output.match(/^\s*FAIL\s+(.+)$/m);
  const test_name = failLine?.[1]?.trim() ?? null;

  const pointer = output.match(/❯\s+(\S+?):(\d+)(?::(\d+))?/);
  if (pointer) {
    return { test_name, file: `${pointer[1]}:${pointer[2]}` };
  }

  const atLine = output.match(/\bat\s+(\S+?):(\d+):(\d+)/);
  if (atLine) {
    return { test_name, file: `${atLine[1]}:${atLine[2]}` };
  }

  const pathOnly = output.match(/\b(src\/\S+\.test\.(?:tsx?|jsx?)):(\d+)/);
  if (pathOnly) {
    return { test_name, file: `${pathOnly[1]}:${pathOnly[2]}` };
  }

  return { test_name, file: null };
}

export function buildVerifyFailureDetails(output: string): VerifyFailureDetails {
  const failure_class = classifyVerifyFailure(output);
  const { test_name, file } = parseVerifyFailureLocation(output);
  return {
    failure_class,
    test_name,
    file,
    hint: FAILURE_CLASS_HINTS[failure_class],
  };
}

export function formatStructuredVerifyFailureSummary(details: VerifyFailureDetails): string {
  const lines = [
    `failure_class: ${details.failure_class}`,
    `test_name: ${details.test_name ?? "unknown"}`,
    `file: ${details.file ?? "unknown"}`,
    `hint: ${details.hint}`,
    "---",
  ];
  return lines.join("\n");
}

export function formatVerifyToolOutput(
  exitCode: number,
  output: string,
  repairV1Enabled = verifyRepairV1EnabledFromEnvironment(),
): string {
  const status = exitCode === 0 ? "PASS" : "FAIL";
  const header = `verify exit_code=${exitCode} (${status})`;

  if (exitCode === 0 || !repairV1Enabled) {
    return [header, "", output].join("\n");
  }

  const details = buildVerifyFailureDetails(output);
  return [formatStructuredVerifyFailureSummary(details), header, "", output].join("\n");
}
