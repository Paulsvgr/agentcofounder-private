import path from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileRun } from "../src/v2/reconcile.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveRunDirectory(arg: string): string {
  if (path.isAbsolute(arg)) return arg;
  if (arg.includes("/") || arg.includes("\\")) {
    return path.resolve(REPOSITORY_ROOT, arg);
  }
  return path.join(REPOSITORY_ROOT, "artifacts", "runs", arg);
}

function printReport(report: Awaited<ReturnType<typeof reconcileRun>>): void {
  console.log(`run_id: ${report.run_id}`);
  console.log(`events: ${report.events_path}`);
  console.log(`result: ${report.result_path}`);
  console.log(`status: ${report.ok ? "OK" : "MISMATCH"}`);
  console.log("");
  console.log("field                 official   from_events       delta");
  for (const field of report.fields) {
    const label = field.field.padEnd(20);
    const official = String(field.official).padStart(10);
    const fromEvents = String(field.from_events).padStart(12);
    const delta = String(field.delta).padStart(12);
    const marker = field.match ? "" : "  <--";
    console.log(`${label}${official}${fromEvents}${delta}${marker}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run reconcile:run -- <run-id|artifacts/runs/<run-id>>");
    process.exit(2);
  }

  const report = await reconcileRun(resolveRunDirectory(arg));
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

await main();
