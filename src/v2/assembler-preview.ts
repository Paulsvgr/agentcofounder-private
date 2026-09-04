import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appTemplateCopyFilter } from "../prepare-output.js";
import {
  buildChallengePromptBundle,
  loadChallengePromptSources,
  resolveChallengeExtensionResolution,
  resolvePiBuiltInSystemPrompt,
  type ChallengeExtensionResolution,
  type ChallengePromptBundle,
} from "./challenge-prompt.js";
import { resolveConfig, type HarnessConfig } from "./config.js";
import { hashDirectoryTree } from "./manifest.js";
import {
  assembleTemplate,
  toTemplateOverlaysManifestBlock,
  type AssemblyRecord,
  type TemplateOverlayConfig,
  type TemplateOverlaysManifestBlock,
} from "./template-overlays.js";

export const PREVIEW_JSON_FILENAME = "preview.json";

export interface AssemblerPreviewInput {
  repositoryRoot: string;
  previewRootDirectory: string;
  idea: string;
  overlayConfig: TemplateOverlayConfig;
  harnessConfig?: HarnessConfig;
}

export interface AssemblerPreviewFiles {
  app_tsx: string;
  styles_css: string;
  styles_css_bytes: number;
  agents_md: string;
  lib_paths: string[];
}

export interface AssemblerPreviewPayload {
  schema: "agentcofounder.assembler_preview.v1";
  idea: string;
  selected_config: TemplateOverlayConfig;
  app_directory: string;
  preview_root_directory: string;
  file_tree: string[];
  files: AssemblerPreviewFiles;
  prompt: ChallengePromptBundle & {
    authoritative_system_prompt: "effective_full_system_prompt";
  };
  extensions: ChallengeExtensionResolution;
  template_overlays: TemplateOverlaysManifestBlock;
  assembly_record: Pick<
    AssemblyRecord,
    "base_hash" | "overlay_hashes" | "active_set_hash" | "assembled_tree_hash" | "assembler_version"
  >;
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
  return paths.sort();
}

async function readPreviewFiles(appDirectory: string): Promise<AssemblerPreviewFiles> {
  const [appTsx, stylesCss, agentsMd] = await Promise.all([
    readFile(path.join(appDirectory, "src", "App.tsx"), "utf8"),
    readFile(path.join(appDirectory, "src", "styles.css"), "utf8"),
    readFile(path.join(appDirectory, "AGENTS.md"), "utf8"),
  ]);
  const stylesStat = await stat(path.join(appDirectory, "src", "styles.css"));
  const libRoot = path.join(appDirectory, "src", "lib");
  let libPaths: string[] = [];
  try {
    libPaths = (await listRelativeFilePaths(libRoot)).map((relative) => path.posix.join("src/lib", relative));
  } catch {
    libPaths = [];
  }

  return {
    app_tsx: appTsx,
    styles_css: stylesCss,
    styles_css_bytes: stylesStat.size,
    agents_md: agentsMd,
    lib_paths: libPaths,
  };
}

export async function previewAssembler(input: AssemblerPreviewInput): Promise<AssemblerPreviewPayload> {
  const harnessConfig = input.harnessConfig ?? resolveConfig();
  const appDirectory = path.join(input.previewRootDirectory, "app");
  await mkdir(input.previewRootDirectory, { recursive: true });

  const assemblyRecord = await assembleTemplate(input.overlayConfig, input.repositoryRoot, appDirectory);
  const templateOverlays = toTemplateOverlaysManifestBlock(assemblyRecord);
  const treeHashes = await hashDirectoryTree(appDirectory);
  if (treeHashes.size === 0) {
    throw new Error("Assembled preview app tree is empty");
  }
  if (templateOverlays.assembled_tree_hash !== assemblyRecord.assembled_tree_hash) {
    throw new Error("Preview tree hash does not match assembly record");
  }

  const agentsMd = await readFile(path.join(appDirectory, "AGENTS.md"), "utf8");
  const sources = await loadChallengePromptSources(input.repositoryRoot, agentsMd);
  const piBuiltInSystemPrompt = await resolvePiBuiltInSystemPrompt();
  const promptBundle = buildChallengePromptBundle({
    idea: input.idea,
    sources,
    piBuiltInSystemPrompt,
  });
  const extensions = resolveChallengeExtensionResolution(
    input.repositoryRoot,
    input.overlayConfig,
    harnessConfig,
  );

  const payload: AssemblerPreviewPayload = {
    schema: "agentcofounder.assembler_preview.v1",
    idea: input.idea.trim(),
    selected_config: { ...input.overlayConfig },
    app_directory: appDirectory,
    preview_root_directory: input.previewRootDirectory,
    file_tree: await listRelativeFilePaths(appDirectory),
    files: await readPreviewFiles(appDirectory),
    prompt: {
      ...promptBundle,
      authoritative_system_prompt: "effective_full_system_prompt",
    },
    extensions,
    template_overlays: templateOverlays,
    assembly_record: {
      base_hash: assemblyRecord.base_hash,
      overlay_hashes: assemblyRecord.overlay_hashes,
      active_set_hash: assemblyRecord.active_set_hash,
      assembled_tree_hash: assemblyRecord.assembled_tree_hash,
      assembler_version: assemblyRecord.assembler_version,
    },
  };

  return payload;
}

export async function writeAssemblerPreview(
  input: AssemblerPreviewInput,
): Promise<{ payload: AssemblerPreviewPayload; previewJsonPath: string }> {
  const payload = await previewAssembler(input);
  const previewJsonPath = path.join(input.previewRootDirectory, PREVIEW_JSON_FILENAME);
  await writeFile(previewJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { payload, previewJsonPath };
}
