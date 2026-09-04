import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { hashDirectoryTree, treeSha256 } from "../../src/v2/manifest.js";
import {
  OverlayCollisionError,
  assertOverlayTargetAllowed,
  assembleTemplate,
  computeOverlayContentHash,
  cssVocabularyGuardsEnabled,
  resolveTemplateOverlayConfigFromEnvironment,
  templateOverlayPaths,
  type TemplateOverlayConfig,
} from "../../src/v2/template-overlays.js";
import { cssVocabularyGuardsEnabledFromEnvironment } from "../../solution/extensions/protected-paths.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  delete process.env.TEMPLATE_CSS_VOCABULARY;
  delete process.env.TEMPLATE_TEST_ISOLATION;
  delete process.env.TEMPLATE_TAILWIND;
  delete process.env.TEMPLATE_API_CLIENT;
  delete process.env.TEMPLATE_STRIPE;
});

async function tempOutputDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "template-assembler-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function treesMatch(leftRoot: string, rightRoot: string): Promise<boolean> {
  const leftHash = treeSha256(await hashDirectoryTree(leftRoot));
  const rightHash = treeSha256(await hashDirectoryTree(rightRoot));
  return leftHash === rightHash;
}

async function readAgents(root: string): Promise<string> {
  return readFile(path.join(root, "AGENTS.md"), "utf8");
}

const OFF_OFF: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: false,
  api_client: false,
  stripe: false,
};
const CSS_ON: TemplateOverlayConfig = {
  css_vocabulary: true,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: false,
  api_client: false,
  stripe: false,
};
const PERSISTENCE_ON: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: true,
  test_isolation: false,
  tailwind: false,
  api_client: false,
  stripe: false,
};
const BOTH_ON: TemplateOverlayConfig = {
  css_vocabulary: true,
  persistence_primitive: true,
  test_isolation: false,
  tailwind: false,
  api_client: false,
  stripe: false,
};
const Q2_ON: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: true,
  tailwind: false,
  api_client: false,
  stripe: false,
};
const TAILWIND_ON: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: false,
  test_isolation: false,
  tailwind: true,
  api_client: false,
  stripe: false,
};
const TAILWIND_PERSISTENCE: TemplateOverlayConfig = {
  css_vocabulary: false,
  persistence_primitive: true,
  test_isolation: false,
  tailwind: true,
  api_client: false,
  stripe: false,
};

const FROZEN_V22_SNAPSHOT = path.join(
  REPOSITORY_ROOT,
  "artifacts/runs/2026-08-31T21-16-45-263Z/app-template",
);
const CANONICAL_V22_BASE_HASH = "1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6";

describe("template assembler acceptance", () => {
  it("T0: app-template-base byte-matches frozen v2.2 baseline run snapshot", async () => {
    const { baseDirectory } = templateOverlayPaths(REPOSITORY_ROOT);
    expect(await treesMatch(FROZEN_V22_SNAPSHOT, baseDirectory)).toBe(true);
    const frozenHash = treeSha256(await hashDirectoryTree(FROZEN_V22_SNAPSHOT));
    const baseHash = treeSha256(await hashDirectoryTree(baseDirectory));
    expect(baseHash).toBe(CANONICAL_V22_BASE_HASH);
    expect(frozenHash).toBe(CANONICAL_V22_BASE_HASH);
    expect((await stat(path.join(FROZEN_V22_SNAPSHOT, "src/styles.css"))).size).toBe(966);
    expect((await stat(path.join(FROZEN_V22_SNAPSHOT, "AGENTS.md"))).size).toBe(1581);
  });

  it("T1: OFF/OFF byte-matches app-template-base", async () => {
    const { baseDirectory } = templateOverlayPaths(REPOSITORY_ROOT);
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(OFF_OFF, REPOSITORY_ROOT, outDir);

    expect(await treesMatch(baseDirectory, outDir)).toBe(true);
    expect(record.overlay_hashes).toEqual({});
    expect(record.assembled_tree_hash).toBe(CANONICAL_V22_BASE_HASH);
    expect((await stat(path.join(baseDirectory, "src/styles.css"))).size).toBe(966);
    expect((await stat(path.join(baseDirectory, "AGENTS.md"))).size).toBe(1581);
  });

  it("T2: persistence on adds lib files and AGENTS section without CSS contamination", async () => {
    const outDir = await tempOutputDirectory();
    await assembleTemplate(PERSISTENCE_ON, REPOSITORY_ROOT, outDir);

    const agents = await readAgents(outDir);
    expect(agents).toContain("## Collection persistence (preinstalled)");
    expect(agents).not.toContain("## CSS vocabulary (preinstalled)");

    await expect(stat(path.join(outDir, "src/lib/collectionStore.ts"))).resolves.toBeDefined();
    await expect(stat(path.join(outDir, "src/lib/useCollection.ts"))).resolves.toBeDefined();
    await expect(stat(path.join(outDir, "src/lib/text.ts"))).resolves.toBeDefined();
    expect((await stat(path.join(outDir, "src/styles.css"))).size).toBe(966);
    expect(cssVocabularyGuardsEnabled(PERSISTENCE_ON)).toBe(false);
  });

  it("T3: CSS on applies theme, AGENTS section, and guard config without persistence files", async () => {
    const outDir = await tempOutputDirectory();
    await assembleTemplate(CSS_ON, REPOSITORY_ROOT, outDir);

    const agents = await readAgents(outDir);
    expect(agents).toContain("## CSS vocabulary (preinstalled)");
    expect(agents).not.toContain("## Collection persistence (preinstalled)");
    expect((await stat(path.join(outDir, "src/styles.css"))).size).toBe(19941);

    const appSource = await readFile(path.join(outDir, "src/App.tsx"), "utf8");
    expect(appSource).toContain("ui-page");
    await expect(stat(path.join(outDir, "src/lib/collectionStore.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(cssVocabularyGuardsEnabled(CSS_ON)).toBe(true);
  });

  it("T4: both overlays compose with declared replaces honored", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(BOTH_ON, REPOSITORY_ROOT, outDir);

    const agents = await readAgents(outDir);
    expect(agents).toContain("## CSS vocabulary (preinstalled)");
    expect(agents).toContain("## Collection persistence (preinstalled)");
    expect((await stat(path.join(outDir, "src/styles.css"))).size).toBe(19941);
    await expect(stat(path.join(outDir, "src/lib/collectionStore.ts"))).resolves.toBeDefined();
    expect(Object.keys(record.overlay_hashes).sort()).toEqual(["css-vocabulary-v1.1", "persistence-v1"]);
  });

  it("T5: assembly is idempotent", async () => {
    const firstDir = await tempOutputDirectory();
    const secondDir = await tempOutputDirectory();
    const first = await assembleTemplate(BOTH_ON, REPOSITORY_ROOT, firstDir);
    const second = await assembleTemplate(BOTH_ON, REPOSITORY_ROOT, secondDir);
    expect(second.assembled_tree_hash).toBe(first.assembled_tree_hash);
    expect(second.active_set_hash).toBe(first.active_set_hash);
  });

  it("T6: disabled overlays leave no contamination markers or files", async () => {
    for (const config of [OFF_OFF, CSS_ON, PERSISTENCE_ON]) {
      const outDir = await tempOutputDirectory();
      await assembleTemplate(config, REPOSITORY_ROOT, outDir);
      const agents = await readAgents(outDir);

      if (!config.css_vocabulary) {
        expect(agents).not.toContain("## CSS vocabulary (preinstalled)");
        expect((await stat(path.join(outDir, "src/styles.css"))).size).toBe(966);
        expect(cssVocabularyGuardsEnabled(config)).toBe(false);
      }

      if (!config.persistence_primitive) {
        expect(agents).not.toContain("## Collection persistence (preinstalled)");
        await expect(stat(path.join(outDir, "src/lib/collectionStore.ts"))).rejects.toMatchObject({
          code: "ENOENT",
        });
      }

      if (!config.test_isolation) {
        expect(agents).not.toContain("## Test isolation (preinstalled)");
        await expect(stat(path.join(outDir, "src/test/memoryStorage.ts"))).rejects.toMatchObject({
          code: "ENOENT",
        });
      }

      if (!config.tailwind) {
        expect(agents).not.toContain("## Tailwind CSS (preinstalled)");
      }
    }
  });

  it("T9: tailwind on replaces styles/vite/package and adds AGENTS section", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(TAILWIND_ON, REPOSITORY_ROOT, outDir);
    const agents = await readAgents(outDir);
    const styles = await readFile(path.join(outDir, "src/styles.css"), "utf8");
    const pkg = JSON.parse(await readFile(path.join(outDir, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    const vite = await readFile(path.join(outDir, "vite.config.ts"), "utf8");

    expect(agents).toContain("## Tailwind CSS (preinstalled)");
    expect(agents).not.toContain("## CSS vocabulary (preinstalled)");
    expect(styles).toContain('@import "tailwindcss"');
    expect(pkg.devDependencies.tailwindcss).toBe("4.3.3");
    expect(pkg.devDependencies["@tailwindcss/vite"]).toBe("4.3.3");
    expect(vite).toContain("@tailwindcss/vite");
    expect(record.overlay_hashes).toEqual({
      "tailwind-v1": expect.any(String),
    });
  });

  it("T9b: tailwind + persistence compose without CSS vocabulary", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(TAILWIND_PERSISTENCE, REPOSITORY_ROOT, outDir);
    const agents = await readAgents(outDir);
    expect(agents).toContain("## Tailwind CSS (preinstalled)");
    expect(agents).toContain("## Collection persistence (preinstalled)");
    expect(agents).not.toContain("## CSS vocabulary (preinstalled)");
    await expect(stat(path.join(outDir, "src/lib/useCollection.ts"))).resolves.toBeDefined();
    expect(Object.keys(record.overlay_hashes).sort()).toEqual(["persistence-v1", "tailwind-v1"]);
  });

  it("rejects css vocabulary + tailwind together", () => {
    process.env.TEMPLATE_CSS_VOCABULARY = "1";
    process.env.TEMPLATE_TAILWIND = "1";
    expect(() =>
      resolveTemplateOverlayConfigFromEnvironment({
        css_vocabulary: false,
        persistence_primitive: false,
        test_isolation: false,
        tailwind: false,
        api_client: false,
        stripe: false,
      }),
    ).toThrow(/cannot both be enabled/);
    delete process.env.TEMPLATE_CSS_VOCABULARY;
    delete process.env.TEMPLATE_TAILWIND;
  });

  it("T8: test isolation on adds memoryStorage and AGENTS section without CSS or persistence contamination", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(Q2_ON, REPOSITORY_ROOT, outDir);

    const agents = await readAgents(outDir);
    expect(agents).toContain("## Test isolation (preinstalled)");
    expect(agents).toContain("createMemoryStorage()");
    expect(agents).not.toContain("## CSS vocabulary (preinstalled)");
    expect(agents).not.toContain("## Collection persistence (preinstalled)");
    expect((await stat(path.join(outDir, "src/styles.css"))).size).toBe(966);
    await expect(stat(path.join(outDir, "src/test/memoryStorage.ts"))).resolves.toBeDefined();
    await expect(stat(path.join(outDir, "src/lib/collectionStore.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(record.overlay_hashes).toEqual({
      "test-isolation-v1": expect.any(String),
    });
    expect(record.assembled_tree_hash).not.toBe(CANONICAL_V22_BASE_HASH);
  });

  it("T8b: Q2 OFF matches canonical v2.2 hash with zero test-isolation contamination", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(OFF_OFF, REPOSITORY_ROOT, outDir);

    expect(record.assembled_tree_hash).toBe(CANONICAL_V22_BASE_HASH);
    const agents = await readAgents(outDir);
    expect(agents).not.toContain("## Test isolation (preinstalled)");
    await expect(stat(path.join(outDir, "src/test/memoryStorage.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("T10: api-client overlay installs httpClient and AGENTS section", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate(
      { ...OFF_OFF, api_client: true },
      REPOSITORY_ROOT,
      outDir,
    );
    const agents = await readAgents(outDir);
    expect(agents).toContain("## HTTP API client (preinstalled)");
    await expect(stat(path.join(outDir, "src/lib/httpClient.ts"))).resolves.toBeDefined();
    expect(record.overlay_hashes).toEqual({ "api-client-v1": expect.any(String) });
    expect(record.assembled_tree_hash).not.toBe(CANONICAL_V22_BASE_HASH);
  });

  it("T11: stripe overlay installs stripeCheckout and AGENTS section", async () => {
    const outDir = await tempOutputDirectory();
    const record = await assembleTemplate({ ...OFF_OFF, stripe: true }, REPOSITORY_ROOT, outDir);
    const agents = await readAgents(outDir);
    expect(agents).toContain("## Stripe Checkout (preinstalled)");
    await expect(stat(path.join(outDir, "src/lib/stripeCheckout.ts"))).resolves.toBeDefined();
    expect(record.overlay_hashes).toEqual({ "stripe-v1": expect.any(String) });
  });

  it("T7: undeclared overlay collisions fail assembly", () => {
    const occupied = new Set(["src/App.tsx"]);
    expect(() =>
      assertOverlayTargetAllowed("bad-overlay", "src/App.tsx", occupied, new Set()),
    ).toThrow(OverlayCollisionError);
    expect(() =>
      assertOverlayTargetAllowed("css-vocabulary-v1.1", "src/App.tsx", occupied, new Set(["src/App.tsx"])),
    ).not.toThrow();
  });
});

describe("overlay content hashes", () => {
  it("computes stable overlay content hashes", async () => {
    const { overlayRoot } = templateOverlayPaths(REPOSITORY_ROOT);
    const cssHash = await computeOverlayContentHash(path.join(overlayRoot, "css-vocabulary-v1.1"));
    const persistenceHash = await computeOverlayContentHash(path.join(overlayRoot, "persistence-v1"));
    expect(cssHash).toHaveLength(64);
    expect(persistenceHash).toHaveLength(64);
    expect(await computeOverlayContentHash(path.join(overlayRoot, "css-vocabulary-v1.1"))).toBe(cssHash);
  });
});

describe("guard env wiring", () => {
  it("maps overlay config to TEMPLATE_CSS_VOCABULARY env", () => {
    process.env.TEMPLATE_CSS_VOCABULARY = cssVocabularyGuardsEnabled(CSS_ON) ? "1" : "0";
    expect(cssVocabularyGuardsEnabledFromEnvironment()).toBe(true);
    process.env.TEMPLATE_CSS_VOCABULARY = cssVocabularyGuardsEnabled(OFF_OFF) ? "1" : "0";
    expect(cssVocabularyGuardsEnabledFromEnvironment()).toBe(false);
  });
});
