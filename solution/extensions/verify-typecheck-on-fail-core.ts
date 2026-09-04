/**
 * Factual typecheck enrichment on VERIFY FAIL.
 * Runs `tsc --noEmit` and prepends TYPECHECK lines — no advice.
 */

import { execSync } from "node:child_process";

export const VERIFY_TYPECHECK_ON_FAIL_V1_SCHEMA =
  "agentcofounder.verify_typecheck_on_fail.v1" as const;

export function verifyTypecheckOnFailV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1;
  // Default ON when unset (KEEP). Control / off arms set =0.
  if (raw === undefined || raw.trim() === "") return true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export interface TypecheckResult {
  exitCode: number;
  /** Non-empty diagnostic lines (already stripped of npm noise). */
  diagnostics: string[];
  raw: string;
}

/**
 * Run project typecheck. Prefer `npx tsc --noEmit` (matches app build).
 */
export function runAppTypecheck(appRoot: string): TypecheckResult {
  try {
    const raw = execSync("npx tsc --noEmit", {
      cwd: appRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, diagnostics: [], raw: raw.trim() };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    const raw = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim();
    const diagnostics = raw
      .split("\n")
      .map((line) => line.replace(/\u001b\[[0-9?]*[ -/]*[@-~]/g, "").trimEnd())
      .filter((line) => /error TS\d+:/.test(line))
      .slice(0, 12);
    return {
      exitCode: typeof err.status === "number" ? err.status : 1,
      diagnostics,
      raw,
    };
  }
}

export function formatTypecheckBlock(diagnostics: string[]): string | null {
  if (diagnostics.length === 0) return null;
  return ["TYPECHECK", ...diagnostics].join("\n");
}

/**
 * When VERIFY failed and typecheck has errors, prepend TYPECHECK facts.
 * PASS / empty diagnostics → unchanged.
 */
export function processCanonicalVerifyForTypecheckOnFail(
  formattedVerifyText: string,
  exitCode: number,
  appRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  runTypecheck: (root: string) => TypecheckResult = runAppTypecheck,
): string {
  if (!verifyTypecheckOnFailV1EnabledFromEnvironment(env)) return formattedVerifyText;
  if (exitCode === 0) return formattedVerifyText;

  const { diagnostics } = runTypecheck(appRoot);
  const block = formatTypecheckBlock(diagnostics);
  if (!block) return formattedVerifyText;

  // Insert after the first status line so Pi sees TYPECHECK before RTL symptoms.
  const lines = formattedVerifyText.split("\n");
  if (lines.length === 0) return `${block}\n\n${formattedVerifyText}`;
  const head = lines[0] ?? "";
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  return `${head}\n\n${block}\n\n${rest}`.trimEnd() + (formattedVerifyText.endsWith("\n") ? "\n" : "");
}
