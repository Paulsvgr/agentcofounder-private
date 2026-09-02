import path from "node:path";
import { fileURLToPath } from "node:url";
import { listExperiments, seedExperimentsFromTaxonomy } from "../control-app/server/experiments.js";
import { DEFAULT_TAXONOMY, readOverlayFile } from "../control-app/server/run-overlay.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const overlay = await readOverlayFile(REPOSITORY_ROOT, true);
  const ids = [...new Set([...DEFAULT_TAXONOMY.experiment, ...overlay.taxonomy.experiment])];
  const result = await seedExperimentsFromTaxonomy(REPOSITORY_ROOT, ids, { force });
  const total = (await listExperiments(REPOSITORY_ROOT, true)).length;
  console.log(`experiments: ${path.join(REPOSITORY_ROOT, "artifacts", "experiments")}`);
  console.log(
    `seeded: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped (${ids.length} in source)`,
  );
  console.log(`catalog total: ${total}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
