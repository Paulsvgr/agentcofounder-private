/**
 * Full-green gate v1 — VERIFY PASS + harness BUILD PASS → terminate agent loop.
 * Flag: HARNESS_FULL_GREEN_GATE_V1 (default ON — ship KEEP).
 *
 * Treatment must prevent another model call (tool result terminate:true),
 * not merely ask Pi to stop.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

export const FULL_GREEN_GATE_V1_SCHEMA = "agentcofounder.full_green_gate.v1" as const;
export const FULL_GREEN_GATE_EXPORT_FILENAME = "full-green-gate.v1.json";

export function fullGreenGateV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.HARNESS_FULL_GREEN_GATE_V1;
  // Default ON when unset (ship KEEP). Control / off arms set =0.
  if (raw === undefined || raw.trim() === "") return true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export interface CanonicalBuildResult {
  exitCode: number;
  output: string;
}

export function runCanonicalBuild(appRoot: string): CanonicalBuildResult {
  try {
    const output = execSync("npm run build", {
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

export function formatBuildFailBlock(exitCode: number, output: string): string {
  const truncated =
    output.length > 4000 ? `${output.slice(0, 4000)}\n…[build output truncated]` : output;
  return [
    "BUILD FAIL",
    `exit_code=${exitCode}`,
    "Harness ran canonical `npm run build` after VERIFY PASS; build did not succeed.",
    "Repair the build failure, then call `verify` again.",
    truncated,
  ].join("\n");
}

export function formatFullGreenBlock(): string {
  return [
    "FULL_GREEN",
    "VERIFY PASS + harness BUILD PASS.",
    "Harness is finalizing (writing report). Agent loop terminates — no further model turns.",
  ].join("\n");
}

export interface HarnessFullGreenReport {
  status: "success";
  app_url: string;
  start_command: string;
  summary: string;
  implemented_features: string[];
  assumptions: string[];
  tests_run: Array<{
    command: string;
    journey: string;
    result: "passed" | "failed";
  }>;
}

export function buildHarnessFullGreenReport(): HarnessFullGreenReport {
  return {
    status: "success",
    app_url: "http://localhost:3000",
    start_command: "npm run dev",
    summary:
      "Harness finalized after VERIFY PASS and canonical BUILD PASS (FULL_GREEN). No further agent turns.",
    implemented_features: [],
    assumptions: [
      "Harness wrote report.partial.json after full-green; outer runner still performs independent checks.",
    ],
    tests_run: [
      {
        command: "verify",
        journey: "Harness canonical verify PASS",
        result: "passed",
      },
      {
        command: "npm run build",
        journey: "Harness canonical build PASS",
        result: "passed",
      },
    ],
  };
}

export function writeHarnessFullGreenReport(appRoot: string): string {
  const reportPath = path.join(appRoot, "report.partial.json");
  const report = buildHarnessFullGreenReport();
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export interface FullGreenGateExport {
  schema: typeof FULL_GREEN_GATE_V1_SCHEMA;
  run_id: string | null;
  fired: boolean;
  outcome: "full_green" | "build_fail" | null;
  verify_exit_code: number | null;
  build_exit_code: number | null;
  report_written: boolean;
  terminate: boolean;
  timestamp: string | null;
  compact_text: string | null;
}

export function createEmptyFullGreenGateExport(
  runId: string | null = null,
): FullGreenGateExport {
  return {
    schema: FULL_GREEN_GATE_V1_SCHEMA,
    run_id: runId,
    fired: false,
    outcome: null,
    verify_exit_code: null,
    build_exit_code: null,
    report_written: false,
    terminate: false,
    timestamp: null,
    compact_text: null,
  };
}

export function resolveFullGreenGateRunIdFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.basename(artifactDir);
}

export function resolveFullGreenGateExportPath(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const artifactDir = env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, FULL_GREEN_GATE_EXPORT_FILENAME);
}

export function writeFullGreenGateExport(
  exportPath: string,
  payload: FullGreenGateExport,
): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** Process-local latch: once FULL_GREEN, block further tools with terminate. */
let fullGreenAchieved = false;

export function resetFullGreenGateState(): void {
  fullGreenAchieved = false;
}

export function markFullGreenAchieved(): void {
  fullGreenAchieved = true;
}

export function isFullGreenAchieved(): boolean {
  return fullGreenAchieved;
}

export function fullGreenBlockedToolReason(toolName: string): string {
  return (
    `FULL_GREEN: verify PASS + build PASS already achieved. ` +
    `Tool \`${toolName}\` is blocked. Agent loop is terminating.`
  );
}

export interface ApplyFullGreenGateResult {
  text: string;
  terminate: boolean;
  fullGreen: boolean;
  buildExitCode: number | null;
  reportWritten: boolean;
  timestamp: string | null;
  exportRecord: FullGreenGateExport;
}

/**
 * After VERIFY PASS: run canonical build.
 * BUILD FAIL → factual error text, continue (terminate=false).
 * BUILD PASS → write report, latch FULL_GREEN, terminate=true.
 */
export function applyFullGreenGateAfterVerifyPass(
  appRoot: string,
  formattedVerifyText: string,
  verifyExitCode: number,
  env: NodeJS.ProcessEnv = process.env,
): ApplyFullGreenGateResult {
  const exportRecord = createEmptyFullGreenGateExport(
    resolveFullGreenGateRunIdFromEnvironment(env),
  );
  exportRecord.verify_exit_code = verifyExitCode;

  if (!fullGreenGateV1EnabledFromEnvironment(env) || verifyExitCode !== 0) {
    return {
      text: formattedVerifyText,
      terminate: false,
      fullGreen: false,
      buildExitCode: null,
      reportWritten: false,
      timestamp: null,
      exportRecord,
    };
  }

  const build = runCanonicalBuild(appRoot);
  exportRecord.fired = true;
  exportRecord.build_exit_code = build.exitCode;
  const timestamp = new Date().toISOString();
  exportRecord.timestamp = timestamp;

  if (build.exitCode !== 0) {
    const block = formatBuildFailBlock(build.exitCode, build.output);
    const text = appendBlockAfterStatusLine(formattedVerifyText, block);
    exportRecord.outcome = "build_fail";
    exportRecord.compact_text = block.split("\n").slice(0, 4).join("\n");
    const exportPath = resolveFullGreenGateExportPath(env);
    if (exportPath) writeFullGreenGateExport(exportPath, exportRecord);
    return {
      text,
      terminate: false,
      fullGreen: false,
      buildExitCode: build.exitCode,
      reportWritten: false,
      timestamp,
      exportRecord,
    };
  }

  writeHarnessFullGreenReport(appRoot);
  markFullGreenAchieved();
  const block = formatFullGreenBlock();
  const text = appendBlockAfterStatusLine(formattedVerifyText, block);
  exportRecord.outcome = "full_green";
  exportRecord.report_written = true;
  exportRecord.terminate = true;
  exportRecord.compact_text = block;
  const exportPath = resolveFullGreenGateExportPath(env);
  if (exportPath) writeFullGreenGateExport(exportPath, exportRecord);

  return {
    text,
    terminate: true,
    fullGreen: true,
    buildExitCode: 0,
    reportWritten: true,
    timestamp,
    exportRecord,
  };
}

function appendBlockAfterStatusLine(formattedVerifyText: string, block: string): string {
  const lines = formattedVerifyText.split("\n");
  const head = lines[0] ?? "";
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  const body = rest ? `${head}\n\n${block}\n\n${rest}` : `${head}\n\n${block}`;
  return body.trimEnd() + (formattedVerifyText.endsWith("\n") ? "\n" : "");
}
