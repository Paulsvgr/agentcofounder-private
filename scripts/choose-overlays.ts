#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseOverlaysFromIdea, formatOverlayChoice } from "../src/v2/overlay-chooser.js";
import { templateOverlayEnvOverrides } from "../src/v2/template-overlays.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function printHelp(): void {
  console.log(`Usage: npm run choose:overlays -- [options]

Dry-runs the config phase: shows which template overlays the harness would pick
for an idea, without preparing a workspace or spending tokens.

Options:
  --idea-file <path>  Read the idea from a file (default: contract-public/development-idea.txt)
  --idea <text>       Use inline idea text instead of a file
  --json              Print the machine-readable selection record
  --help              Show this help
`);
}

interface Arguments {
  ideaFile: string;
  ideaText: string | null;
  json: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Arguments {
  const parsed: Arguments = {
    ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
    ideaText: null,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      parsed.help = true;
      continue;
    }
    if (argument === "--json") {
      parsed.json = true;
      continue;
    }
    if (argument === "--idea-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--idea-file requires a path");
      parsed.ideaFile = path.resolve(REPOSITORY_ROOT, value);
      index += 1;
      continue;
    }
    if (argument === "--idea") {
      const value = argv[index + 1];
      if (!value) throw new Error("--idea requires text");
      parsed.ideaText = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const idea = args.ideaText ?? (await readFile(args.ideaFile, "utf8"));
  const choice = chooseOverlaysFromIdea(idea);
  const applied = { ...choice.config, ...templateOverlayEnvOverrides() };

  if (args.json) {
    console.log(JSON.stringify({ ...choice, applied }, null, 2));
    return;
  }

  console.log(formatOverlayChoice(choice));
  console.log(`Applied config: ${JSON.stringify(applied)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
