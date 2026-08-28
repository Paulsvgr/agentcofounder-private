import path from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileAllRuns } from "../src/v2/reconcile.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "runs");

function printBatchReport(report: Awaited<ReturnType<typeof reconcileAllRuns>>): void {
  console.log(`runs: ${report.runs_directory}`);
  console.log(`ok: ${report.ok.length}`);
  console.log(`skipped: ${report.skipped.length}`);
  console.log(`mismatch: ${report.mismatches.length}`);
  console.log("");

  if (report.skipped.length > 0) {
    console.log("skipped (incomplete artifacts):");
    for (const skip of report.skipped) {
      console.log(`  ${skip.run_id}  ${skip.reason}`);
    }
    console.log("");
  }

  if (report.mismatches.length > 0) {
    console.log("mismatches:");
    for (const mismatch of report.mismatches) {
      console.log(`  ${mismatch.run_id}`);
      for (const field of mismatch.fields.filter((entry) => !entry.match)) {
        console.log(`    ${field.field}: official=${field.official} events=${field.from_events} delta=${field.delta}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const report = await reconcileAllRuns(RUNS_DIRECTORY);
  printBatchReport(report);
  process.exit(report.mismatches.length === 0 ? 0 : 1);
}

await main();
