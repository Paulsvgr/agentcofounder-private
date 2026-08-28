import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCallLedger } from "../src/v2/normalize.js";
import { buildStationReport, renderStationHtml } from "../src/v2/station.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANALYSIS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "analysis");

function resolveRunDirectory(arg: string): string {
  if (path.isAbsolute(arg)) return arg;
  if (arg.includes("/") || arg.includes("\\")) {
    return path.resolve(REPOSITORY_ROOT, arg);
  }
  return path.join(REPOSITORY_ROOT, "artifacts", "runs", arg);
}

function parseArgs(argv: string[]): { runArg: string; compareArg?: string } {
  const positional: string[] = [];
  let compareArg: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--compare") {
      compareArg = argv[index + 1];
      if (!compareArg) {
        console.error("Usage: npm run analyze:run -- <run-id> [--compare <run-id>]");
        process.exit(2);
      }
      index += 1;
      continue;
    }
    if (token !== undefined) positional.push(token);
  }

  const runArg = positional[0];
  if (!runArg) {
    console.error("Usage: npm run analyze:run -- <run-id> [--compare <run-id>]");
    process.exit(2);
  }

  return { runArg, ...(compareArg === undefined ? {} : { compareArg }) };
}

async function main(): Promise<void> {
  const { runArg, compareArg } = parseArgs(process.argv.slice(2));

  const runDirectory = resolveRunDirectory(runArg);
  const runId = path.basename(runDirectory);
  const ledger = await buildCallLedger(runDirectory);

  let compareLedger;
  if (compareArg) {
    compareLedger = await buildCallLedger(resolveRunDirectory(compareArg));
  }

  const report = buildStationReport(ledger, compareLedger);
  const outputDirectory = path.join(ANALYSIS_DIRECTORY, runId);
  const ledgerPath = path.join(outputDirectory, "ledger.json");
  const stationJsonPath = path.join(outputDirectory, "station.json");
  const stationHtmlPath = path.join(outputDirectory, "station.html");

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
    writeFile(stationJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(stationHtmlPath, renderStationHtml(report), "utf8"),
  ]);

  console.log(`run_id: ${report.run_id}`);
  if (report.compare) {
    console.log(`compare: ${report.compare.run_id}`);
  }
  console.log(`calls: ${report.totals.model_calls}`);
  console.log(`weighted_total: ${report.totals.weighted_total.toFixed(0)}`);
  console.log(`reconciliation: ${report.reconciliation_ok ? "OK" : "MISMATCH"}`);
  if (report.activity_summary.length > 0) {
    console.log("activity:");
    for (const bucket of report.activity_summary.slice(0, 6)) {
      console.log(
        `  ${bucket.activity.padEnd(8)} calls=${String(bucket.call_count).padStart(2)} weighted=${bucket.weighted_cost.toFixed(0)} share=${(bucket.share_of_total * 100).toFixed(1)}%`,
      );
    }
  }
  console.log(`wrote: ${ledgerPath}`);
  console.log(`wrote: ${stationJsonPath}`);
  console.log(`wrote: ${stationHtmlPath}`);

  process.exit(report.reconciliation_ok ? 0 : 1);
}

await main();
