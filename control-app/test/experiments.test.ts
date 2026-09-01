import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createExperiment,
  experimentFilePath,
  experimentsRoot,
  getExperiment,
  listExperiments,
  listExperimentsWithUsage,
  materializeExperiment,
  patchExperiment,
  seedExperimentsFromTaxonomy,
  validateExperimentId,
} from "../server/experiments.js";
import { patchRunOverlay, readOverlayFile, RUNS_OVERLAY_SCHEMA } from "../server/run-overlay.js";

describe("experiments catalog", () => {
  it("creates experiment folder and experiment.json", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-test-"));
    try {
      const record = await createExperiment(tempRoot, {
        id: "exp7-demo-treatment",
        title: "Exp 7 demo treatment",
        description: "Tests the experiments folder",
        created_by: "paul",
      });

      expect(record.id).toBe("exp7-demo-treatment");
      expect(record.title).toBe("Exp 7 demo treatment");

      const raw = JSON.parse(
        await readFile(experimentFilePath(tempRoot, "exp7-demo-treatment"), "utf8"),
      ) as { schema: string; id: string };
      expect(raw.schema).toBe("agentcofounder.experiment.v1");
      expect(raw.id).toBe("exp7-demo-treatment");

      const listed = await listExperiments(tempRoot, true);
      expect(listed.some((entry) => entry.id === "exp7-demo-treatment")).toBe(true);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects invalid experiment ids", () => {
    expect(() => validateExperimentId("Bad_Slug")).toThrow(/lowercase/);
    expect(() => validateExperimentId("")).toThrow();
  });

  it("seeds experiments from taxonomy ids", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-seed-"));
    try {
      const result = await seedExperimentsFromTaxonomy(tempRoot, ["baseline", "exp3-test-control"]);
      expect(result.created).toBe(2);
      expect(await getExperiment(tempRoot, "baseline")).not.toBeNull();
      expect(await getExperiment(tempRoot, "exp3-test-control")).not.toBeNull();
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("links run overlay to catalog experiment id", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-overlay-"));
    try {
      await createExperiment(tempRoot, { id: "exp3-test-treatment", title: "Exp 3 treatment" });
      const overlay = await patchRunOverlay(tempRoot, "2026-08-28T09-43-19-153Z", {
        experiment_id: "exp3-test-treatment",
        classification: { run_index: 2 },
      });
      expect(overlay.experiment_id).toBe("exp3-test-treatment");
      expect(overlay.classification?.experiment).toBe("exp3-test-treatment");
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects unknown experiment id on overlay patch", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-missing-"));
    try {
      await expect(
        patchRunOverlay(tempRoot, "2026-08-28T09-43-19-153Z", {
          experiment_id: "missing-experiment",
        }),
      ).rejects.toThrow(/Unknown experiment/);
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("merges catalog and used-only experiments with run counts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-merge-"));
    const runId = "2026-08-28T09-43-19-153Z";
    try {
      await createExperiment(tempRoot, { id: "exp3-test-treatment", title: "Catalog exp" });
      const overlay = {
        schema: RUNS_OVERLAY_SCHEMA,
        updated_at: new Date().toISOString(),
        authors: ["paul"],
        taxonomy: { line: ["F"], experiment: ["legacy-slug-only"] },
        runs: {
          [runId]: {
            author: "paul",
            git_branch: null,
            git_commit: null,
            experiment_id: null,
            classification: {
              line: "F",
              experiment: "legacy-slug-only",
              run_index: 1,
              display_label: "legacy · run 1",
            },
            human: { app_rubric: null, app_rating: null, app_comment: "", run_comment: "" },
            flags: { exclude_from_ranking: false },
            updated_at: new Date().toISOString(),
          },
        },
      };
      const slugMap = new Map<string, string | null>([[runId, "legacy-slug-only"]]);
      const merged = await listExperimentsWithUsage(tempRoot, overlay, slugMap);
      const usedOnly = merged.find((entry) => entry.id === "legacy-slug-only");
      const catalog = merged.find((entry) => entry.id === "exp3-test-treatment");
      expect(usedOnly?.source).toBe("used-only");
      expect(usedOnly?.run_count).toBe(1);
      expect(usedOnly?.has_catalog).toBe(false);
      expect(catalog?.has_catalog).toBe(true);
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("patches catalog experiment metadata", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-patch-"));
    try {
      await createExperiment(tempRoot, { id: "exp4-demo", title: "Before" });
      const updated = await patchExperiment(tempRoot, "exp4-demo", {
        title: "After",
        description: "Updated notes",
      });
      expect(updated.title).toBe("After");
      expect(updated.description).toBe("Updated notes");
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("materializes used-only slug into catalog folder", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "experiments-mat-"));
    try {
      const record = await materializeExperiment(tempRoot, "legacy-slug-only", {
        title: "Legacy slug",
      });
      expect(record.id).toBe("legacy-slug-only");
      expect(await getExperiment(tempRoot, "legacy-slug-only")).not.toBeNull();
    } finally {
      await rm(path.join(tempRoot, "artifacts"), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("experimentsRoot", () => {
  it("points under artifacts/experiments", () => {
    expect(experimentsRoot("/repo")).toBe(path.join("/repo", "artifacts", "experiments"));
  });
});
