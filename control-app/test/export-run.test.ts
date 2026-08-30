import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildHackathonRunRecord, buildRunExportFromArtifacts } from "../server/export-run.js";
import { RUNS_OVERLAY_SCHEMA } from "../server/run-overlay.js";
import { EXPERIMENT_SCHEMA } from "../server/experiment-types.js";

describe("buildRunExportFromArtifacts", () => {
  it("builds v2 export with action flow from station.json", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "control-export-"));
    const runId = "2026-08-30T10-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    const analysisDir = path.join(root, "artifacts", "analysis", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await mkdir(analysisDir, { recursive: true });
      await writeFile(
        path.join(runDir, "run-manifest.json"),
        `${JSON.stringify({
          schema: "agentcofounder.run_manifest.v1",
          run_id: runId,
          created_at: "2026-08-30T10:00:00.000Z",
          git: { branch: "v2", commit: "abc123", dirty: false },
          model: { provider: "zai", model: "glm-5.2", thinking: "off" },
          config_hash: "hash",
          template: { id: "baseline", tree_sha256: "tree" },
          experiment: { cohort: "v2-test", arm: "control", rep: 1, intervention: "baseline" },
          outcome: {
            status: "success",
            pi_exit_code: 0,
            model_calls: 2,
            input_tokens: 100,
            output_tokens: 50,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            weighted_cost: 250,
            wall_ms: 5000,
          },
        })}\n`,
        "utf8",
      );
      await writeFile(
        path.join(analysisDir, "station.json"),
        `${JSON.stringify({
          run_id: runId,
          totals: {
            model_calls: 2,
            weighted_total: 250,
            input_tokens: 100,
            output_tokens: 50,
            cache_read_tokens: 0,
          },
          activity_summary: [
            { activity: "recon", call_count: 1, weighted_cost: 100, share_of_total: 0.4 },
            { activity: "source", call_count: 1, weighted_cost: 150, share_of_total: 0.6 },
          ],
          calls: [
            {
              index: 1,
              activity: "recon",
              weighted_cost: 100,
              input_tokens: 40,
              output_tokens: 10,
              cache_read_tokens: 0,
              seconds_since_start: 0,
            },
            {
              index: 2,
              activity: "source",
              weighted_cost: 150,
              input_tokens: 60,
              output_tokens: 40,
              cache_read_tokens: 0,
              seconds_since_start: 3,
            },
          ],
        })}\n`,
        "utf8",
      );

      const built = await buildRunExportFromArtifacts(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
      );
      expect(built.export.schema).toBe("agentcofounder.run_export.v2");
      expect(built.export.efficiency.action_flow.length).toBeGreaterThan(0);
      expect(built.export.meta.provider).toBe("zai");

      const record = await buildHackathonRunRecord(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
      );
      expect(record.id).toBe(runId);
      expect(record.data.manifest?.experiment.arm).toBe("control");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("builds a stub export for events-only run folders", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "control-export-events-"));
    const runId = "2026-08-28T09-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, "events.jsonl"), "{}\n", "utf8");

      const record = await buildHackathonRunRecord(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
        {
          run_id: runId,
          status: "incomplete",
          provider: null,
          model: null,
          thinking: null,
          model_calls: null,
          input_tokens: null,
          output_tokens: null,
          cache_read_tokens: null,
          weighted_cost: null,
          wall_ms: null,
          max_output_per_call: null,
          cohort: null,
          arm: null,
          rep: null,
          intervention: null,
          config_hash: null,
          has_manifest: false,
          has_result: false,
          has_analysis: false,
          has_sessions: false,
          can_replay: true,
          has_generated_app: false,
          generated_app_path: null,
          has_replay: false,
          replay_verdict: null,
          mega_call_flag: false,
          created_at: null,
          author: null,
          display_label: null,
          experiment_slug: null,
          app_rating: null,
          app_comment: null,
          run_comment: null,
          git_branch_overlay: null,
          has_overlay: false,
          exclude_from_ranking: false,
        },
      );

      expect(record.id).toBe(runId);
      expect(record.data.export.harness.status).toBe("incomplete");
    } finally {
      await rm(root, { recursive: true });
    }
  });
  it("prefers overlay classification and human fields over manifest on publish record", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "control-export-overlay-"));
    const runId = "2026-08-30T11-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    const analysisDir = path.join(root, "artifacts", "analysis", runId);
    const experimentDir = path.join(root, "artifacts", "experiments", "exp3-test-treatment");
    try {
      await mkdir(runDir, { recursive: true });
      await mkdir(analysisDir, { recursive: true });
      await mkdir(experimentDir, { recursive: true });
      await writeFile(
        path.join(experimentDir, "experiment.json"),
        `${JSON.stringify({
          schema: EXPERIMENT_SCHEMA,
          id: "exp3-test-treatment",
          title: "Exp3 test treatment",
          description: "",
          status: "active",
          cohort: "exp3",
          arms: ["control", "treatment"],
          tags: [],
          created_at: "2026-08-30T10:00:00.000Z",
          updated_at: "2026-08-30T10:00:00.000Z",
          created_by: null,
        })}
`,
        "utf8",
      );
      await writeFile(
        path.join(root, "artifacts", "runs-overlay.json"),
        `${JSON.stringify({
          schema: RUNS_OVERLAY_SCHEMA,
          updated_at: "2026-08-30T10:00:00.000Z",
          authors: ["paul"],
          taxonomy: { line: ["F"], experiment: ["exp3-test-treatment"] },
          runs: {
            [runId]: {
              author: "paul",
              git_branch: "exp/test-policy",
              git_commit: "deadbeef",
              experiment_id: "exp3-test-treatment",
              classification: {
                line: "F",
                experiment: "exp3-test-treatment",
                run_index: 4,
                display_label: "",
                legacy_approach: "test-policy-treatment-4",
              },
              human: {
                app_rating: 8,
                app_comment: "Solid app",
                run_comment: "Port conflict during verify",
              },
              flags: {
                exclude_from_ranking: false,
                hide_early_smoke: false,
                include_in_efficiency_compare: true,
              },
              updated_at: "2026-08-30T10:00:00.000Z",
            },
          },
        })}
`,
        "utf8",
      );
      await writeFile(
        path.join(runDir, "run-manifest.json"),
        `${JSON.stringify({
          schema: "agentcofounder.run_manifest.v1",
          run_id: runId,
          created_at: "2026-08-30T10:00:00.000Z",
          git: { branch: "main", commit: "abc123", dirty: false },
          model: { provider: "zai", model: "glm-5.2", thinking: "off" },
          config_hash: "hash",
          template: { id: "baseline", tree_sha256: "tree" },
          experiment: { cohort: "legacy-cohort", arm: "control", rep: 1, intervention: "baseline" },
          outcome: {
            status: "success",
            pi_exit_code: 0,
            model_calls: 1,
            input_tokens: 10,
            output_tokens: 5,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            weighted_cost: 25,
            wall_ms: 1000,
          },
        })}
`,
        "utf8",
      );

      const record = await buildHackathonRunRecord(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
      );

      expect(record.person).toBe("paul");
      expect(record.data.app_rating).toBe(8);
      expect(record.data.app_comment).toBe("Solid app");
      expect(record.data.run_comment).toBe("Port conflict during verify");
      expect(record.data.git_branch).toBe("exp/test-policy");
      expect(record.data.git_commit).toBe("deadbeef");
      expect(record.data.export.meta.classification?.experiment).toBe("exp3-test-treatment");
      expect(record.data.export.meta.classification?.line).toBe("F");
      expect(record.data.export.meta.classification?.run_index).toBe(4);
      expect(record.data.export.meta.classification?.display_label).toContain("Exp3 test treatment");
      expect(record.data.export.meta.classification?.legacy_approach).toBe("test-policy-treatment-4");
      expect(record.data.classification?.experiment).toBe("exp3-test-treatment");
      expect(record.data.human?.app_rating).toBe(8);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("falls back to manifest classification when overlay is absent", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "control-export-manifest-only-"));
    const runId = "2026-08-30T12-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(
        path.join(runDir, "run-manifest.json"),
        `${JSON.stringify({
          schema: "agentcofounder.run_manifest.v1",
          run_id: runId,
          created_at: "2026-08-30T12:00:00.000Z",
          git: { branch: "v2", commit: "abc123", dirty: false },
          model: { provider: "zai", model: "glm-5.2", thinking: "off" },
          config_hash: "hash",
          template: { id: "baseline", tree_sha256: "tree" },
          experiment: { cohort: "v2-test", arm: "control", rep: 2, intervention: null },
          outcome: {
            status: "success",
            pi_exit_code: 0,
            model_calls: 1,
            input_tokens: 10,
            output_tokens: 5,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            weighted_cost: 25,
            wall_ms: 1000,
          },
        })}
`,
        "utf8",
      );

      const built = await buildRunExportFromArtifacts(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
      );

      expect(built.export.meta.classification?.experiment).toBe("v2-test");
      expect(built.export.meta.classification?.display_label).toContain("control");
      expect(built.export.meta.classification?.display_label).toContain("rep 2");
    } finally {
      await rm(root, { recursive: true });
    }
  });

});
