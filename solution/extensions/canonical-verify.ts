/**
 * Shared canonical VERIFY execution (harness-owned npm test).
 */

import { execSync } from "node:child_process";

export interface CanonicalVerifyResult {
  exitCode: number;
  output: string;
}

export function runCanonicalVerify(appRoot: string): CanonicalVerifyResult {
  try {
    const output = execSync("npm test", {
      cwd: appRoot,
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

export function formatVerifySourcePrefix(source: string): string {
  return `verify_source: ${source}`;
}
