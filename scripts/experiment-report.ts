import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RunExport } from "../src/export-run.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS_DIR = path.join(REPOSITORY_ROOT, "artifacts", "exports");
const EXPERIMENTS_DIR = path.join(REPOSITORY_ROOT, "artifacts", "experiments");
const THRESHOLDS_PATH = path.join(EXPERIMENTS_DIR, "classification-thresholds.json");

export type TrajectoryClass = "clean" | "snowball" | "other";

export interface ClassificationThresholds {
  schema: "agentcofounder.classification_thresholds.v1";
  frozen_at: string;
  clean: {
    max_repair_loop_calls: number;
    max_test_reinspection_calls: number;
    max_post_green_verification_calls: number;
  };
  snowball: {
    min_repair_loop_calls: number;
    min_test_reinspection_calls: number;
  };
}

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  schema: "agentcofounder.classification_thresholds.v1",
  frozen_at: new Date(0).toISOString(),
  clean: {
    max_repair_loop_calls: 2,
    max_test_reinspection_calls: 1,
    max_post_green_verification_calls: 1,
  },
  snowball: {
    min_repair_loop_calls: 5,
    min_test_reinspection_calls: 3,
  },
};

export interface RunReportRow {
  run_id: string;
  approach: string | null;
  trajectory: TrajectoryClass;
  harness_status: string;
  harness_checks_passed: boolean;
  weighted_total: number;
  model_calls: number;
  first_green_s: number | null;
  repair_loop_calls: number;
  test_reinspection_calls: number;
  post_green_verification_calls: number;
  rtl_dom_leak_failures: number;
  query_ambiguity_failures: number;
  multiple_element_failures_total: number;
  harness_green_but_no_first_green: boolean;
}

function harnessChecksPassed(exportPayload: RunExport): boolean {
  return exportPayload.harness.harness_checks.every((check) => check.result === "passed");
}

function repairLoopCalls(exportPayload: RunExport): number {
  return exportPayload.efficiency.action_flow.find((segment) => segment.stage === "repair_loop")
    ?.call_count ?? 0;
}

export function classifyTrajectory(
  exportPayload: RunExport,
  thresholds: ClassificationThresholds,
): TrajectoryClass {
  const efficiency = exportPayload.efficiency;
  const repairCalls = repairLoopCalls(exportPayload);
  const reinspect = efficiency.test_reinspection_calls;
  const postGreen = efficiency.post_green_verification_calls;
  const qualityOk =
    exportPayload.harness.status !== "failed" && harnessChecksPassed(exportPayload);

  const isSnowball =
    repairCalls >= thresholds.snowball.min_repair_loop_calls ||
    reinspect >= thresholds.snowball.min_test_reinspection_calls;

  const isClean =
    efficiency.first_green_s !== null &&
    repairCalls <= thresholds.clean.max_repair_loop_calls &&
    reinspect <= thresholds.clean.max_test_reinspection_calls &&
    postGreen <= thresholds.clean.max_post_green_verification_calls &&
    qualityOk;

  if (isClean) return "clean";
  if (isSnowball) return "snowball";
  return "other";
}

export function buildRunReportRow(
  exportPayload: RunExport,
  thresholds: ClassificationThresholds,
): RunReportRow {
  const efficiency = exportPayload.efficiency;
  return {
    run_id: exportPayload.meta.run_id,
    approach: exportPayload.meta.approach,
    trajectory: classifyTrajectory(exportPayload, thresholds),
    harness_status: exportPayload.harness.status,
    harness_checks_passed: harnessChecksPassed(exportPayload),
    weighted_total: efficiency.weighted_total,
    model_calls: exportPayload.harness.model_calls,
    first_green_s: efficiency.first_green_s,
    repair_loop_calls: repairLoopCalls(exportPayload),
    test_reinspection_calls: efficiency.test_reinspection_calls,
    post_green_verification_calls: efficiency.post_green_verification_calls,
    rtl_dom_leak_failures: efficiency.rtl_dom_leak_failures ?? 0,
    query_ambiguity_failures: efficiency.query_ambiguity_failures ?? 0,
    multiple_element_failures_total: efficiency.multiple_element_failures_total ?? 0,
    harness_green_but_no_first_green: efficiency.harness_green_but_no_first_green ?? false,
  };
}

export async function loadThresholds(): Promise<ClassificationThresholds> {
  try {
    await access(THRESHOLDS_PATH);
    return JSON.parse(await readFile(THRESHOLDS_PATH, "utf8")) as ClassificationThresholds;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export async function freezeThresholds(thresholds: ClassificationThresholds): Promise<string> {
  await mkdir(EXPERIMENTS_DIR, { recursive: true });
  const payload = { ...thresholds, frozen_at: new Date().toISOString() };
  await writeFile(THRESHOLDS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return THRESHOLDS_PATH;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function summarizeRows(rows: RunReportRow[]): {
  n: number;
  p_clean: number;
  p_snowball: number;
  median_weighted: number | null;
  median_calls: number | null;
  rtl_dom_leak_total: number;
} {
  const n = rows.length;
  const clean = rows.filter((row) => row.trajectory === "clean").length;
  const snowball = rows.filter((row) => row.trajectory === "snowball").length;
  return {
    n,
    p_clean: n > 0 ? clean / n : 0,
    p_snowball: n > 0 ? snowball / n : 0,
    median_weighted: median(rows.map((row) => row.weighted_total)),
    median_calls: median(rows.map((row) => row.model_calls)),
    rtl_dom_leak_total: rows.reduce((sum, row) => sum + row.rtl_dom_leak_failures, 0),
  };
}

export async function loadExport(runId: string): Promise<RunExport> {
  const exportPath = path.join(EXPORTS_DIR, `${runId}.json`);
  return JSON.parse(await readFile(exportPath, "utf8")) as RunExport;
}

export async function loadArmExports(arm: string): Promise<RunExport[]> {
  const manifestPath = path.join(EXPERIMENTS_DIR, arm, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    reps: Array<{ run_id: string }>;
  };
  const exports: RunExport[] = [];
  for (const rep of manifest.reps) {
    exports.push(await loadExport(rep.run_id));
  }
  return exports;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const thresholds = await loadThresholds();

  if (mode === "--freeze-defaults") {
    const written = await freezeThresholds(DEFAULT_THRESHOLDS);
    console.log(`Wrote default thresholds to ${written}`);
    return;
  }

  if (mode === "--calibrate") {
    const cohort = [
      "2026-08-21T17-12-43-573Z",
      "2026-08-21T17-41-28-455Z",
      "2026-08-21T17-33-44-063Z",
      "2026-08-22T00-48-30-278Z",
      "2026-08-22T00-16-51-819Z",
      "2026-08-20T19-13-05-181Z",
      "2026-08-20T21-51-00-219Z",
    ];
    const rows = [];
    for (const runId of cohort) {
      const payload = await loadExport(runId);
      rows.push(buildRunReportRow(payload, DEFAULT_THRESHOLDS));
    }
    const written = await freezeThresholds(DEFAULT_THRESHOLDS);
    console.log(`Calibrated (frozen defaults) -> ${written}`);
    console.log(JSON.stringify({ rows, summary: summarizeRows(rows) }, null, 2));
    return;
  }

  const arm = mode;
  if (!arm || arm.startsWith("-")) {
    console.error(
      "Usage: npm run experiment:report -- <arm>|--calibrate|--freeze-defaults",
    );
    process.exitCode = 2;
    return;
  }

  const exports = await loadArmExports(arm);
  const rows = exports.map((payload) => buildRunReportRow(payload, thresholds));
  const summary = summarizeRows(rows);
  console.log(JSON.stringify({ arm, thresholds, rows, summary }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
