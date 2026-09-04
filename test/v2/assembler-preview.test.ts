import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PI_DOCUMENTATION_HEADING } from "../../solution/extensions/protected-paths.js";
import {
  PREVIEW_JSON_FILENAME,
  previewAssembler,
} from "../../src/v2/assembler-preview.js";
import {
  assembleTemplate,
  toTemplateOverlaysManifestBlock,
  type TemplateOverlayConfig,
} from "../../src/v2/template-overlays.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CANONICAL_V22_BASE_HASH = "1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6";
const temporaryDirectories: string[] = [];

const OFF_OFF: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: false,
};
const CSS_ON: TemplateOverlayConfig = {
  css_vocabulary: true,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: false,
};
const PERSISTENCE_ON: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: true,
  test_isolation: false,
  tailwind: false,
};
const BOTH_ON: TemplateOverlayConfig = {
  css_vocabulary: true,
  persistence_primitive: true,
  test_isolation: false,
  tailwind: false,
};
const Q2_ON: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: true,
  tailwind: false,
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function tempPreviewRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "assembler-preview-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function expectLibAbsent(appDirectory: string): Promise<void> {
  await expect(stat(path.join(appDirectory, "src/lib/collectionStore.ts"))).rejects.toMatchObject({
    code: "ENOENT",
  });
}

async function expectLibPresent(appDirectory: string): Promise<void> {
  await expect(stat(path.join(appDirectory, "src/lib/collectionStore.ts"))).resolves.toBeDefined();
  await expect(stat(path.join(appDirectory, "src/lib/useCollection.ts"))).resolves.toBeDefined();
  await expect(stat(path.join(appDirectory, "src/lib/text.ts"))).resolves.toBeDefined();
}

describe("assembler preview acceptance", () => {
  it("P1: OFF/OFF preview matches canonical v2.2 assembly and prompt contract", async () => {
    const previewRoot = await tempPreviewRoot();
    const standaloneDir = await tempPreviewRoot();
    const standaloneRecord = await assembleTemplate(OFF_OFF, REPOSITORY_ROOT, standaloneDir);

    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: OFF_OFF,
    });

    expect(payload.selected_config).toEqual(OFF_OFF);
    expect(payload.files.styles_css_bytes).toBe(966);
    expect(payload.files.agents_md).not.toContain("## CSS vocabulary (preinstalled)");
    expect(payload.files.agents_md).not.toContain("## Collection persistence (preinstalled)");
    expect(payload.files.agents_md).not.toContain("## Test isolation (preinstalled)");
    expect(payload.files.lib_paths).toEqual([]);
    expect(payload.template_overlays.assembled_tree_hash).toBe(CANONICAL_V22_BASE_HASH);
    expect(payload.template_overlays.assembled_tree_hash).toBe(standaloneRecord.assembled_tree_hash);
    expect(payload.file_tree).not.toContain(PREVIEW_JSON_FILENAME);
    expect(payload.prompt.raw_append_system_prompt.endsWith(payload.files.agents_md.trim())).toBe(true);
    expect(payload.prompt.effective_full_system_prompt).not.toContain(PI_DOCUMENTATION_HEADING);
    expect(payload.prompt.authoritative_system_prompt).toBe("effective_full_system_prompt");
    expect(payload.extensions.css_guards_enabled).toBe(false);
    expect(payload.extensions.runtime_env.TEMPLATE_CSS_VOCABULARY).toBe("0");
    expect(payload.extensions.extensions).toContain(
      path.join(REPOSITORY_ROOT, "solution", "extensions", "protected-paths.ts"),
    );
    expect(payload.extensions.extensions).toContain(
      path.join(REPOSITORY_ROOT, "solution", "extensions", "harness-owned-verify.ts"),
    );
    await expectLibAbsent(payload.app_directory);
    await expect(stat(path.join(previewRoot, PREVIEW_JSON_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("P2: CSS ON preview matches standalone assembly", async () => {
    const previewRoot = await tempPreviewRoot();
    const standaloneDir = await tempPreviewRoot();
    const standaloneRecord = await assembleTemplate(CSS_ON, REPOSITORY_ROOT, standaloneDir);

    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: CSS_ON,
    });

    expect(payload.files.styles_css_bytes).toBe(19941);
    expect(payload.files.app_tsx).toContain("ui-page");
    expect(payload.files.agents_md).toContain("## CSS vocabulary (preinstalled)");
    expect(payload.files.agents_md).not.toContain("## Collection persistence (preinstalled)");
    expect(payload.template_overlays.assembled_tree_hash).toBe(standaloneRecord.assembled_tree_hash);
    expect(payload.extensions.css_guards_enabled).toBe(true);
    expect(payload.extensions.runtime_env.TEMPLATE_CSS_VOCABULARY).toBe("1");
    await expectLibAbsent(payload.app_directory);
  });

  it("P3: persistence ON preview matches standalone assembly", async () => {
    const previewRoot = await tempPreviewRoot();
    const standaloneDir = await tempPreviewRoot();
    const standaloneRecord = await assembleTemplate(PERSISTENCE_ON, REPOSITORY_ROOT, standaloneDir);

    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: PERSISTENCE_ON,
    });

    expect(payload.files.styles_css_bytes).toBe(966);
    expect(payload.files.agents_md).toContain("## Collection persistence (preinstalled)");
    expect(payload.files.agents_md).not.toContain("## CSS vocabulary (preinstalled)");
    expect(payload.files.lib_paths.sort()).toEqual([
      "src/lib/collectionStore.ts",
      "src/lib/text.ts",
      "src/lib/useCollection.ts",
    ]);
    expect(payload.template_overlays.assembled_tree_hash).toBe(standaloneRecord.assembled_tree_hash);
    expect(payload.extensions.css_guards_enabled).toBe(false);
    await expectLibPresent(payload.app_directory);
  });

  it("P4: both overlays ON preview matches standalone assembly", async () => {
    const previewRoot = await tempPreviewRoot();
    const standaloneDir = await tempPreviewRoot();
    const standaloneRecord = await assembleTemplate(BOTH_ON, REPOSITORY_ROOT, standaloneDir);
    const standaloneBlock = toTemplateOverlaysManifestBlock(standaloneRecord);

    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: BOTH_ON,
    });

    expect(payload.files.styles_css_bytes).toBe(19941);
    expect(payload.files.agents_md).toContain("## CSS vocabulary (preinstalled)");
    expect(payload.files.agents_md).toContain("## Collection persistence (preinstalled)");
    expect(payload.template_overlays).toEqual(standaloneBlock);
    expect(payload.extensions.css_guards_enabled).toBe(true);
    await expectLibPresent(payload.app_directory);
  });

  it("Q2 OFF preview matches canonical v2.2 with no test-isolation contamination", async () => {
    const previewRoot = await tempPreviewRoot();
    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: OFF_OFF,
    });

    expect(payload.template_overlays.assembled_tree_hash).toBe(CANONICAL_V22_BASE_HASH);
    expect(payload.files.agents_md).not.toContain("## Test isolation (preinstalled)");
    expect(payload.file_tree).not.toContain("src/test/memoryStorage.ts");
  });

  it("Q2 ON preview adds memoryStorage and test-isolation AGENTS section only", async () => {
    const previewRoot = await tempPreviewRoot();
    const standaloneDir = await tempPreviewRoot();
    const standaloneRecord = await assembleTemplate(Q2_ON, REPOSITORY_ROOT, standaloneDir);

    const payload = await previewAssembler({
      repositoryRoot: REPOSITORY_ROOT,
      previewRootDirectory: previewRoot,
      idea: "Build a booking app",
      overlayConfig: Q2_ON,
    });

    expect(payload.selected_config).toEqual(Q2_ON);
    expect(payload.template_overlays.assembled_tree_hash).toBe(standaloneRecord.assembled_tree_hash);
    expect(payload.files.agents_md).toContain("## Test isolation (preinstalled)");
    expect(payload.files.agents_md).toContain("createMemoryStorage()");
    expect(payload.files.agents_md).not.toContain("## CSS vocabulary (preinstalled)");
    expect(payload.files.agents_md).not.toContain("## Collection persistence (preinstalled)");
    expect(payload.files.styles_css_bytes).toBe(966);
    expect(payload.file_tree).toContain("src/test/memoryStorage.ts");
    expect(payload.template_overlays.overlay_hashes).toEqual({
      "test-isolation-v1": expect.any(String),
    });
    await expectLibAbsent(payload.app_directory);
    await expect(stat(path.join(payload.app_directory, "src/test/memoryStorage.ts"))).resolves.toBeDefined();
  });

  it("writes preview.json beside hashed app tree, not inside it", async () => {
    const previewRoot = await tempPreviewRoot();
    const { payload, previewJsonPath } = await import("../../src/v2/assembler-preview.js").then((module) =>
      module.writeAssemblerPreview({
        repositoryRoot: REPOSITORY_ROOT,
        previewRootDirectory: previewRoot,
        idea: "Inspect environment",
        overlayConfig: OFF_OFF,
      }),
    );

    expect(previewJsonPath).toBe(path.join(previewRoot, PREVIEW_JSON_FILENAME));
    expect(payload.app_directory).toBe(path.join(previewRoot, "app"));
    expect(payload.file_tree).not.toContain(PREVIEW_JSON_FILENAME);
    const previewJson = JSON.parse(await readFile(previewJsonPath, "utf8")) as { schema: string };
    expect(previewJson.schema).toBe("agentcofounder.assembler_preview.v1");
    await expect(stat(path.join(payload.app_directory, PREVIEW_JSON_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
