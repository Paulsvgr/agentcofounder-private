import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCallLedger } from "../src/v2/normalize.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANALYSIS_DIRECTORY = path.join(REPOSITORY_ROOT, "artifacts", "analysis");

function resolveRunDirectory(arg: string): string {
  if (path.isAbsolute(arg)) return arg;
  if (arg.includes("/") || arg.includes("\\")) {
    return path.resolve(REPOSITORY_ROOT, arg);
  }
  return path.join(REPOSITORY_ROOT, "artifacts", "runs", arg);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run normalize:run -- <run-id|artifacts/runs/<run-id>>");
    process.exit(2);
  }

  const runDirectory = resolveRunDirectory(arg);
  const runId = path.basename(runDirectory);
  const ledger = await buildCallLedger(runDirectory);

  const outputDirectory = path.join(ANALYSIS_DIRECTORY, runId);
  const outputPath = path.join(outputDirectory, "ledger.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  console.log(`run_id: ${ledger.run_id}`);
  console.log(`calls: ${ledger.calls.length}`);
  console.log(
    `weighted_total: ${ledger.calls.at(-1)?.cumulative_weighted.toFixed(0) ?? "0"}`,
  );
  console.log(`reconciliation: ${ledger.reconciliation.matched ? "OK" : "MISMATCH"}`);
  console.log(`wrote: ${outputPath}`);

  process.exit(ledger.reconciliation.matched ? 0 : 1);
}

await main();
