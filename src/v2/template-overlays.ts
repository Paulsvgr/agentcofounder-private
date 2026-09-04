import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appTemplateCopyFilter } from "../prepare-output.js";
import { hashDirectoryTree, sha256Text, treeSha256 } from "./manifest.js";

export const ASSEMBLER_VERSION = "1.0.0";
export const TEMPLATE_OVERLAYS_SCHEMA = "agentcofounder.template_overlays.v1" as const;

export interface TemplateOverlayConfig {
  css_vocabulary: boolean;
  persistence_primitive: boolean;
  test_isolation: boolean;
  tailwind: boolean;
}

export interface OverlayFileEntry {
  source: string;
  target: string;
}

export interface OverlayManifest {
  overlay_id: string;
  version: string;
  content_hash?: string;
  files: OverlayFileEntry[];
  replaces: string[];
  agents_section_marker: string;
  guard_profile: string | null;
}

export interface TemplateOverlaysManifestBlock {
  schema: typeof TEMPLATE_OVERLAYS_SCHEMA;
  active: TemplateOverlayConfig;
  base_hash: string;
  overlay_hashes: Record<string, string>;
  active_set_hash: string;
  assembled_tree_hash: string;
  assembler_version: string;
}

export interface AssemblyRecord {
  config: TemplateOverlayConfig;
  outputDirectory: string;
  base_hash: string;
  overlay_hashes: Record<string, string>;
  active_set_hash: string;
  assembled_tree_hash: string;
  assembler_version: string;
}

export class OverlayCollisionError extends Error {
  constructor(
    public readonly overlayId: string,
    public readonly targetPath: string,
  ) {
    super(`Overlay "${overlayId}" targets occupied path "${targetPath}" without declaring it in replaces`);
    this.name = "OverlayCollisionError";
  }
}

export function assertOverlayTargetAllowed(
  overlayId: string,
  targetPath: string,
  occupied: ReadonlySet<string>,
  replaces: ReadonlySet<string>,
): void {
  if (occupied.has(targetPath) && !replaces.has(targetPath)) {
    throw new OverlayCollisionError(overlayId, targetPath);
  }
}

export const DEFAULT_TEMPLATE_OVERLAY_CONFIG: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: false,
};

const OVERLAY_DEFINITIONS = [
  { configKey: "css_vocabulary" as const, directoryName: "css-vocabulary-v1.1" },
  { configKey: "persistence_primitive" as const, directoryName: "persistence-v1" },
  { configKey: "test_isolation" as const, directoryName: "test-isolation-v1" },
  { configKey: "tailwind" as const, directoryName: "tailwind-v1" },
] as const;

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  throw new Error(`${name} must be 0/1, true/false, or yes/no`);
}

export function resolveTemplateOverlayConfigFromEnvironment(
  fallback: TemplateOverlayConfig = DEFAULT_TEMPLATE_OVERLAY_CONFIG,
): TemplateOverlayConfig {
  const config: TemplateOverlayConfig = {
    css_vocabulary: parseBooleanEnv("TEMPLATE_CSS_VOCABULARY", fallback.css_vocabulary),
    persistence_primitive: parseBooleanEnv("TEMPLATE_PERSISTENCE", fallback.persistence_primitive),
    test_isolation: parseBooleanEnv("TEMPLATE_TEST_ISOLATION", fallback.test_isolation),
    tailwind: parseBooleanEnv("TEMPLATE_TAILWIND", fallback.tailwind),
  };
  if (config.css_vocabulary && config.tailwind) {
    throw new Error("TEMPLATE_CSS_VOCABULARY and TEMPLATE_TAILWIND cannot both be enabled");
  }
  return config;
}

export function templateOverlayPaths(repositoryRoot: string): {
  baseDirectory: string;
  overlayRoot: string;
} {
  return {
    baseDirectory: path.join(repositoryRoot, "app-template-base"),
    overlayRoot: path.join(repositoryRoot, "overlays"),
  };
}

async function readOverlayManifest(overlayDirectory: string): Promise<OverlayManifest> {
  const raw = await readFile(path.join(overlayDirectory, "manifest.json"), "utf8");
  return JSON.parse(raw) as OverlayManifest;
}

function canonicalManifestJson(manifest: OverlayManifest): string {
  const { content_hash: _ignored, ...rest } = manifest;
  return JSON.stringify(rest);
}

function hashBuffer(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function framedTargetPath(targetPath: string, fileContents: Buffer): string {
  return `${targetPath}\0${hashBuffer(fileContents)}`;
}

export async function computeOverlayContentHash(overlayDirectory: string): Promise<string> {
  const manifest = await readOverlayManifest(overlayDirectory);
  const parts: string[] = [canonicalManifestJson(manifest)];

  const sortedFiles = [...manifest.files].sort((left, right) =>
    left.target < right.target ? -1 : left.target > right.target ? 1 : 0,
  );
  for (const fileEntry of sortedFiles) {
    const absolute = path.join(overlayDirectory, fileEntry.source);
    const contents = await readFile(absolute);
    parts.push(framedTargetPath(fileEntry.target, contents));
  }

  const agentsSection = await readFile(path.join(overlayDirectory, "agents.section.md"));
  parts.push(agentsSection.toString("utf8"));

  parts.push(manifest.guard_profile ?? "");

  return hashBuffer(parts.join(""));
}

export function computeActiveSetHash(input: {
  active: TemplateOverlayConfig;
  overlayIds: string[];
  overlayHashes: Record<string, string>;
}): string {
  const payload = {
    active: {
      css_vocabulary: input.active.css_vocabulary,
      persistence_primitive: input.active.persistence_primitive,
      test_isolation: input.active.test_isolation,
      tailwind: input.active.tailwind,
    },
    overlay_ids: [...input.overlayIds].sort(),
    overlay_hashes: Object.fromEntries(
      Object.entries(input.overlayHashes).sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    ),
  };
  return sha256Text(JSON.stringify(payload));
}

async function emptyDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

async function copyDirectoryTree(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await cp(sourceDirectory, destinationDirectory, {
    recursive: true,
    filter: appTemplateCopyFilter,
  });
}

async function listRelativeFilePaths(rootDirectory: string, prefix = ""): Promise<string[]> {
  const directory = prefix === "" ? rootDirectory : path.join(rootDirectory, prefix);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const paths: string[] = [];
  for (const entry of entries) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const absolute = path.join(rootDirectory, relative);
    if (!appTemplateCopyFilter(absolute)) continue;
    if (entry.isDirectory()) {
      paths.push(...(await listRelativeFilePaths(rootDirectory, relative)));
    } else if (entry.isFile()) {
      paths.push(relative);
    }
  }
  return paths;
}

async function mergeAgentsSection(agentsPath: string, sectionText: string): Promise<void> {
  const baseAgents = await readFile(agentsPath, "utf8");
  const trimmedBase = baseAgents.replace(/\s+$/, "");
  const trimmedSection = sectionText.replace(/^\s+/, "").replace(/\s+$/, "");
  await writeFile(agentsPath, `${trimmedBase}\n\n${trimmedSection}\n`, "utf8");
}

export async function assembleTemplate(
  config: TemplateOverlayConfig,
  repositoryRoot: string,
  outputDirectory: string,
): Promise<AssemblyRecord> {
  const { baseDirectory, overlayRoot } = templateOverlayPaths(repositoryRoot);
  await emptyDirectory(outputDirectory);
  await copyDirectoryTree(baseDirectory, outputDirectory);

  const occupied = new Set(await listRelativeFilePaths(outputDirectory));
  const overlayHashes: Record<string, string> = {};
  const activeOverlayIds: string[] = [];

  for (const definition of OVERLAY_DEFINITIONS) {
    if (!config[definition.configKey]) continue;

    const overlayDirectory = path.join(overlayRoot, definition.directoryName);
    const manifest = await readOverlayManifest(overlayDirectory);
    const replaceSet = new Set(manifest.replaces);
    const contentHash = await computeOverlayContentHash(overlayDirectory);

    overlayHashes[manifest.overlay_id] = contentHash;
    activeOverlayIds.push(manifest.overlay_id);

    for (const fileEntry of manifest.files) {
      assertOverlayTargetAllowed(manifest.overlay_id, fileEntry.target, occupied, replaceSet);
      const sourcePath = path.join(overlayDirectory, fileEntry.source);
      const destinationPath = path.join(outputDirectory, fileEntry.target);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await cp(sourcePath, destinationPath);
      occupied.add(fileEntry.target);
    }

    const agentsSection = await readFile(path.join(overlayDirectory, "agents.section.md"), "utf8");
    await mergeAgentsSection(path.join(outputDirectory, "AGENTS.md"), agentsSection);
  }

  const baseHash = treeSha256(await hashDirectoryTree(baseDirectory));
  const assembledTreeHash = treeSha256(await hashDirectoryTree(outputDirectory));
  const activeSetHash = computeActiveSetHash({
    active: config,
    overlayIds: activeOverlayIds,
    overlayHashes,
  });

  return {
    config,
    outputDirectory,
    base_hash: baseHash,
    overlay_hashes: overlayHashes,
    active_set_hash: activeSetHash,
    assembled_tree_hash: assembledTreeHash,
    assembler_version: ASSEMBLER_VERSION,
  };
}

export function toTemplateOverlaysManifestBlock(record: AssemblyRecord): TemplateOverlaysManifestBlock {
  return {
    schema: TEMPLATE_OVERLAYS_SCHEMA,
    active: { ...record.config },
    base_hash: record.base_hash,
    overlay_hashes: { ...record.overlay_hashes },
    active_set_hash: record.active_set_hash,
    assembled_tree_hash: record.assembled_tree_hash,
    assembler_version: record.assembler_version,
  };
}

export function cssVocabularyGuardsEnabled(config: TemplateOverlayConfig): boolean {
  return config.css_vocabulary;
}

export function tailwindOverlayEnabled(config: TemplateOverlayConfig): boolean {
  return config.tailwind;
}
