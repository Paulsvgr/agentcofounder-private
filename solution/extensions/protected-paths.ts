import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import {
  blockedDevServerReason,
  buildFinalizeSteerMessage,
  buildTimeBudgetSteerMessage,
  challengeTimeoutMs,
  detectBuildPassed,
  detectTestsPassed,
  extractToolText,
  remainingMinutes,
  shouldWarnTimeBudget,
} from "./challenge-guards.js";

export const PI_DOCUMENTATION_HEADING = "Pi documentation (read only when ";
const PI_DOCUMENTATION_BLOCK_START = `\n\n${PI_DOCUMENTATION_HEADING}`;

export function stripPiDocumentationBlock(systemPrompt: string): string {
  const blockStart = systemPrompt.indexOf(PI_DOCUMENTATION_BLOCK_START);
  if (blockStart < 0) return systemPrompt;

  const headingEnd = systemPrompt.indexOf("\n", blockStart + PI_DOCUMENTATION_BLOCK_START.length);
  if (headingEnd < 0) return systemPrompt;

  let lineStart = headingEnd + 1;
  let bulletCount = 0;
  while (systemPrompt.startsWith("- ", lineStart)) {
    bulletCount += 1;
    const lineEnd = systemPrompt.indexOf("\n", lineStart);
    if (lineEnd < 0) return systemPrompt.slice(0, blockStart);
    lineStart = lineEnd + 1;
  }
  if (bulletCount === 0) return systemPrompt;

  return systemPrompt.slice(0, blockStart) + systemPrompt.slice(Math.max(blockStart, lineStart - 1));
}

export default function protectedPaths(pi: ExtensionAPI) {
  const appRoot = process.cwd();
  const bashCommands = new Map<string, string>();
  let testsPassed = false;
  let buildPassed = false;
  let finalizeSteered = false;
  let timeBudgetSteered = false;
  let agentStartedAt = 0;

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: stripPiDocumentationBlock(event.systemPrompt),
  }));

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
    testsPassed = false;
    buildPassed = false;
    finalizeSteered = false;
    timeBudgetSteered = false;
    bashCommands.clear();
  });

  pi.on("turn_start", () => {
    if (timeBudgetSteered || agentStartedAt === 0) return;

    const timeoutMs = challengeTimeoutMs();
    const elapsedMs = Date.now() - agentStartedAt;
    if (!shouldWarnTimeBudget(elapsedMs, timeoutMs)) return;

    timeBudgetSteered = true;
    pi.sendUserMessage(buildTimeBudgetSteerMessage(remainingMinutes(elapsedMs, timeoutMs)), {
      deliverAs: "steer",
    });
  });

  pi.on("tool_execution_start", (event) => {
    if (event.toolName !== "bash") return;
    const args = event.args as Record<string, unknown>;
    bashCommands.set(event.toolCallId, String(args.command ?? ""));
  });

  pi.on("tool_call", async (event, context) => {
    if (event.toolName === "bash") {
      const reason = blockedDevServerReason(String(event.input.command ?? ""));
      if (reason) {
        if (context.hasUI) context.ui.notify("Blocked dev-server command", "warning");
        return { block: true, reason };
      }
      return undefined;
    }

    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;
    const candidate = String((event.input as Record<string, unknown>).path ?? "");
    const absolute = path.resolve(appRoot, candidate);
    const relative = path.relative(appRoot, absolute);
    const outsideApp = relative.startsWith("..") || path.isAbsolute(relative);
    const segments = relative.split(path.sep);
    const basename = path.basename(absolute).toLowerCase();
    const protectedPath =
      outsideApp ||
      segments.includes(".git") ||
      segments.includes("node_modules") ||
      basename === "result.json" ||
      basename === ".env" ||
      basename.startsWith(".env.");
    if (!protectedPath) return undefined;

    if (context.hasUI) context.ui.notify(`Blocked write to protected path: ${candidate}`, "warning");
    return { block: true, reason: "Path is outside the app workspace or is runner-owned" };
  });

  pi.on("tool_execution_end", (event) => {
    if (event.toolName !== "bash" || event.isError) return;

    const command = bashCommands.get(event.toolCallId) ?? "";
    bashCommands.delete(event.toolCallId);
    const output = extractToolText(event.result);

    if (detectTestsPassed(command, output)) testsPassed = true;
    if (detectBuildPassed(command, output)) buildPassed = true;

    if (testsPassed && buildPassed && !finalizeSteered) {
      finalizeSteered = true;
      pi.sendUserMessage(buildFinalizeSteerMessage(), { deliverAs: "steer" });
    }
  });
}
