import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeExitCode,
  analyzeRun,
  formatAnalyzeSummary,
  resolveRunDirectory,
} from "../src/v2/analyze-run.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  const runDirectory = resolveRunDirectory(REPOSITORY_ROOT, runArg);
  const compareRunDirectory = compareArg
    ? resolveRunDirectory(REPOSITORY_ROOT, compareArg)
    : undefined;

  const result = await analyzeRun({
    repositoryRoot: REPOSITORY_ROOT,
    runDirectory,
    ...(compareRunDirectory === undefined ? {} : { compareRunDirectory }),
  });

  for (const line of formatAnalyzeSummary(result)) {
    console.log(line);
  }

  process.exit(analyzeExitCode(result));
}

await main();
