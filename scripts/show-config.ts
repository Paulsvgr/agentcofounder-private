/**
 * Print the resolved baseline config and its comparison identity.
 *
 * Usage:
 *   npm run config:show
 *   npm run config:show -- path/to/treatment.json
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configIdentity, loadConfigFile, resolveConfig } from "../src/v2/config.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

function printHelp(): void {
  console.log(`Usage: npm run config:show -- [config.json]

Prints the resolved harness config and its comparison identity.
Without a file argument, prints the coded baseline defaults.
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printHelp();
    process.exit(0);
  }
  if (args.length > 1) {
    printHelp();
    process.exit(2);
  }

  const config =
    args.length === 1 ? await loadConfigFile(path.resolve(args[0]!)) : resolveConfig();
  const identity = configIdentity(config);

  console.log(JSON.stringify({ config, identity }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
