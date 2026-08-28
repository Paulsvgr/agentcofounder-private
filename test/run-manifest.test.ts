import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RUN_MANIFEST_SCHEMA,
  loadRunManifestForExport,
  validateRunManifest,
} from "../src/run-manifest.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const RUN_ID = "2026-08-28T10-21-11-512Z";

function minimalManifest(runId: string, schema: string = RUN_MANIFEST_SCHEMA): Record<string, unknown> {
  return {
    schema,
    run_id: runId,
    created_at: "2026-08-28T10:21:11.512Z",
    git: { branch: "v2", commit: "abc123", dirty: false },
    idea: { file: "idea.txt", sha256: "deadbeef" },
    model: {
      provider: "zai",
      model: "glm-5.2",
      thinking: "off",
      max_tokens: null,
      context_window: null,
      timeout_ms: 900_000,
    },
    config: { template: "baseline", agent_test_authoring: true },
    config_schema_version: 1,
    config_hash: "51918298287b035971355e2721e229caf33293d52eb1d378979ac682eb7af321",
    template: {
      id: "baseline",
      tree_sha256: "abc",
      file_count: 10,
      snapshot_dir: "app-template",
    },
    prompt: {
      system_prompt_sha256: "a",
      journeys_sha256: "b",
      agents_md_sha256: "c",
    },
    versions: {
      planner: null,
      assembler: null,
      guards: null,
      error_memory: null,
      resource_manifest: null,
    },
    experiment: { cohort: null, arm: null, rep: null, intervention: null },
    outcome: null,
  };
}

describe("validateRunManifest", () => {
  it("accepts a valid manifest when run_id matches", () => {
    const validated = validateRunManifest(minimalManifest(RUN_ID), RUN_ID);
    expect(validated.schema).toBe(RUN_MANIFEST_SCHEMA);
    expect(validated.run_id).toBe(RUN_ID);
    expect(validated.config_hash).toBe(
      "51918298287b035971355e2721e229caf33293d52eb1d378979ac682eb7af321",
    );
  });

  it("throws on invalid schema", () => {
    expect(() =>
      validateRunManifest(minimalManifest(RUN_ID, "agentcofounder.run_manifest.v0"), RUN_ID),
    ).toThrow(/schema must be/);
  });

  it("throws when run_id does not match export run id", () => {
    expect(() => validateRunManifest(minimalManifest("other-run-id"), RUN_ID)).toThrow(
      /does not match export run/,
    );
  });
});

describe("loadRunManifestForExport", () => {
  it("returns null when run-manifest.json is missing", async () => {
    const runsRoot = await mkdtemp(path.join(os.tmpdir(), "ac-manifest-absent-"));
    temporaryDirectories.push(runsRoot);
    await mkdir(path.join(runsRoot, RUN_ID), { recursive: true });

    const loaded = await loadRunManifestForExport(runsRoot, RUN_ID);
    expect(loaded).toBeNull();
  });

  it("loads and validates manifest when present", async () => {
    const runsRoot = await mkdtemp(path.join(os.tmpdir(), "ac-manifest-present-"));
    temporaryDirectories.push(runsRoot);
    const runDirectory = path.join(runsRoot, RUN_ID);
    await mkdir(runDirectory, { recursive: true });
    await writeFile(
      path.join(runDirectory, "run-manifest.json"),
      `${JSON.stringify(minimalManifest(RUN_ID), null, 2)}\n`,
      "utf8",
    );

    const loaded = await loadRunManifestForExport(runsRoot, RUN_ID);
    expect(loaded?.run_id).toBe(RUN_ID);
    expect(loaded?.template).toEqual(
      expect.objectContaining({ id: "baseline", snapshot_dir: "app-template" }),
    );
  });

  it("throws on mismatched run_id in file", async () => {
    const runsRoot = await mkdtemp(path.join(os.tmpdir(), "ac-manifest-mismatch-"));
    temporaryDirectories.push(runsRoot);
    const runDirectory = path.join(runsRoot, RUN_ID);
    await mkdir(runDirectory, { recursive: true });
    await writeFile(
      path.join(runDirectory, "run-manifest.json"),
      `${JSON.stringify(minimalManifest("wrong-id"), null, 2)}\n`,
      "utf8",
    );

    await expect(loadRunManifestForExport(runsRoot, RUN_ID)).rejects.toThrow(/does not match export run/);
  });
});
