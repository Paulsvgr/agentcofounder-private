import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeSeedIntoOverlay,
  overlayEntryFromSeed,
  overlayFilePath,
  readOverlayFile,
  writeOverlayFile,
  type ClassificationSeedEntry,
} from "../control-app/server/run-overlay.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLASSIFICATION_PATH = path.join(
  REPOSITORY_ROOT,
  "control-app",
  "web",
  "public",
  "runs-classification.json",
);

interface ClassificationFile {
  generated_at?: string;
  taxonomy?: { line?: string[]; experiment?: string[] };
  runs?: Record<string, ClassificationSeedEntry>;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const raw = JSON.parse(await readFile(CLASSIFICATION_PATH, "utf8")) as ClassificationFile;
  const seeds = raw.runs ?? {};
  const file = await readOverlayFile(REPOSITORY_ROOT, true);

  if (raw.taxonomy?.line?.length) {
    file.taxonomy.line = raw.taxonomy.line;
  }
  if (raw.taxonomy?.experiment?.length) {
    file.taxonomy.experiment = raw.taxonomy.experiment;
  }

  let inserted = 0;
  let skipped = 0;
  const seedTimestamp = raw.generated_at ?? new Date().toISOString();

  if (force) {
    for (const [runId, seed] of Object.entries(seeds)) {
      const existed = Boolean(file.runs[runId]);
      file.runs[runId] = overlayEntryFromSeed(runId, seed);
      file.runs[runId]!.updated_at = seedTimestamp;
      if (existed) skipped += 1;
      else inserted += 1;
    }
  } else {
    const result = mergeSeedIntoOverlay(file, seeds);
    inserted = result.inserted;
    skipped = result.skipped;
    for (const runId of Object.keys(seeds)) {
      const entry = file.runs[runId];
      if (entry && entry.updated_at === new Date(0).toISOString()) {
        entry.updated_at = seedTimestamp;
      }
    }
  }

  await writeOverlayFile(REPOSITORY_ROOT, file);
  console.log(`overlay: ${overlayFilePath(REPOSITORY_ROOT)}`);
  console.log(`seeded: ${inserted} inserted, ${skipped} skipped (${Object.keys(seeds).length} in source)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
