#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembleTemplate,
  resolveTemplateOverlayConfigFromEnvironment,
  toTemplateOverlaysManifestBlock,
} from "../src/v2/template-overlays.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function printHelp(): void {
  console.log(`Usage: npm run assemble:template -- [options]

Options:
  --out-dir <path>   Write assembled template here (default: output/assembled-template)
  --css              Enable CSS vocabulary overlay
  --persistence      Enable persistence primitive overlay
  --test-isolation   Enable test isolation overlay
  --tailwind         Enable preinstalled Tailwind overlay
  --api-client       Enable HTTP JSON client overlay
  --stripe           Enable Stripe Checkout helper overlay
  --help             Show this help

Environment (alternative to flags):
  TEMPLATE_CSS_VOCABULARY=0|1
  TEMPLATE_PERSISTENCE=0|1
  TEMPLATE_TEST_ISOLATION=0|1
  TEMPLATE_TAILWIND=0|1
  TEMPLATE_API_CLIENT=0|1
  TEMPLATE_STRIPE=0|1
`);
}

function parseArgs(argv: string[]): { outDir: string; help: boolean } {
  let outDir = path.join(REPOSITORY_ROOT, "output", "assembled-template");
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      help = true;
      continue;
    }
    if (argument === "--css") {
      process.env.TEMPLATE_CSS_VOCABULARY = "1";
      continue;
    }
    if (argument === "--persistence") {
      process.env.TEMPLATE_PERSISTENCE = "1";
      continue;
    }
    if (argument === "--test-isolation") {
      process.env.TEMPLATE_TEST_ISOLATION = "1";
      continue;
    }
    if (argument === "--tailwind") {
      process.env.TEMPLATE_TAILWIND = "1";
      continue;
    }
    if (argument === "--api-client") {
      process.env.TEMPLATE_API_CLIENT = "1";
      continue;
    }
    if (argument === "--stripe") {
      process.env.TEMPLATE_STRIPE = "1";
      continue;
    }
    if (argument === "--out-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out-dir");
      outDir = path.resolve(REPOSITORY_ROOT, value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { outDir, help };
}

async function main(): Promise<void> {
  const { outDir, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const config = resolveTemplateOverlayConfigFromEnvironment();
  const record = await assembleTemplate(config, REPOSITORY_ROOT, outDir);
  const block = toTemplateOverlaysManifestBlock(record);

  await mkdir(path.dirname(outDir), { recursive: true });
  await writeFile(
    path.join(outDir, ".assembly-record.json"),
    `${JSON.stringify(block, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(block, null, 2));
}

await main();
