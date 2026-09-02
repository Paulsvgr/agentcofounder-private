/**
 * Harness-owned VERIFY — Experiment D1
 *
 * When HARNESS_OWNED_VERIFY=1:
 * - Registers a `verify` tool that runs `npm test` with a real exit code (no pipes).
 * - Blocks Pi bash commands that run piped or direct npm test / vitest.
 *
 * When HARNESS_VERIFY_REPAIR_V1=1 (verify-repair-v1 extension loaded):
 * - FAIL output includes structured failure_class / file / hint (PASS semantics unchanged).
 *
 * When HARNESS_TEST_AUTHORING_GUARD_V1=1 (test-authoring-guard-v1 extension loaded):
 * - Blocks verify until F1–F5 scan passes (compact guard_result: BLOCKED feedback).
 */

import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCanonicalVerify } from "./canonical-verify.js";
import {
  evaluateHarnessOwnedVerifyBashBlock,
  isTestCommand,
} from "./verify-command-policy.js";
import { evaluateTestAuthoringGuardBlock } from "./test-authoring-guard.js";
import { processCanonicalVerifyForConvergence } from "./convergence-intervention-core.js";
import { formatVerifyToolOutput, verifyRepairV1EnabledFromEnvironment } from "./verify-failure-format.js";

const ENABLED =
  process.env.HARNESS_OWNED_VERIFY === "1" || process.env.HARNESS_OWNED_VERIFY === "true";

function runVerifyAt(appRoot: string): { exitCode: number; output: string } {
  return runCanonicalVerify(appRoot);
}

export interface HarnessOwnedVerifyExecution {
  text: string;
  exitCode: number;
  status: "PASS" | "FAIL";
  guardBlocked: boolean;
}

/** Shared VERIFY execution path used by the Pi tool and harness parity tests. */
export function runHarnessOwnedVerifyAt(appRoot: string): HarnessOwnedVerifyExecution {
  const { exitCode, output } = runVerifyAt(appRoot);
  const status: "PASS" | "FAIL" = exitCode === 0 ? "PASS" : "FAIL";
  const formatted = formatVerifyToolOutput(
    exitCode,
    output,
    verifyRepairV1EnabledFromEnvironment(),
  );
  const text = processCanonicalVerifyForConvergence(formatted, exitCode);
  return { text, exitCode, status, guardBlocked: false };
}

const verifyTool = defineTool({
  name: "verify",
  label: "Verify tests",
  description:
    "Run the full Vitest suite (npm test) and return structured PASS/FAIL output with a real exit code. Use this instead of bash npm test.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
    const guardBlock = evaluateTestAuthoringGuardBlock(process.cwd());
    if (guardBlock) {
      return {
        content: [{ type: "text", text: guardBlock.reason }],
        details: {
          guard_blocked: true,
          guard_violation: guardBlock.violation.patternId,
          file: guardBlock.violation.file,
          line: guardBlock.violation.line,
        },
      };
    }

    const result = runHarnessOwnedVerifyAt(process.cwd());
    return {
      content: [{ type: "text", text: result.text }],
      details: { exit_code: result.exitCode, status: result.status },
    };
  },
});

export default function harnessOwnedVerify(pi: ExtensionAPI) {
  if (!ENABLED) return;

  pi.registerTool(verifyTool);

  pi.on("before_agent_start", async () => ({
    systemPrompt: [
      "",
      "## Harness-owned verification",
      "- Run product tests with the `verify` tool — not `bash npm test`.",
      "- Do not pipe test output (`| tail`, `| grep`, etc.); the harness returns authoritative PASS/FAIL.",
      "- After `verify` reports PASS and `npm run build` succeeds, write `report.partial.json` and finish.",
      "- Each `tests_run` entry must use `{ \"command\": \"verify\", \"journey\": \"<behaviour verified>\", \"result\": \"passed\" }` — not `name`/`status`.",
    ].join("\n"),
  }));

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return undefined;
    const command = String((event.input as Record<string, unknown>).command ?? "");
    if (!isTestCommand(command)) return undefined;
    return evaluateHarnessOwnedVerifyBashBlock(command);
  });
}
