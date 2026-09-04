import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppVerification } from "./types.js";

const MAX_LOG_TAIL_CHARACTERS = 4_000;

/** Keeps the end of a log, where the actual failure is, and drops the noisy prefix. */
export function tailOf(content: string, limit = MAX_LOG_TAIL_CHARACTERS): string {
  const trimmed = content.trimEnd();
  if (trimmed.length <= limit) return trimmed;
  return `…\n${trimmed.slice(-limit)}`;
}

async function readTail(filePath: string, limit?: number): Promise<string> {
  try {
    return tailOf(await readFile(filePath, "utf8"), limit);
  } catch {
    return "";
  }
}

export function failedCheckNames(verification: AppVerification): string[] {
  return verification.checks.filter((check) => check.result === "failed").map((check) => check.command);
}

/**
 * Builds the repair instruction. Only the failing evidence is sent: the stable system
 * prompt prefix is reused unchanged so the provider can serve it from cache.
 */
export async function buildRepairPrompt(
  verification: AppVerification,
  artifactDirectory: string,
): Promise<string | undefined> {
  const failures = verification.checks.filter((check) => check.result === "failed");
  if (failures.length === 0) return undefined;

  const sections: string[] = [
    "## Repair task",
    "",
    "The application you just built failed the harness verification below. Fix the root cause in the",
    "application source, then run `npm test` and `npm run build` until both pass. Do not weaken, skip",
    "or delete tests, do not add dependencies, and do not leave a dev server running. When the checks",
    "pass, rewrite `report.partial.json` so it reflects the final state.",
    "",
    "### Failed checks",
    "",
    ...failures.map((check) => `- \`${check.command}\`: ${check.journey}`),
  ];

  const logs: [string, string][] = [
    ["Vitest output", await readTail(path.join(artifactDirectory, "app-test.log"))],
    ["Build output", await readTail(path.join(artifactDirectory, "app-build.log"), 2_000)],
    ["Dev server output", await readTail(path.join(artifactDirectory, "app-dev.log"), 1_500)],
  ];
  for (const [title, content] of logs) {
    if (content === "") continue;
    sections.push("", `### ${title}`, "", "```", content, "```");
  }
  return `${sections.join("\n")}\n`;
}

export function repairAttemptsFromEnvironment(): number {
  const raw = process.env.CHALLENGE_REPAIR_ATTEMPTS ?? "1";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 3) {
    throw new Error("CHALLENGE_REPAIR_ATTEMPTS must be an integer between 0 and 3");
  }
  return value;
}
