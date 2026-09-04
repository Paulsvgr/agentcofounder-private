#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREVIEW_JSON_FILENAME, writeAssemblerPreview } from "../src/v2/assembler-preview.js";
import {
  resolveTemplateOverlayConfigFromEnvironment,
  type TemplateOverlayConfig,
} from "../src/v2/template-overlays.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface ParsedArgs {
  idea: string;
  previewRootDirectory: string;
  overlayConfig: TemplateOverlayConfig;
  jsonOnly: boolean;
  help: boolean;
}

function printHelp(): void {
  console.log(`Usage: npm run preview:assembler -- [options]

Options:
  --idea <text>              App idea text (default: contract-public/development-idea.txt contents)
  --idea-file <path>         Read app idea from file
  --css on|off               CSS vocabulary overlay toggle
  --persistence on|off       Persistence overlay toggle
  --test-isolation on|off    Test isolation overlay toggle
  --tailwind on|off          Preinstalled Tailwind overlay toggle
  --api-client on|off        HTTP JSON client overlay toggle
  --stripe on|off            Stripe Checkout helper overlay toggle
  --out-dir <path>           Preview root (default: output/preview-{css}-{persistence}-{test-isolation}-{tailwind})
  --json                     Print preview.json to stdout only
  --help                     Show this help

Environment (alternative to --css / --persistence / --test-isolation / --tailwind / --api-client / --stripe):
  TEMPLATE_CSS_VOCABULARY=0|1
  TEMPLATE_PERSISTENCE=0|1
  TEMPLATE_TEST_ISOLATION=0|1
  TEMPLATE_TAILWIND=0|1
  TEMPLATE_API_CLIENT=0|1
  TEMPLATE_STRIPE=0|1
  HARNESS_OWNED_VERIFY=0|1
`);
}

function parseToggleValue(flag: string, value: string | undefined): boolean {
  if (value === undefined) throw new Error(`Missing value for ${flag}`);
  const normalized = value.trim().toLowerCase();
  if (normalized === "on" || normalized === "1" || normalized === "true") return true;
  if (normalized === "off" || normalized === "0" || normalized === "false") return false;
  throw new Error(`${flag} must be on|off`);
}

function defaultPreviewRootDirectory(config: TemplateOverlayConfig): string {
  const css = config.css_vocabulary ? "on" : "off";
  const persistence = config.persistence_primitive ? "on" : "off";
  const testIsolation = config.test_isolation ? "on" : "off";
  const tailwind = config.tailwind ? "on" : "off";
  return path.join(REPOSITORY_ROOT, "output", `preview-${css}-${persistence}-${testIsolation}-${tailwind}`);
}

async function parseArgs(argv: string[]): Promise<ParsedArgs> {
  let ideaFile = path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt");
  let ideaOverride: string | undefined;
  let previewRootDirectory: string | undefined;
  let jsonOnly = false;
  let help = false;
  let cssOverride: boolean | undefined;
  let persistenceOverride: boolean | undefined;
  let testIsolationOverride: boolean | undefined;
  let tailwindOverride: boolean | undefined;
  let apiClientOverride: boolean | undefined;
  let stripeOverride: boolean | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      help = true;
      continue;
    }
    if (argument === "--json") {
      jsonOnly = true;
      continue;
    }
    if (argument === "--idea") {
      ideaOverride = argv[index + 1];
      if (!ideaOverride) throw new Error("Missing value for --idea");
      index += 1;
      continue;
    }
    if (argument === "--idea-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --idea-file");
      ideaFile = path.resolve(REPOSITORY_ROOT, value);
      index += 1;
      continue;
    }
    if (argument === "--out-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out-dir");
      previewRootDirectory = path.resolve(REPOSITORY_ROOT, value);
      index += 1;
      continue;
    }
    if (argument === "--css") {
      cssOverride = parseToggleValue("--css", argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--persistence") {
      persistenceOverride = parseToggleValue("--persistence", argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--test-isolation") {
      testIsolationOverride = parseToggleValue("--test-isolation", argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--tailwind") {
      tailwindOverride = parseToggleValue("--tailwind", argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--api-client") {
      apiClientOverride = parseToggleValue("--api-client", argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--stripe") {
      stripeOverride = parseToggleValue("--stripe", argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (cssOverride !== undefined) {
    process.env.TEMPLATE_CSS_VOCABULARY = cssOverride ? "1" : "0";
  }
  if (persistenceOverride !== undefined) {
    process.env.TEMPLATE_PERSISTENCE = persistenceOverride ? "1" : "0";
  }
  if (testIsolationOverride !== undefined) {
    process.env.TEMPLATE_TEST_ISOLATION = testIsolationOverride ? "1" : "0";
  }
  if (tailwindOverride !== undefined) {
    process.env.TEMPLATE_TAILWIND = tailwindOverride ? "1" : "0";
  }
  if (apiClientOverride !== undefined) {
    process.env.TEMPLATE_API_CLIENT = apiClientOverride ? "1" : "0";
  }
  if (stripeOverride !== undefined) {
    process.env.TEMPLATE_STRIPE = stripeOverride ? "1" : "0";
  }

  const overlayConfig = resolveTemplateOverlayConfigFromEnvironment();
  const idea = ideaOverride ?? (await readFile(ideaFile, "utf8"));
  return {
    idea,
    previewRootDirectory: previewRootDirectory ?? defaultPreviewRootDirectory(overlayConfig),
    overlayConfig,
    jsonOnly,
    help,
  };
}

async function main(): Promise<void> {
  const parsed = await parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const { payload, previewJsonPath } = await writeAssemblerPreview({
    repositoryRoot: REPOSITORY_ROOT,
    previewRootDirectory: parsed.previewRootDirectory,
    idea: parsed.idea,
    overlayConfig: parsed.overlayConfig,
  });

  if (parsed.jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Preview root: ${parsed.previewRootDirectory}`);
  console.log(`Assembled app: ${payload.app_directory}`);
  console.log(`Preview metadata: ${previewJsonPath}`);
  console.log(`Assembled tree hash: ${payload.template_overlays.assembled_tree_hash}`);
  console.log(
    `Config: css=${String(parsed.overlayConfig.css_vocabulary)} persistence=${String(parsed.overlayConfig.persistence_primitive)} test_isolation=${String(parsed.overlayConfig.test_isolation)}`,
  );
  console.log(`Preview JSON filename: ${PREVIEW_JSON_FILENAME}`);
}

await main();
