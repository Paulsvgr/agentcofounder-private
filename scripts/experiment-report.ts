import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRun, isNpmTestCommand } from "../src/analyze-run.js";
import type { RunExport } from "../src/export-run.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS_DIR = path.join(REPOSITORY_ROOT, "artifacts", "exports");
const EXPERIMENTS_DIR = path.join(REPOSITORY_ROOT, "artifacts", "experiments");
const SAVED_APPS_DIR = path.join(REPOSITORY_ROOT, "saved-apps");
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

export interface PrimitiveAdoption {
  collection_store_used: boolean;
  use_collection_used: boolean;
  memory_storage_used: boolean;
  text_helpers_used: boolean;
  template_primitive_usage_count: number;
}

export interface LocBreakdown {
  domain_application_loc: number;
  persistence_plumbing_loc: number;
  test_support_loc: number;
  total_src_loc: number;
}

export interface RunReportRow {
  run_id: string;
  approach: string | null;
  trajectory: TrajectoryClass;
  harness_status: string;
  harness_checks_passed: boolean;
  weighted_total: number;
  output_tokens: number;
  /** Output tokens before the first real npm/vitest execution. */
  implementation_output_tokens: number | null;
  model_calls: number;
  first_green_s: number | null;
  repair_loop_calls: number;
  test_reinspection_calls: number;
  same_generation_test_reruns: number;
  same_generation_full_suite_reruns: number;
  same_generation_partial_suite_reruns: number;
  first_failure_tool_output_chars: number | null;
  next_call_input_tokens_after_failure: number | null;
  post_failure_input_tokens: number;
  post_failure_cache_read_tokens: number;
  post_green_verification_calls: number;
  rtl_dom_leak_failures: number;
  query_ambiguity_failures: number;
  multiple_element_failures_total: number;
  harness_green_but_no_first_green: boolean;
  adoption: PrimitiveAdoption | null;
  loc: LocBreakdown | null;
}

function harnessChecksPassed(exportPayload: RunExport): boolean {
  return exportPayload.harness.harness_checks.every((check) => check.result === "passed");
}

function repairLoopCalls(exportPayload: RunExport): number {
  return (
    exportPayload.efficiency.action_flow.find((segment) => segment.stage === "repair_loop")
      ?.call_count ?? 0
  );
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

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split(/\r?\n/).length;
}

function classifySourcePath(relativePath: string): keyof Omit<LocBreakdown, "total_src_loc"> {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const base = path.posix.basename(normalized);
  if (
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    base.includes(".test.") ||
    base.includes(".spec.") ||
    base.includes("memorystorage") ||
    base.includes("setup.ts")
  ) {
    return "test_support_loc";
  }
  if (
    base.includes("repository") ||
    base.includes("collectionstore") ||
    base.includes("storage") ||
    normalized.includes("/data/") ||
    /persist|localstorage/.test(normalized)
  ) {
    return "persistence_plumbing_loc";
  }
  return "domain_application_loc";
}

export async function scanLocBreakdown(appSrcDir: string): Promise<LocBreakdown | null> {
  try {
    await access(appSrcDir);
  } catch {
    return null;
  }

  const breakdown: LocBreakdown = {
    domain_application_loc: 0,
    persistence_plumbing_loc: 0,
    test_support_loc: 0,
    total_src_loc: 0,
  };

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        await walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      const source = await readFile(full, "utf8");
      const lines = countLines(source);
      const relative = path.relative(appSrcDir, full);
      const bucket = classifySourcePath(relative);
      breakdown[bucket] += lines;
      breakdown.total_src_loc += lines;
    }
  }

  await walk(appSrcDir);
  return breakdown;
}

export function scanPrimitiveAdoption(sources: string[]): PrimitiveAdoption {
  const joined = sources.join("\n");
  const collection_store_used =
    /createCollectionStore\b/.test(joined) ||
    /from\s+["'][^"']*collectionStore["']/.test(joined);
  const use_collection_used =
    /\buseCollection\b/.test(joined) || /from\s+["'][^"']*useCollection["']/.test(joined);
  const memory_storage_used =
    /createMemoryStorage\b/.test(joined) ||
    /from\s+["'][^"']*memoryStorage["']/.test(joined);
  // Require seed-module import for text helpers — createId alone is too common.
  const text_helpers_used = /from\s+["'][^"']*(?:\/lib\/text|\/text)["']/.test(joined);

  const flags = [
    collection_store_used,
    use_collection_used,
    memory_storage_used,
    text_helpers_used,
  ];
  return {
    collection_store_used,
    use_collection_used,
    memory_storage_used,
    text_helpers_used,
    template_primitive_usage_count: flags.filter(Boolean).length,
  };
}

async function loadSavedAppSources(runId: string, approach: string | null): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(SAVED_APPS_DIR);
  } catch {
    return [];
  }

  const candidates = entries.filter(
    (name) => name.includes(runId) || (approach !== null && name.startsWith(`${approach}-`)),
  );
  if (candidates.length === 0) return [];

  const appDir = path.join(SAVED_APPS_DIR, candidates.sort().at(-1)!);
  const srcDir = path.join(appDir, "src");
  const sources: string[] = [];

  async function walk(dir: string): Promise<void> {
    let dirEntries;
    try {
      dirEntries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of dirEntries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|md)$/.test(entry.name)) continue;
      sources.push(await readFile(full, "utf8"));
    }
  }

  await walk(srcDir);
  return sources;
}

async function resolveSavedAppSrcDir(runId: string, approach: string | null): Promise<string | null> {
  let entries: string[] = [];
  try {
    entries = await readdir(SAVED_APPS_DIR);
  } catch {
    return null;
  }
  const candidates = entries.filter(
    (name) => name.includes(runId) || (approach !== null && name.startsWith(`${approach}-`)),
  );
  if (candidates.length === 0) return null;
  return path.join(SAVED_APPS_DIR, candidates.sort().at(-1)!, "src");
}

export async function computeImplementationOutputTokens(runId: string): Promise<number | null> {
  try {
    const analysis = await analyzeRun(runId);
    let firstTestCallIndex: number | null = null;
    for (const call of analysis.calls) {
      const ranTest = call.tools.some(
        (tool) => tool.name === "bash" && isNpmTestCommand(tool.detail),
      );
      if (ranTest) {
        firstTestCallIndex = call.index;
        break;
      }
    }
    let total = 0;
    for (const call of analysis.calls) {
      if (firstTestCallIndex !== null && call.index >= firstTestCallIndex) break;
      total += call.output_tokens;
    }
    return total;
  } catch {
    return null;
  }
}

export async function buildRunReportRow(
  exportPayload: RunExport,
  thresholds: ClassificationThresholds,
): Promise<RunReportRow> {
  const efficiency = exportPayload.efficiency;
  const runId = exportPayload.meta.run_id;
  const approach = exportPayload.meta.approach;
  const sources = await loadSavedAppSources(runId, approach);
  const srcDir = await resolveSavedAppSrcDir(runId, approach);
  const adoption = sources.length > 0 ? scanPrimitiveAdoption(sources) : null;
  const loc = srcDir ? await scanLocBreakdown(srcDir) : null;
  const implementation_output_tokens = await computeImplementationOutputTokens(runId);

  return {
    run_id: runId,
    approach,
    trajectory: classifyTrajectory(exportPayload, thresholds),
    harness_status: exportPayload.harness.status,
    harness_checks_passed: harnessChecksPassed(exportPayload),
    weighted_total: efficiency.weighted_total,
    output_tokens: exportPayload.harness.output_tokens,
    implementation_output_tokens,
    model_calls: exportPayload.harness.model_calls,
    first_green_s: efficiency.first_green_s,
    repair_loop_calls: repairLoopCalls(exportPayload),
    test_reinspection_calls: efficiency.test_reinspection_calls,
    same_generation_test_reruns: efficiency.same_generation_test_reruns ?? 0,
    same_generation_full_suite_reruns: efficiency.same_generation_full_suite_reruns ?? 0,
    same_generation_partial_suite_reruns: efficiency.same_generation_partial_suite_reruns ?? 0,
    first_failure_tool_output_chars: efficiency.first_failure_tool_output_chars ?? null,
    next_call_input_tokens_after_failure: efficiency.next_call_input_tokens_after_failure ?? null,
    post_failure_input_tokens: efficiency.post_failure_input_tokens ?? 0,
    post_failure_cache_read_tokens: efficiency.post_failure_cache_read_tokens ?? 0,
    post_green_verification_calls: efficiency.post_green_verification_calls,
    rtl_dom_leak_failures: efficiency.rtl_dom_leak_failures ?? 0,
    query_ambiguity_failures: efficiency.query_ambiguity_failures ?? 0,
    multiple_element_failures_total: efficiency.multiple_element_failures_total ?? 0,
    harness_green_but_no_first_green: efficiency.harness_green_but_no_first_green ?? false,
    adoption,
    loc,
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

function successfulRows(rows: RunReportRow[]): RunReportRow[] {
  return rows.filter(
    (row) => row.harness_status !== "failed" && row.harness_checks_passed,
  );
}

export function summarizeRows(rows: RunReportRow[]): {
  n: number;
  n_successful: number;
  p_clean: number;
  p_snowball: number;
  median_weighted: number | null;
  median_calls: number | null;
  median_output_tokens: number | null;
  median_implementation_output_tokens: number | null;
  median_persistence_plumbing_loc: number | null;
  median_same_generation_test_reruns: number | null;
  median_post_failure_input_tokens: number | null;
  adoption_rate: number | null;
  rtl_dom_leak_total: number;
} {
  const n = rows.length;
  const clean = rows.filter((row) => row.trajectory === "clean").length;
  const snowball = rows.filter((row) => row.trajectory === "snowball").length;
  const successful = successfulRows(rows);
  const adopted = successful.filter(
    (row) => (row.adoption?.template_primitive_usage_count ?? 0) >= 1,
  );
  return {
    n,
    n_successful: successful.length,
    p_clean: n > 0 ? clean / n : 0,
    p_snowball: n > 0 ? snowball / n : 0,
    median_weighted: median(successful.map((row) => row.weighted_total)),
    median_calls: median(successful.map((row) => row.model_calls)),
    median_output_tokens: median(successful.map((row) => row.output_tokens)),
    median_implementation_output_tokens: median(
      successful
        .map((row) => row.implementation_output_tokens)
        .filter((value): value is number => value !== null),
    ),
    median_persistence_plumbing_loc: median(
      successful
        .map((row) => row.loc?.persistence_plumbing_loc)
        .filter((value): value is number => value !== undefined),
    ),
    median_same_generation_test_reruns: median(
      successful.map((row) => row.same_generation_test_reruns),
    ),
    median_post_failure_input_tokens: median(
      successful
        .map((row) => row.post_failure_input_tokens)
        .filter((value) => value > 0),
    ),
    adoption_rate: successful.length > 0 ? adopted.length / successful.length : null,
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
      rows.push(await buildRunReportRow(payload, DEFAULT_THRESHOLDS));
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
  const rows = [];
  for (const payload of exports) {
    rows.push(await buildRunReportRow(payload, thresholds));
  }
  const summary = summarizeRows(rows);
  console.log(JSON.stringify({ arm, thresholds, rows, summary }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
