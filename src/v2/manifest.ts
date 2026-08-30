import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../types.js";
import type { UsageSummary } from "../types.js";
import { appTemplateCopyFilter } from "../prepare-output.js";
import {
  CONFIG_SCHEMA_VERSION,
  type HarnessConfig,
  configHash,
  configIdentity,
  resolveConfig,
} from "./config.js";
import { weightedCost } from "./weights.js";
import type { ExperimentMetadata } from "./experiment-metadata.js";
import { collectExperimentMetadata } from "./experiment-metadata.js";

export type { ExperimentMetadata } from "./experiment-metadata.js";
export { collectExperimentMetadata, resolveExperimentId } from "./experiment-metadata.js";

export const RUN_MANIFEST_SCHEMA = "agentcofounder.run_manifest.v1" as const;
export const RUN_MANIFEST_FILENAME = "run-manifest.json";

const TREE_SKIP = new Set(["node_modules", "dist", ".agent-cofounder-output"]);

export interface GitProvenance {
  branch: string | null;
  commit: string | null;
  dirty: boolean;
}

export interface IdeaProvenance {
  file: string;
  sha256: string;
}

export interface ModelSettings {
  provider: string | null;
  model: string | null;
  thinking: string;
  max_tokens: number | null;
  context_window: number | null;
  timeout_ms: number;
}

export interface TemplateProvenance {
  id: string;
  tree_sha256: string;
  file_count: number;
  snapshot_dir: string;
}

export interface PromptProvenance {
  system_prompt_sha256: string;
  journeys_sha256: string;
  agents_md_sha256: string;
}

export interface VersionSlots {
  planner: string | null;
  assembler: string | null;
  guards: string | null;
  error_memory: string | null;
  resource_manifest: string | null;
}

export interface RunManifestOutcome {
  status: RunResult["status"];
  pi_exit_code: number;
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  weighted_cost: number;
  wall_ms: number;
}

export interface RunManifest {
  schema: typeof RUN_MANIFEST_SCHEMA;
  run_id: string;
  created_at: string;
  git: GitProvenance;
  idea: IdeaProvenance;
  model: ModelSettings;
  config: HarnessConfig;
  config_schema_version: typeof CONFIG_SCHEMA_VERSION;
  config_hash: string;
  template: TemplateProvenance;
  prompt: PromptProvenance;
  versions: VersionSlots;
  experiment: ExperimentMetadata;
  outcome: RunManifestOutcome | null;
}

export interface PreRunManifestInput {
  runId: string;
  repositoryRoot: string;
  ideaFile: string;
  ideaText: string;
  templateSnapshotDirectory: string;
  systemPrompt: string;
  publicJourneys: string;
  agentsMd: string;
  config?: HarnessConfig;
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function hashFile(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

/** Hash every file under a directory tree, excluding template install artifacts. */
export async function hashDirectoryTree(root: string, prefix = ""): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const directory = prefix === "" ? root : path.join(root, prefix);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return hashes;
  }

  for (const entry of entries) {
    if (TREE_SKIP.has(entry.name)) continue;
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const absolute = path.join(root, relative);
    if (!appTemplateCopyFilter(absolute)) continue;
    if (entry.isDirectory()) {
      for (const [nestedPath, nestedHash] of await hashDirectoryTree(root, relative)) {
        hashes.set(nestedPath, nestedHash);
      }
    } else if (entry.isFile()) {
      hashes.set(relative, await hashFile(absolute));
    }
  }

  return hashes;
}

export function treeSha256(hashes: Map<string, string>): string {
  const lines = [...hashes.entries()]
    .sort(([leftPath], [rightPath]) => (leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0))
    .map(([relativePath, fileHash]) => `${relativePath}:${fileHash}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function gitValue(repositoryRoot: string, args: string[]): string | null {
  try {
    const value = execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function collectGitProvenance(repositoryRoot: string): GitProvenance {
  const dirty =
    (gitValue(repositoryRoot, ["status", "--porcelain", "--untracked-files=no"]) ?? "").length > 0;
  return {
    branch: gitValue(repositoryRoot, ["branch", "--show-current"]),
    commit: gitValue(repositoryRoot, ["rev-parse", "HEAD"]),
    dirty,
  };
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return null;
  return value.trim();
}

function readOptionalPositiveInteger(name: string): number | null {
  const raw = readOptionalEnv(name);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export function collectModelSettings(): ModelSettings {
  const rawTimeout = process.env.CHALLENGE_TIMEOUT_MS ?? "900000";
  const timeout = Number(rawTimeout);
  if (!Number.isSafeInteger(timeout) || timeout < 1_000) {
    throw new Error("CHALLENGE_TIMEOUT_MS must be an integer of at least 1000");
  }

  return {
    provider: readOptionalEnv("CHALLENGE_PROVIDER"),
    model: readOptionalEnv("CHALLENGE_MODEL"),
    thinking: process.env.CHALLENGE_THINKING ?? "off",
    max_tokens: readOptionalPositiveInteger("CHALLENGE_MAX_TOKENS"),
    context_window: readOptionalPositiveInteger("CHALLENGE_CONTEXT_WINDOW"),
    timeout_ms: timeout,
  };
}

export function emptyVersionSlots(): VersionSlots {
  return {
    planner: null,
    assembler: null,
    guards: null,
    error_memory: null,
    resource_manifest: null,
  };
}

export async function buildPreRunManifest(input: PreRunManifestInput): Promise<RunManifest> {
  const config = input.config ?? resolveConfig();
  const identity = configIdentity(config);
  const templateHashes = await hashDirectoryTree(input.templateSnapshotDirectory);

  return {
    schema: RUN_MANIFEST_SCHEMA,
    run_id: input.runId,
    created_at: new Date().toISOString(),
    git: collectGitProvenance(input.repositoryRoot),
    idea: {
      file: input.ideaFile,
      sha256: sha256Text(input.ideaText),
    },
    model: collectModelSettings(),
    config,
    config_schema_version: identity.config_schema_version,
    config_hash: identity.config_hash,
    template: {
      id: config.template,
      tree_sha256: treeSha256(templateHashes),
      file_count: templateHashes.size,
      snapshot_dir: "app-template",
    },
    prompt: {
      system_prompt_sha256: sha256Text(input.systemPrompt),
      journeys_sha256: sha256Text(input.publicJourneys),
      agents_md_sha256: sha256Text(input.agentsMd),
    },
    versions: emptyVersionSlots(),
    experiment: collectExperimentMetadata(),
    outcome: null,
  };
}

export function buildRunManifestOutcome(
  result: Pick<RunResult, "status" | "pi_exit_code">,
  usage: UsageSummary,
  wallMs: number,
): RunManifestOutcome {
  return {
    status: result.status,
    pi_exit_code: result.pi_exit_code,
    model_calls: usage.model_calls,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cache_write_tokens: usage.cache_write_tokens,
    weighted_cost: weightedCost(usage),
    wall_ms: wallMs,
  };
}

export function finalizeRunManifest(
  manifest: RunManifest,
  outcome: RunManifestOutcome,
): RunManifest {
  return { ...manifest, outcome };
}

export function runManifestPath(runDirectory: string): string {
  return path.join(runDirectory, RUN_MANIFEST_FILENAME);
}

export async function writeRunManifest(
  runDirectory: string,
  manifest: RunManifest,
): Promise<string> {
  const manifestPath = runManifestPath(runDirectory);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

export async function readRunManifest(runDirectory: string): Promise<RunManifest> {
  const raw = await readFile(runManifestPath(runDirectory), "utf8");
  return JSON.parse(raw) as RunManifest;
}

/** Returns null when run-manifest.json is absent (historical runs). */
export async function readRunManifestOptional(runDirectory: string): Promise<RunManifest | null> {
  try {
    return await readRunManifest(runDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Guard against accidental config drift when wiring defaults into the runner. */
export function assertBaselineConfig(config: HarnessConfig): void {
  const baseline = resolveConfig();
  if (configHash(config) !== configHash(baseline)) {
    throw new Error("Run manifest config does not match coded baseline");
  }
}
