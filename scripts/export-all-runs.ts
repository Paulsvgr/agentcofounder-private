/**
 * Batch-build pasteable run_export.v1 files for every artifacts/runs/* id.
 * Prefer result.json from the run folder or saved-apps/*-<run-id>/result.json;
 * otherwise synthesize a minimal harness block from analysis (efficiency still full).
 */
import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRun, writeAnalysis, type RunAnalysis } from "../src/analyze-run.js";
import { buildRunExport, type RunExport } from "../src/export-run.js";
import type { RunResult } from "../src/types.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");
const SAVED_APPS_DIRECTORY = path.join(REPOSITORY_ROOT, "saved-apps");
const BATCH_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "exports", "batch");

/** Known cohort labels from retest logs / prior measurements. */
const APPROACH_BY_RUN_ID: Record<string, string> = {
  "2026-08-21T17-12-43-573Z": "A-baseline-1",
  "2026-08-21T17-16-01-144Z": "A-baseline-2",
  "2026-08-21T17-19-47-720Z": "A-baseline-3",
  "2026-08-21T17-25-01-445Z": "A-prompt-1",
  "2026-08-21T17-29-18-522Z": "A-prompt-2",
  "2026-08-21T17-33-44-063Z": "A-prompt-3",
  "2026-08-21T17-41-28-455Z": "A-autotest-1",
  "2026-08-21T17-44-12-352Z": "A-autotest-2",
  "2026-08-21T17-49-43-616Z": "A-autotest-3",
  "2026-08-20T21-51-00-219Z": "A-prime-zai",
  "2026-08-20T21-54-53-923Z": "B-prime-zai",
  "2026-08-20T22-00-59-263Z": "C-prime-zai-clean",
  "2026-08-20T21-41-20-112Z": "C-prime-zai",
  "2026-08-20T20-09-54-516Z": "C-prime-openai",
  "2026-08-20T20-54-36-625Z": "C-prime-gpt41",
  "2026-08-20T20-50-03-927Z": "C-prime-gpt41-attempt",
  "2026-08-20T19-13-05-181Z": "A-prime",
  "2026-08-20T19-28-31-545Z": "B-prime",
  "2026-08-19T23-33-32-518Z": "run-d",
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findResultJson(runId: string): Promise<{ path: string; source: "run" | "saved-apps" } | null> {
  const inRun = path.join(RUNS_DIRECTORY, runId, "result.json");
  if (await pathExists(inRun)) {
    return { path: inRun, source: "run" };
  }

  if (!(await pathExists(SAVED_APPS_DIRECTORY))) {
    return null;
  }

  const entries = await readdir(SAVED_APPS_DIRECTORY, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.includes(runId)) {
      continue;
    }
    const candidate = path.join(SAVED_APPS_DIRECTORY, entry.name, "result.json");
    if (await pathExists(candidate)) {
      return { path: candidate, source: "saved-apps" };
    }
  }
  return null;
}

function synthesizeResultFromAnalysis(analysis: RunAnalysis): RunResult {
  const status =
    analysis.status === "success" || analysis.status === "partial" || analysis.status === "failed"
      ? analysis.status
      : "partial";

  return {
    status,
    app_url: "http://localhost:3000",
    start_command: "npm run dev",
    summary: "",
    implemented_features: [],
    assumptions: [],
    tests_run: [],
    harness_checks: [],
    model_calls: analysis.model_calls,
    input_tokens: analysis.input_tokens,
    output_tokens: analysis.output_tokens,
    cache_read_tokens: analysis.cache_read_tokens,
    cache_write_tokens: analysis.cache_write_tokens,
    total_tokens: analysis.total_tokens,
    reasoning_tokens: analysis.reasoning_tokens,
    cost_total: 0,
    call_log: [],
    pi_exit_code: 0,
    telemetry_source: "pi-json-event-stream",
    port_reclamation: {
      preexisting_listener: false,
      listener_after_pi: false,
      attempted: false,
      reclaimed: false,
      process_ids: [],
      diagnostic: "synthesized-from-analysis",
    },
  };
}

async function listRunIds(): Promise<string[]> {
  const entries = await readdir(RUNS_DIRECTORY, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  await mkdir(BATCH_DIRECTORY, { recursive: true });
  const runIds = await listRunIds();
  const manifest: Array<{
    run_id: string;
    approach: string | null;
    result_source: "run" | "saved-apps" | "analysis-only";
    weighted_total: number;
    status: string | null;
    path: string;
  }> = [];

  let full = 0;
  let analysisOnly = 0;
  let failed = 0;

  for (const runId of runIds) {
    try {
      const analysis = await analyzeRun(runId);
      await writeAnalysis(analysis);

      const found = await findResultJson(runId);
      let result: RunResult;
      let resultSource: "run" | "saved-apps" | "analysis-only";

      if (found) {
        result = JSON.parse(await readFile(found.path, "utf8")) as RunResult;
        resultSource = found.source;
        full += 1;
      } else {
        result = synthesizeResultFromAnalysis(analysis);
        resultSource = "analysis-only";
        analysisOnly += 1;
      }

      const approach = APPROACH_BY_RUN_ID[runId] ?? null;
      const payload: RunExport = buildRunExport(result, analysis, {
        approach,
        git_branch: null,
        git_commit: null,
      });

      // Prefer labeled approach; keep analysis provider/model.
      if (!payload.meta.approach) {
        payload.meta.approach = resultSource === "analysis-only" ? "unknown" : runId;
      }

      const outPath = path.join(BATCH_DIRECTORY, `${runId}.json`);
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

      manifest.push({
        run_id: runId,
        approach: payload.meta.approach,
        result_source: resultSource,
        weighted_total: payload.efficiency.weighted_total,
        status: payload.harness.status,
        path: outPath,
      });

      console.log(
        `${runId}  ${resultSource.padEnd(14)}  weighted=${payload.efficiency.weighted_total.toFixed(0)}  approach=${payload.meta.approach}`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${runId}: ${message}`);
    }
  }

  const manifestPath = path.join(BATCH_DIRECTORY, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total: manifest.length,
        full_result: full,
        analysis_only: analysisOnly,
        failed,
        runs: manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nWrote ${manifest.length} exports to ${BATCH_DIRECTORY}`);
  console.log(`full result=${full}  analysis-only=${analysisOnly}  failed=${failed}`);
  console.log(`Manifest: ${manifestPath}`);
}

await main();
