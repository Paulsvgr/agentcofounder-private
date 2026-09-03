/**
 * Harness-owned VERIFY — Experiment D1
 *
 * When HARNESS_OWNED_VERIFY=1:
 * - Registers a `verify` tool that runs `npm test` with a real exit code (no pipes).
 * - Blocks Pi bash commands that actually invoke npm test / vitest (not path listings).
 */

import { execSync } from "node:child_process";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isBashTestInvocation } from "./test-invocation.js";

const ENABLED =
  process.env.HARNESS_OWNED_VERIFY === "1" || process.env.HARNESS_OWNED_VERIFY === "true";

function isPiped(command: string): boolean {
  return /\|\s*(?:tail|grep|head|awk|sed|tee)\b/i.test(command);
}

function runVerify(): { exitCode: number; output: string } {
  try {
    const output = execSync("npm test", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    });
    return { exitCode: 0, output: output.trim() };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    const stdout = typeof err.stdout === "string" ? err.stdout : "";
    const stderr = typeof err.stderr === "string" ? err.stderr : "";
    const combined = `${stdout}\n${stderr}`.trim();
    return {
      exitCode: typeof err.status === "number" ? err.status : 1,
      output: combined || String(error),
    };
  }
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
    const { exitCode, output } = runVerify();
    const status = exitCode === 0 ? "PASS" : "FAIL";
    const text = [`verify exit_code=${exitCode} (${status})`, "", output].join("\n");
    return {
      content: [{ type: "text", text }],
      details: { exit_code: exitCode, status },
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
    if (!isBashTestInvocation(command)) return undefined;

    if (isPiped(command)) {
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
  });
}
