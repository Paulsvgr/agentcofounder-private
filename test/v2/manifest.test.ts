import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { copyAppTemplateTree, prepareOutput } from "../../src/prepare-output.js";
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  configHash,
  configIdentity,
} from "../../src/v2/config.js";
import {
  buildPreRunManifest,
  buildRunManifestOutcome,
  collectModelSettings,
  finalizeRunManifest,
  hashDirectoryTree,
  readRunManifest,
  sha256Text,
  treeSha256,
  writeRunManifest,
} from "../../src/v2/manifest.js";
import type { UsageSummary } from "../../src/types.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("sha256Text", () => {
  it("hashes text deterministically", () => {
    expect(sha256Text("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("hashDirectoryTree", () => {
  it("produces a stable tree hash for the app template", async () => {
    const templateDirectory = path.join(REPOSITORY_ROOT, "app-template");
    const first = treeSha256(await hashDirectoryTree(templateDirectory));
    const second = treeSha256(await hashDirectoryTree(templateDirectory));
    expect(first).toBe(second);
    expect(first.length).toBe(64);
  });

  it("matches between source template and a copied snapshot", async () => {
    const sourceDirectory = path.join(REPOSITORY_ROOT, "app-template");
    const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), "manifest-template-"));
    temporaryDirectories.push(snapshotRoot);
    const snapshotDirectory = path.join(snapshotRoot, "app-template");
    await copyAppTemplateTree(sourceDirectory, snapshotDirectory, { writeMarker: false });

    const sourceHash = treeSha256(await hashDirectoryTree(sourceDirectory));
    const snapshotHash = treeSha256(await hashDirectoryTree(snapshotDirectory));
    expect(snapshotHash).toBe(sourceHash);
  });
});

describe("collectModelSettings", () => {
  it("records max_tokens and context_window when set", () => {
    const previous = {
      provider: process.env.CHALLENGE_PROVIDER,
      model: process.env.CHALLENGE_MODEL,
      thinking: process.env.CHALLENGE_THINKING,
      maxTokens: process.env.CHALLENGE_MAX_TOKENS,
      contextWindow: process.env.CHALLENGE_CONTEXT_WINDOW,
      timeout: process.env.CHALLENGE_TIMEOUT_MS,
    };

    process.env.CHALLENGE_PROVIDER = "zai";
    process.env.CHALLENGE_MODEL = "glm-5.2";
    process.env.CHALLENGE_THINKING = "off";
    process.env.CHALLENGE_MAX_TOKENS = "8192";
    process.env.CHALLENGE_CONTEXT_WINDOW = "128000";
    process.env.CHALLENGE_TIMEOUT_MS = "900000";

    try {
      expect(collectModelSettings()).toEqual({
        provider: "zai",
        model: "glm-5.2",
        thinking: "off",
        max_tokens: 8192,
        context_window: 128000,
        timeout_ms: 900000,
      });
    } finally {
      for (const [key, value] of Object.entries({
        CHALLENGE_PROVIDER: previous.provider,
        CHALLENGE_MODEL: previous.model,
        CHALLENGE_THINKING: previous.thinking,
        CHALLENGE_MAX_TOKENS: previous.maxTokens,
        CHALLENGE_CONTEXT_WINDOW: previous.contextWindow,
        CHALLENGE_TIMEOUT_MS: previous.timeout,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe("buildPreRunManifest", () => {
  it("captures baseline config identity and prompt hashes before Pi starts", async () => {
    const [systemPrompt, publicJourneys, agentsMd, ideaText] = await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, "solution", "system-prompt.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "contract-public", "journeys.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "app-template", "AGENTS.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"), "utf8"),
    ]);

    const runRoot = await mkdtemp(path.join(os.tmpdir(), "manifest-run-"));
    temporaryDirectories.push(runRoot);
    const runId = "2026-08-28T22-00-00-000Z";
    const runDirectory = path.join(runRoot, runId);
    const snapshotDirectory = path.join(runDirectory, "app-template");
    await mkdir(snapshotDirectory, { recursive: true });
    await copyAppTemplateTree(path.join(REPOSITORY_ROOT, "app-template"), snapshotDirectory, {
      writeMarker: false,
    });

    const manifest = await buildPreRunManifest({
      runId,
      repositoryRoot: REPOSITORY_ROOT,
      ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
      ideaText,
      templateSnapshotDirectory: snapshotDirectory,
      systemPrompt,
      publicJourneys,
      agentsMd,
    });

    const identity = configIdentity(DEFAULT_CONFIG);
    expect(manifest.schema).toBe("agentcofounder.run_manifest.v1");
    expect(manifest.outcome).toBeNull();
    expect(manifest.config).toEqual(DEFAULT_CONFIG);
    expect(manifest.config_schema_version).toBe(CONFIG_SCHEMA_VERSION);
    expect(manifest.config_hash).toBe(identity.config_hash);
    expect(manifest.template.id).toBe("baseline");
    expect(manifest.template.snapshot_dir).toBe("app-template");
    expect(manifest.template.file_count).toBeGreaterThan(0);
    expect(manifest.prompt.system_prompt_sha256).toBe(sha256Text(systemPrompt));
    expect(manifest.prompt.journeys_sha256).toBe(sha256Text(publicJourneys));
    expect(manifest.prompt.agents_md_sha256).toBe(sha256Text(agentsMd));
    expect(manifest.versions).toEqual({
      planner: null,
      assembler: null,
      guards: null,
      error_memory: null,
      resource_manifest: null,
    });
    expect(manifest.experiment).toEqual({
      id: null,
      arm: null,
      rep: null,
      intervention: null,
    });
  });

  it("round-trips through writeRunManifest and readRunManifest", async () => {
    const runRoot = await mkdtemp(path.join(os.tmpdir(), "manifest-roundtrip-"));
    temporaryDirectories.push(runRoot);
    const runDirectory = path.join(runRoot, "2026-08-28T22-00-00-001Z");
    await mkdir(path.join(runDirectory, "app-template"), { recursive: true });
    await writeFile(path.join(runDirectory, "app-template", "seed.txt"), "seed\n", "utf8");

    const manifest = await buildPreRunManifest({
      runId: path.basename(runDirectory),
      repositoryRoot: REPOSITORY_ROOT,
      ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
      ideaText: "Build a bookshelf",
      templateSnapshotDirectory: path.join(runDirectory, "app-template"),
      systemPrompt: "system",
      publicJourneys: "journeys",
      agentsMd: "agents",
    });

    await writeRunManifest(runDirectory, manifest);
    const loaded = await readRunManifest(runDirectory);
    expect(loaded).toEqual(manifest);
  });
});

describe("finalizeRunManifest", () => {
  it("fills outcome without touching result.json fields", async () => {
    const usage: UsageSummary = {
      model_calls: 2,
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 50,
      cache_write_tokens: 0,
      total_tokens: 170,
      reasoning_tokens: 0,
      cost_total: 0,
      call_log: [],
    };

    const outcome = buildRunManifestOutcome(
      { status: "success", pi_exit_code: 0 },
      usage,
      1234,
    );
    expect(outcome.weighted_cost).toBe(100 + 20 * 3 + 50 * 0.1);
    expect(outcome.wall_ms).toBe(1234);

    const runRoot = await mkdtemp(path.join(os.tmpdir(), "manifest-outcome-"));
    temporaryDirectories.push(runRoot);
    const runDirectory = path.join(runRoot, "2026-08-28T22-00-00-002Z");
    await mkdir(path.join(runDirectory, "app-template"), { recursive: true });
    await writeFile(path.join(runDirectory, "app-template", "seed.txt"), "seed\n", "utf8");

    const pre = await buildPreRunManifest({
      runId: path.basename(runDirectory),
      repositoryRoot: REPOSITORY_ROOT,
      ideaFile: path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
      ideaText: "Build a bookshelf",
      templateSnapshotDirectory: path.join(runDirectory, "app-template"),
      systemPrompt: "system",
      publicJourneys: "journeys",
      agentsMd: "agents",
    });
    const finalized = finalizeRunManifest(pre, outcome);
    expect(finalized.outcome).toEqual(outcome);
    expect(configHash(finalized.config)).toBe(configHash(DEFAULT_CONFIG));
  });
});

describe("prepare-only path", () => {
  it("still resets output from the same template without writing a manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "manifest-prepare-only-"));
    temporaryDirectories.push(root);
    await cp(path.join(REPOSITORY_ROOT, "app-template"), path.join(root, "app-template"), {
      recursive: true,
      filter: (source) => !source.split(path.sep).includes("node_modules"),
    });

    const output = await prepareOutput(root, "output/app");
    expect(await readFile(path.join(output, "AGENTS.md"), "utf8")).toContain(
      "Generated application contract",
    );
    await expect(readFile(path.join(output, "run-manifest.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
