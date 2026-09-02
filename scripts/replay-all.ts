/**
 * Batch replay fidelity check — zero model tokens.
 *
 * Replays every run that has a saved app to compare against, so replay itself
 * can be validated on evidence instead of trusted on assumption.
 *
 * Usage:
 *   npm run replay:all
 *   npm run replay:all -- --with-checks       (also run npm test/build per run)
 *   npm run replay:all -- --limit 5
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { replayRun, type ReplayReport, type ReplayVerdict } from "./replay-run.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");
const SAVED_APPS_DIRECTORY = path.join(REPOSITORY_ROOT, "saved-apps");
const RUN_ID_PATTERN = /\d{4}-\d{2}-\d{2}T[\d-]+Z$/u;

interface BatchRow {
  run_id: string;
  saved_app: string;
  verdict: ReplayVerdict;
  warnings: string[];
  mismatched: number;
  missing_in_replay: number;
  extra_in_replay: number;
  files_compared: number;
  failures: number;
  bash_mutation_warnings: number;
  template_drift: number;
}

interface BatchSummary {
  schema: "agentcofounder.replay_batch.v1";
  created_at: string;
  compare_only: boolean;
  total: number;
  identical: number;
  diverged: number;
  unverified: number;
  errored: number;
  rows: BatchRow[];
  errors: Array<{ run_id: string; message: string }>;
}

function parseArguments(argv: string[]): { withChecks: boolean; limit: number | null } {
  const limitIndex = argv.indexOf("--limit");
  const rawLimit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : Number.NaN;
  return {
    withChecks: argv.includes("--with-checks"),
    limit: Number.isSafeInteger(rawLimit) && rawLimit > 0 ? rawLimit : null,
  };
}

/** Saved app directories are named `<label>-<run-id>`; the run id is the suffix. */
async function pairSavedAppsWithRuns(): Promise<Array<{ runId: string; savedApp: string }>> {
  const savedNames = await readdir(SAVED_APPS_DIRECTORY).catch(() => []);
  const runIds = new Set(
    (await readdir(RUNS_DIRECTORY, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  const pairs: Array<{ runId: string; savedApp: string }> = [];
  for (const savedApp of savedNames.sort()) {
    const match = RUN_ID_PATTERN.exec(savedApp);
    if (!match) continue;
    const runId = match[0];
    if (!runIds.has(runId)) continue;
    pairs.push({ runId, savedApp });
  }
  return pairs;
}

function toRow(savedApp: string, report: ReplayReport): BatchRow {
  return {
    run_id: report.run_id,
    saved_app: savedApp,
    verdict: report.verdict,
    warnings: report.warnings,
    mismatched: report.compare?.mismatched.length ?? 0,
    missing_in_replay: report.compare?.missing_in_replay.length ?? 0,
    extra_in_replay: report.compare?.extra_in_replay.length ?? 0,
    files_compared: report.compare?.files_compared ?? 0,
    failures: report.failures.length,
    bash_mutation_warnings: report.bash_mutation_warnings,
    template_drift: report.template_drift.length,
  };
}

function verdictMark(verdict: ReplayVerdict): string {
  switch (verdict) {
    case "identical":
      return "OK  ";
    case "diverged":
      return "DIFF";
    case "unverified":
      return "??  ";
    default: {
      const exhaustive: never = verdict;
      return exhaustive;
    }
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const allPairs = await pairSavedAppsWithRuns();
  const pairs = args.limit === null ? allPairs : allPairs.slice(0, args.limit);

  console.log(
    `Replaying ${pairs.length} run(s) with saved apps (${args.withChecks ? "with" : "without"} test/build)\n`,
  );

  const rows: BatchRow[] = [];
  const errors: BatchSummary["errors"] = [];

  for (const [index, pair] of pairs.entries()) {
    const label = `[${String(index + 1).padStart(2, " ")}/${pairs.length}]`;
    try {
      const report = await replayRun(path.join(RUNS_DIRECTORY, pair.runId), {
        original: path.join(SAVED_APPS_DIRECTORY, pair.savedApp),
        compareOnly: !args.withChecks,
      });
      const row = toRow(pair.savedApp, report);
      rows.push(row);
      const detail =
        row.verdict === "identical"
          ? `${row.files_compared} files`
          : `${row.mismatched} changed, ${row.missing_in_replay} missing, ${row.extra_in_replay} extra`;
      console.log(`${label} ${verdictMark(row.verdict)} ${pair.savedApp}  (${detail})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ run_id: pair.runId, message });
      console.log(`${label} ERR  ${pair.savedApp}  (${message})`);
    }
  }

  const summary: BatchSummary = {
    schema: "agentcofounder.replay_batch.v1",
    created_at: new Date().toISOString(),
    compare_only: !args.withChecks,
    total: pairs.length,
    identical: rows.filter((row) => row.verdict === "identical").length,
    diverged: rows.filter((row) => row.verdict === "diverged").length,
    unverified: rows.filter((row) => row.verdict === "unverified").length,
    errored: errors.length,
    rows,
    errors,
  };

  const summaryPath = path.join(REPOSITORY_ROOT, "artifacts", "replay", "batch-summary.json");
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(
    [
      "",
      `identical  ${summary.identical}`,
      `diverged   ${summary.diverged}`,
      `unverified ${summary.unverified}`,
      `errored    ${summary.errored}`,
      "",
      `Summary: ${summaryPath}`,
    ].join("\n"),
  );

  process.exit(summary.diverged + summary.unverified + summary.errored > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
