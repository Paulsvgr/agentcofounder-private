/**
 * Tail sweep v1 — harness-owned final test/build/server checks after report.partial.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyGeneratedApp } from "../../src/verify-app.js";
import type { AppVerification } from "../../src/types.js";

export const TAIL_SWEEP_EXPORT_FILENAME = "tail-sweep.v1.json";

export function tailSweepV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_TAIL_SWEEP_V1;
  return raw === "1" || raw === "true";
}

export function harnessOwnedVerifyEnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_OWNED_VERIFY;
  return raw === "1" || raw === "true";
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath
    .split(path.sep)
    .join("/")
    .replace(/^\.\/+/, "")
    .replace(/^\.\\+/, "");
}

export function isReportPartialPath(relativePath: string): boolean {
  return normalizeRelativePath(relativePath) === "report.partial.json";
}

export function isBuildCommand(command: string): boolean {
  return /\bnpm\s+run\s+build\b/i.test(command);
}

export function isDevServerCommand(command: string): boolean {
  return /\bnpm\s+run\s+dev\b/i.test(command);
}

export interface TailSweepCheckSummary {
  command: string;
  journey: string;
  result: "passed" | "failed";
}

export interface TailSweepResult {
  passed: boolean;
  checks: TailSweepCheckSummary[];
  compactText: string;
  error: string | null;
}

export interface TailSweepExport {
  run_id: string | null;
  fired: boolean;
  trigger: "report.partial.json write" | null;
  tool_result_index: number | null;
  passed: boolean | null;
  checks: TailSweepCheckSummary[];
  compact_text: string | null;
  error: string | null;
}

export function createEmptyTailSweepExport(runId: string | null = null): TailSweepExport {
  return {
    run_id: runId,
    fired: false,
    trigger: null,
    tool_result_index: null,
    passed: null,
    checks: [],
    compact_text: null,
    error: null,
  };
}

export function resolveTailSweepRunIdFromEnvironment(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.basename(artifactDir);
}

export function resolveTailSweepExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, TAIL_SWEEP_EXPORT_FILENAME);
}

export function resolveTailSweepArtifactDirectory(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  return artifactDir ?? null;
}

export function writeTailSweepExport(exportPath: string, payload: TailSweepExport): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readTailSweepExportFromRun(runDirectory: string): TailSweepExport | null {
  const exportPath = path.join(runDirectory, TAIL_SWEEP_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as TailSweepExport;
  } catch {
    return null;
  }
}

function summarizeChecks(verification: AppVerification): TailSweepCheckSummary[] {
  return verification.checks.map((check) => ({
    command: check.command,
    journey: check.journey,
    result: check.result,
  }));
}

export function formatCompactTailSweepResult(input: {
  passed: boolean;
  checks: TailSweepCheckSummary[];
}): string {
  const lines = [
    "Harness tail sweep (complete)",
    ...input.checks.map(
      (check) => `${check.command}: ${check.result === "passed" ? "PASS" : "FAIL"} — ${check.journey}`,
    ),
    "",
    input.passed
      ? "All final checks passed. Stop immediately. Do not run build, verify again, start the dev server, or write a closing summary."
      : "Final checks failed. Repair the reported issue, call `verify`, then rewrite `report.partial.json`. Do not run build or start the dev server manually.",
  ];
  return lines.join("\n");
}

export const TAIL_SWEEP_V1_POLICY_PROMPT = [
  "",
  "## Harness tail sweep (final checks)",
  "- After `verify` reports PASS on the current code, write `report.partial.json` immediately.",
  "- Do NOT run `npm run build` or `npm run dev` — the harness runs test, build, and localhost:3000 probe automatically when you write the report.",
  "- After writing `report.partial.json`, stop immediately. Do not write a closing summary or re-verify unchanged code.",
].join("\n");

export async function runTailSweep(appRoot: string, artifactDirectory: string): Promise<TailSweepResult> {
  try {
    const verification = await verifyGeneratedApp(appRoot, artifactDirectory, {
      displayRoot: appRoot,
    });
    const checks = summarizeChecks(verification);
    const passed = verification.passed;
    return {
      passed,
      checks,
      compactText: formatCompactTailSweepResult({ passed, checks }),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      checks: [],
      compactText: formatCompactTailSweepResult({
        passed: false,
        checks: [
          {
            command: "tail-sweep",
            journey: `Tail sweep failed before checks completed: ${message}`,
            result: "failed",
          },
        ],
      }),
      error: message,
    };
  }
}
