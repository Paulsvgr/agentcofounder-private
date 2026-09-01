import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getRunOverlayFromFile,
  mergeSeedIntoOverlay,
  overlayEntryFromSeed,
  overlayFilePath,
  patchRunOverlay,
  readOverlayFile,
  RUNS_OVERLAY_SCHEMA,
  type RunsOverlayFile,
} from "../server/run-overlay.js";
import { summarizeRun } from "../server/runs.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNS_ROOT = path.join(REPO_ROOT, "artifacts", "runs");
const ANALYSIS_ROOT = path.join(REPO_ROOT, "artifacts", "analysis");

describe("run overlay", () => {
  it("patches overlay and validates rating", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "overlay-test-"));
    try {
      await expect(
        patchRunOverlay(tempRoot, "2026-08-28T09-43-19-153Z", {
          human: { app_rating: 150 },
        }),
      ).rejects.toThrow(/app_rating/);

      const overlay = await patchRunOverlay(tempRoot, "2026-08-28T09-43-19-153Z", {
        author: "paul",
        classification: {
          line: "F",
          experiment: "exp3-test-treatment",
          run_index: 4,
          display_label: "F · exp3 test treatment · run 4",
        },
        human: {
          app_rubric: {
            usability_ux: 25,
            data_state_persistence: 15,
            robustness: 18,
            api_integration_readiness: 10,
            maintainability_extensibility: 12,
          },
          app_comment: "Solid app",
          run_comment: "Port conflict during verify",
        },
      });

      expect(overlay.author).toBe("paul");
      expect(overlay.human.app_rating).toBe(80);
      expect(overlay.human.app_rubric?.usability_ux).toBe(25);
      expect(overlay.classification?.display_label).toContain("exp3 test treatment");

      const file = await readOverlayFile(tempRoot, true);
      expect(file.runs["2026-08-28T09-43-19-153Z"]?.author).toBe("paul");
      expect(file.authors).toContain("paul");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("seeds classification entries without overwriting existing runs", () => {
    const store: RunsOverlayFile = {
      schema: RUNS_OVERLAY_SCHEMA,
      updated_at: new Date().toISOString(),
      authors: ["paul"],
      taxonomy: { line: ["F"], experiment: ["baseline"] },
      runs: {
        "existing-run": overlayEntryFromSeed("existing-run", {
          classification: { line: "F", experiment: "baseline", display_label: "keep me" },
        }),
      },
    };
    const result = mergeSeedIntoOverlay(store, {
      "existing-run": {
        classification: { line: "A", experiment: "unknown", display_label: "overwrite" },
      },
      "new-run": {
        classification: { line: "F", experiment: "exp3-test-treatment", display_label: "new" },
      },
    });
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(store.runs["existing-run"]?.classification?.display_label).toBe("keep me");
    expect(store.runs["new-run"]?.classification?.display_label).toBe("new");
  });

  it("merges overlay into run summary when repo overlay exists", async () => {
    try {
      await readFile(overlayFilePath(REPO_ROOT), "utf8");
    } catch {
      return;
    }

    const runId = "2026-08-28T09-43-19-153Z";
    const overlayFile = await readOverlayFile(REPO_ROOT);
    const entry = getRunOverlayFromFile(overlayFile, runId);
    if (!entry) return;

    const summary = await summarizeRun(RUNS_ROOT, ANALYSIS_ROOT, runId, undefined, entry);
    expect(summary.has_overlay).toBe(true);
    expect(summary.display_label).toBe(entry.classification?.display_label ?? null);
  });
});
