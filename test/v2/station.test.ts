import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG, configIdentity } from "../../src/v2/config.js";
import { buildCallLedger, CALL_LEDGER_SCHEMA, CLASSIFIER_VERSION, type CallLedger } from "../../src/v2/normalize.js";
import { EFFICIENCY_WEIGHTS } from "../../src/v2/weights.js";
import { RUN_MANIFEST_SCHEMA } from "../../src/v2/manifest.js";
import type { RunManifest } from "../../src/v2/manifest.js";
import {
  STATION_SCHEMA,
  buildStationReport,
  renderStationHtml,
} from "../../src/v2/station.js";
import { readRunResultOptional } from "../../src/v2/verification.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE_RUN = "2026-08-28T09-59-12-356Z";

function minimalManifest(runId: string): RunManifest {
  const identity = configIdentity(DEFAULT_CONFIG);
  return {
    schema: RUN_MANIFEST_SCHEMA,
    run_id: runId,
    created_at: "2026-08-28T10:21:11.512Z",
    git: { branch: "v2", commit: "abc123", dirty: false },
    idea: { file: "idea.txt", sha256: "test" },
    model: {
      provider: "zai",
      model: "glm-5.2",
      thinking: "off",
      max_tokens: null,
      context_window: null,
      timeout_ms: 900_000,
    },
    config: DEFAULT_CONFIG,
    config_schema_version: identity.config_schema_version,
    config_hash: identity.config_hash,
    template: {
      id: "baseline",
      tree_sha256: "abc123",
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
    experiment: { cohort: "v2-test", arm: "control", rep: 1, intervention: "baseline" },
    outcome: null,
  };
}

describe("buildStationReport", () => {
  it(`builds report and html for ${SAMPLE_RUN}`, async () => {
    const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", SAMPLE_RUN);
    try {
      await readFile(path.join(runDirectory, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const ledger = await buildCallLedger(runDirectory);
    const runResult = await readRunResultOptional(runDirectory);
    const report = buildStationReport(ledger, { manifest: null, runResult });

    expect(report.schema).toBe(STATION_SCHEMA);
    expect(report.manifest).toBeNull();
    expect(report.calls.length).toBe(ledger.calls.length);
    expect(report.activity_summary.length).toBeGreaterThan(0);
    expect(report.cumulative_series.at(-1)?.cumulative_weighted).toBe(
      report.totals.weighted_total,
    );

    const html = renderStationHtml(report);
    expect(html).toContain("Analysis station");
    expect(html).toContain(SAMPLE_RUN);
    expect(html).toContain('"manifest":null');
    expect(html).toContain("Run manifest (provenance)");
    expect(html).toContain("Verification & errors");
    expect(report.verification.source).toBeDefined();
  });

  it("embeds manifest provenance in report and html", () => {
    const ledger: CallLedger = {
      run_id: "test-run",
      schema: CALL_LEDGER_SCHEMA,
      source_events: "events.jsonl",
      classifier_version: CLASSIFIER_VERSION,
      weights: EFFICIENCY_WEIGHTS,
      reconciliation: { matched: true, fields: {} as CallLedger["reconciliation"]["fields"] },
      calls: [],
      activity_summary: [],
    };
    const manifest = minimalManifest("test-run");
    const report = buildStationReport(ledger, { manifest });

    expect(report.manifest?.config_hash).toBe(configIdentity(DEFAULT_CONFIG).config_hash);
    expect(report.manifest?.template.id).toBe("baseline");

    const html = renderStationHtml(report);
    expect(html).toContain("Run manifest (provenance)");
    expect(html).toContain("baseline");
    expect(html).toContain("v2-test");
    expect(html).toContain(report.manifest!.config_hash);
  });
});

describe("readRunManifestOptional", () => {
  it("returns null when manifest file is missing", async () => {
    const { readRunManifestOptional } = await import("../../src/v2/manifest.js");
    const root = await mkdtemp(path.join(os.tmpdir(), "station-manifest-"));
    try {
      await mkdir(path.join(root, "run-id"), { recursive: true });
      const loaded = await readRunManifestOptional(path.join(root, "run-id"));
      expect(loaded).toBeNull();
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("loads manifest when present", async () => {
    const { readRunManifestOptional } = await import("../../src/v2/manifest.js");
    const root = await mkdtemp(path.join(os.tmpdir(), "station-manifest-"));
    const runId = "2026-08-28T10-21-11-512Z";
    try {
      const runDir = path.join(root, runId);
      await mkdir(runDir, { recursive: true });
      await writeFile(
        path.join(runDir, "run-manifest.json"),
        `${JSON.stringify(minimalManifest(runId), null, 2)}\n`,
        "utf8",
      );
      const loaded = await readRunManifestOptional(runDir);
      expect(loaded?.run_id).toBe(runId);
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
