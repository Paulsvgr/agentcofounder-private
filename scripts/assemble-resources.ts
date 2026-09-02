import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_ROOT = path.join(REPOSITORY_ROOT, "resources", "registry");
const DEFAULT_TEMPLATE = path.join(REPOSITORY_ROOT, "app-template");

/** Experiment A v1 — raw shadcn UI slice (retired pilot). */
export const PRESET_UI_V1 = [
  "button",
  "input",
  "label",
  "card",
  "dialog",
  "select",
  "theme-default",
] as const;

/** Experiment A v2 — RETIRED. Preserved for git history; blocked in active assembler. */
export const PRESET_UI_V2 = [
  "lib-utils",
  "theme-default",
  "form-field",
  "select-field",
  "action-button",
  "confirm-dialog",
  "data-row",
  "data-list",
  "empty-state",
  "stat",
] as const;

/** Experiment C — UI v1 (shadcn) + local-storage-collection. */
export const PRESET_FULL_V1 = [...PRESET_UI_V1, "local-storage-collection"] as const;

const SMOKE_ROOT = path.join(REPOSITORY_ROOT, "resources", "smoke");
const FAMILY_CONTRACTS_PATH = path.join(REPOSITORY_ROOT, "resources", "contracts", "families.json");

type ResourceFile = {
  source: string;
  target: string;
};

type ResourceEntry = {
  schema?: string;
  id: string;
  type: string;
  tier?: "primitive" | "agent" | "recipe";
  family?: string;
  name: string;
  version?: string;
  content_hash?: string;
  files: ResourceFile[];
  npm_dependencies?: string[];
  registry_dependencies?: string[];
  import: string | null;
  setup: string | null;
  tiny_example: string;
  use_when: string[];
  constraints: string[];
  test_hint: string | null;
  full_docs_reference?: string | null;
  props_contract?: string[];
  adaptation_points?: string[];
  owned_mechanics?: string[];
  test_setup?: ResourceFile[];
};

type ResourceSelection = {
  schema: "agentcofounder.resource_selection.v1";
  registry_schema_version: "agentcofounder.resource.v1";
  preset: string | null;
  selected_resource_ids: string[];
  entries: Array<{
    id: string;
    type: string;
    content_hash: string;
  }>;
  resources_md_sha256: string;
  assembled_tree_sha256: string;
};

async function loadRegistryEntry(id: string): Promise<ResourceEntry> {
  const candidates = [
    path.join(REGISTRY_ROOT, "agent", `${id}.json`),
    path.join(REGISTRY_ROOT, "components", `${id}.json`),
    path.join(REGISTRY_ROOT, "themes", `${id}.json`),
    path.join(REGISTRY_ROOT, "data-patterns", `${id}.json`),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      return JSON.parse(raw) as ResourceEntry;
    } catch {
      continue;
    }
  }
  throw new Error(`Unknown resource id: ${id}`);
}

function resolveSelection(ids: string[]): string[] {
  const selected = new Set<string>();
  const queue = [...ids];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || selected.has(id)) continue;
    selected.add(id);
  }

  // Second pass to expand dependencies (needs loaded entries)
  return [...selected];
}

async function expandDependencies(ids: string[]): Promise<ResourceEntry[]> {
  const byId = new Map<string, ResourceEntry>();
  const queue = [...ids];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || byId.has(id)) continue;
    const entry = await loadRegistryEntry(id);
    byId.set(id, entry);
    for (const dep of entry.registry_dependencies ?? []) {
      if (!byId.has(dep)) queue.push(dep);
    }
  }

  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function hashEntry(entry: ResourceEntry): string {
  const { content_hash: _ignored, ...rest } = entry;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

function hashFileContents(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function registryPathForEntry(entry: ResourceEntry): string {
  if (entry.type === "theme") {
    return path.join(REGISTRY_ROOT, "themes", `${entry.id}.json`);
  }
  if (entry.tier === "agent") {
    return path.join(REGISTRY_ROOT, "agent", `${entry.id}.json`);
  }
  return path.join(REGISTRY_ROOT, "components", `${entry.id}.json`);
}

type FamilyContract = {
  props: string[];
  members: string[];
  test_rule: string;
  do_not: string[];
};

async function loadFamilyContracts(): Promise<Record<string, FamilyContract>> {
  const raw = await readFile(FAMILY_CONTRACTS_PATH, "utf8");
  return JSON.parse(raw) as Record<string, FamilyContract>;
}

function renderResourcesMarkdownV1(entries: ResourceEntry[]): string {
  const lines: string[] = [
    "# Available resources",
    "",
    "Pre-assembled slice for this template. Use these imports and patterns — do not reimplement.",
    "",
  ];

  for (const entry of entries) {
    if (entry.id === "lib-utils") continue;

    lines.push(`## ${entry.name}`, "");

    if (entry.import) {
      lines.push("Import:", `\`${entry.import}\``, "");
    }
    if (entry.setup) {
      lines.push("Setup:", entry.setup, "");
    }
    if (entry.tiny_example) {
      lines.push("Example:", `\`${entry.tiny_example}\``, "");
    }
    if (entry.use_when.length > 0) {
      lines.push(`Use for: ${entry.use_when.join(", ")}.`, "");
    }
    for (const constraint of entry.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push("");
    if (entry.test_hint) {
      lines.push(`Test: ${entry.test_hint}`, "");
    }
    lines.push("---", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

async function renderResourcesMarkdownV2(entries: ResourceEntry[]): Promise<string> {
  const families = await loadFamilyContracts();
  const agentEntries = entries.filter((entry) => entry.tier === "agent");
  const themeEntries = entries.filter((entry) => entry.type === "theme");

  const lines: string[] = [
    "# Available resources (agent components)",
    "",
    "Pre-assembled agent component slice. Compose these contracts — **do not** import `@/components/ui/*` or reimplement primitives.",
    "",
    "## Family contracts",
    "",
  ];

  const familyIds = [...new Set(agentEntries.map((entry) => entry.family).filter(Boolean))] as string[];
  for (const familyId of familyIds.sort()) {
    const contract = families[familyId];
    if (!contract) continue;
    lines.push(`### ${familyId}`, "");
    lines.push(`Props: ${contract.props.join(", ")}`, "");
    lines.push(`Members: ${contract.members.join(", ")}`, "");
    lines.push(`Test rule: ${contract.test_rule}`, "");
    for (const rule of contract.do_not) {
      lines.push(`- Do not: ${rule}`);
    }
    lines.push("");
  }

  for (const entry of themeEntries) {
    lines.push(`## ${entry.name}`, "");
    if (entry.setup) {
      lines.push("Setup:", entry.setup, "");
    }
    if (entry.tiny_example) {
      lines.push("Example:", `\`${entry.tiny_example}\``, "");
    }
    for (const constraint of entry.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push("", "---", "");
  }

  for (const entry of agentEntries) {
    lines.push(`## ${entry.name}`, "");
    if (entry.import) {
      lines.push("Import:", `\`${entry.import}\``, "");
    }
    if (entry.props_contract && entry.props_contract.length > 0) {
      const base = families[entry.family ?? ""]?.props ?? [];
      const delta = entry.props_contract.filter((prop) => !base.includes(prop));
      if (delta.length > 0) {
        lines.push(`Extra props: ${delta.join(", ")}`, "");
      }
    }
    if (entry.tiny_example) {
      lines.push("Example:", `\`${entry.tiny_example}\``, "");
    }
    if (entry.use_when.length > 0) {
      lines.push(`Use for: ${entry.use_when.join(", ")}.`, "");
    }
    for (const constraint of entry.constraints) {
      lines.push(`- ${constraint}`);
    }
    if (entry.test_hint) {
      lines.push("", `Test: ${entry.test_hint}`, "");
    }
    lines.push("---", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

async function renderResourcesMarkdown(entries: ResourceEntry[]): Promise<string> {
  if (entries.some((entry) => entry.tier === "agent")) {
    return renderResourcesMarkdownV2(entries);
  }
  return renderResourcesMarkdownV1(entries);
}

async function mergePackageDependencies(
  templateDir: string,
  entries: ResourceEntry[],
): Promise<void> {
  const packagePath = path.join(templateDir, "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const pinned: Record<string, string> = {
    clsx: "2.1.1",
    "tailwind-merge": "3.3.1",
    "class-variance-authority": "0.7.1",
    "@radix-ui/react-slot": "1.2.3",
    "@radix-ui/react-label": "2.1.7",
    "@radix-ui/react-dialog": "1.1.14",
    "@radix-ui/react-select": "2.2.5",
    tailwindcss: "3.4.17",
    postcss: "8.5.6",
    autoprefixer: "10.4.21",
  };

  const needed = new Set<string>();
  for (const entry of entries) {
    for (const dep of entry.npm_dependencies ?? []) {
      needed.add(dep);
    }
  }

  pkg.dependencies ??= {};
  pkg.devDependencies ??= {};

  for (const dep of needed) {
    const version = pinned[dep];
    if (!version) {
      throw new Error(`No pinned version for npm dependency: ${dep}`);
    }
    if (dep === "tailwindcss" || dep === "postcss" || dep === "autoprefixer") {
      pkg.devDependencies[dep] = version;
    } else {
      pkg.dependencies[dep] = version;
    }
  }

  for (const dep of Object.keys(pinned)) {
    if (!needed.has(dep)) {
      delete pkg.dependencies[dep];
      delete pkg.devDependencies[dep];
    }
  }

  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function ensurePathAliases(templateDir: string): Promise<void> {
  const aliasSnippet = `"@": path.resolve(__dirname, "./src")`;

  const patchConfig = async (fileName: string): Promise<void> => {
    const configPath = path.join(templateDir, fileName);
    let source = await readFile(configPath, "utf8");

    if (source.includes(aliasSnippet)) {
      return;
    }

    if (!source.includes("path.resolve")) {
      source = `import path from "node:path";\n${source}`;
    }

    source = source.replace(
      "export default defineConfig({",
      `export default defineConfig({\n  resolve: {\n    alias: {\n      ${aliasSnippet},\n    },\n  },`,
    );

    await writeFile(configPath, source, "utf8");
  };

  await patchConfig("vite.config.ts");
  await patchConfig("vitest.config.ts");

  const tsconfigPath = path.join(templateDir, "tsconfig.json");
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8")) as {
    compilerOptions: Record<string, unknown>;
  };
  tsconfig.compilerOptions.baseUrl = ".";
  tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
}

async function patchAgentsMd(templateDir: string): Promise<void> {
  const agentsPath = path.join(templateDir, "AGENTS.md");
  const agents = await readFile(agentsPath, "utf8");
  if (agents.includes("RESOURCES.md")) return;

  const pointer =
    "- Read `RESOURCES.md` for preinstalled UI components and theme tokens. Prefer those imports over custom components.\n";
  const updated = agents.replace(
    "- Keep the application self-contained",
    `${pointer}- Keep the application self-contained`,
  );
  await writeFile(agentsPath, updated, "utf8");
}

async function cleanupLegacyUiSlice(templateDir: string): Promise<void> {
  await rm(path.join(templateDir, "src/components/ui"), { recursive: true, force: true });
  await rm(path.join(templateDir, "src/components/agent"), { recursive: true, force: true });
}

/** D1: resource smoke is verified by the assembler — never left in Pi workspace. */
async function ensureNoResourceSmokeInTemplate(templateDir: string): Promise<void> {
  await rm(path.join(templateDir, "src/resource-smoke"), { recursive: true, force: true });
}

async function ensureBaselineTestScript(templateDir: string): Promise<void> {
  const packagePath = path.join(templateDir, "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (pkg.scripts?.["smoke:resources"]) {
    delete pkg.scripts["smoke:resources"];
    await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
}

function runResourceSmokeGate(templateDir: string): void {
  execSync("npx vitest run --config vitest.config.ts", {
    cwd: SMOKE_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      SMOKE_TEMPLATE_DIR: templateDir,
    },
  });
}

async function assemble(options: {
  ids: string[];
  templateDir: string;
  preset: string | null;
  writeRegistryHashes: boolean;
  runSmoke: boolean;
}): Promise<ResourceSelection> {
  const entries = await expandDependencies(options.ids);
  const selectedIds = entries.map((entry) => entry.id);

  const isAgentSlice = entries.some((entry) => entry.tier === "agent");
  await ensureNoResourceSmokeInTemplate(options.templateDir);
  await ensureBaselineTestScript(options.templateDir);

  if (isAgentSlice) {
    await cleanupLegacyUiSlice(options.templateDir);
  }

  const fileHashes: string[] = [];
  const copiedTargets = new Map<string, string>();

  for (const entry of entries) {
    for (const file of entry.files) {
      const sourcePath = path.join(REPOSITORY_ROOT, file.source);
      const targetPath = path.join(options.templateDir, file.target);
      if (copiedTargets.has(file.target)) continue;

      await mkdir(path.dirname(targetPath), { recursive: true });
      await cp(sourcePath, targetPath);
      const contents = await readFile(targetPath, "utf8");
      fileHashes.push(hashFileContents(contents));
      copiedTargets.set(file.target, file.source);
    }
  }

  await mergePackageDependencies(options.templateDir, entries);
  await ensurePathAliases(options.templateDir);
  await patchAgentsMd(options.templateDir);

  const resourcesMd = await renderResourcesMarkdown(entries);
  const resourcesMdPath = path.join(options.templateDir, "RESOURCES.md");
  await writeFile(resourcesMdPath, resourcesMd, "utf8");

  const resourcesMdSha = hashFileContents(resourcesMd);
  const treeSha = createHash("sha256").update(fileHashes.sort().join("\n")).digest("hex");

  const selectionEntries = entries.map((entry) => {
    const contentHash = hashEntry(entry);
    return { id: entry.id, type: entry.type, content_hash: contentHash };
  });

  if (options.writeRegistryHashes) {
    for (const entry of entries) {
      const registryPath = registryPathForEntry(entry);
      entry.content_hash = hashEntry(entry);
      await writeFile(registryPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    }
  }

  const selection: ResourceSelection = {
    schema: "agentcofounder.resource_selection.v1",
    registry_schema_version: "agentcofounder.resource.v1",
    preset: options.preset,
    selected_resource_ids: selectedIds,
    entries: selectionEntries,
    resources_md_sha256: resourcesMdSha,
    assembled_tree_sha256: treeSha,
  };

  await writeFile(
    path.join(options.templateDir, "resource-selection.json"),
    `${JSON.stringify(selection, null, 2)}\n`,
    "utf8",
  );

  if (options.runSmoke && isAgentSlice) {
    console.log("Running resource smoke gate…");
    execSync("npm install", { cwd: options.templateDir, stdio: "inherit" });
    runResourceSmokeGate(options.templateDir);
    execSync("npm run build", { cwd: options.templateDir, stdio: "inherit" });
    console.log("Resource smoke gate passed.");
  }

  return selection;
}

function printUsage(): void {
  console.error(`Usage:
  npm run assemble:resources -- --preset full-v1 [--template app-template]
  npm run assemble:resources -- --ids local-storage-collection [--write-hashes]

Presets:
  ui-v1     ${PRESET_UI_V1.join(", ")} (retired pilot)
  full-v1   ${PRESET_FULL_V1.join(", ")} (Experiment C)

Retired (see docs/v2/resources/experiment-a-v2-verdict.md):
  ui-v2  small agent-components — removed from active path`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let preset: string | null = null;
  let ids: string[] = [];
  let templateDir = DEFAULT_TEMPLATE;
  let writeRegistryHashes = false;
  let runSmoke = true;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--preset":
        preset = args[++i] ?? null;
        break;
      case "--ids":
        ids = (args[++i] ?? "").split(",").filter(Boolean);
        break;
      case "--template":
        templateDir = path.resolve(REPOSITORY_ROOT, args[++i] ?? "");
        break;
      case "--write-hashes":
        writeRegistryHashes = true;
        break;
      case "--no-smoke":
        runSmoke = false;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(2);
    }
  }

  if (preset === "ui-v2") {
    console.error(
      "Preset ui-v2 is retired (Experiment A v2 closed). See docs/v2/resources/experiment-a-v2-verdict.md",
    );
    process.exit(2);
  }

  if (preset === "ui-v1") {
    ids = [...PRESET_UI_V1];
    runSmoke = false;
  }

  if (preset === "full-v1") {
    ids = [...PRESET_FULL_V1];
    runSmoke = false;
  }

  if (ids.length === 0) {
    printUsage();
    process.exit(2);
  }

  // Validate ids exist before assembly
  resolveSelection(ids);

  const selection = await assemble({
    ids,
    templateDir,
    preset,
    writeRegistryHashes,
    runSmoke,
  });

  console.log(`Assembled ${selection.selected_resource_ids.length} resources → ${templateDir}`);
  console.log(`selected: ${selection.selected_resource_ids.join(", ")}`);
  console.log(`resources_md_sha256: ${selection.resources_md_sha256.slice(0, 12)}…`);
  console.log(`assembled_tree_sha256: ${selection.assembled_tree_sha256.slice(0, 12)}…`);
  console.log(`wrote: ${path.join(templateDir, "RESOURCES.md")}`);
  console.log(`wrote: ${path.join(templateDir, "resource-selection.json")}`);
  console.log("Next: npm --prefix app-template install && npm --prefix app-template run build");
}

await main();
