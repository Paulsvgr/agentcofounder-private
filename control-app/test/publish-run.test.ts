import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHackathonRunRecord } from "../server/export-run.js";
import {
  buildSeedPayload,
  indexRunsByHarnessId,
  postRunToHackathon,
  publishRunToHackathon,
  resolveFrontendViewUrl,
} from "../server/publish-run.js";
import { RUNS_OVERLAY_SCHEMA } from "../server/run-overlay.js";

describe("publish-run", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds seed payload with manifest sibling on paste", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "publish-payload-"));
    const runId = "2026-08-30T14-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(
        path.join(root, "artifacts", "runs-overlay.json"),
        `${JSON.stringify({
          schema: RUNS_OVERLAY_SCHEMA,
          updated_at: "2026-08-30T14:00:00.000Z",
          authors: ["paul"],
          taxonomy: { line: ["F"], experiment: ["exp3-test-treatment"] },
          runs: {
            [runId]: {
              author: "paul",
              git_branch: "exp/test",
              git_commit: "deadbeef",
              experiment_id: "exp3-test-treatment",
              classification: {
                line: "F",
                experiment: "exp3-test-treatment",
                run_index: 2,
                display_label: "Exp3 treatment · run 2",
                legacy_approach: "exp3-treatment-2",
              },
              human: {
                app_rating: 7,
                app_comment: "Good",
                run_comment: "Notes",
              },
              flags: { exclude_from_ranking: false },
              updated_at: "2026-08-30T14:00:00.000Z",
            },
          },
        })}\n`,
        "utf8",
      );
      await writeFile(
        path.join(runDir, "run-manifest.json"),
        `${JSON.stringify({
          schema: "agentcofounder.run_manifest.v1",
          run_id: runId,
          created_at: "2026-08-30T14:00:00.000Z",
          git: { branch: "main", commit: "abc", dirty: false },
          model: { provider: "zai", model: "glm-5.2", thinking: "off" },
          config_hash: "hash",
          template: { id: "baseline", tree_sha256: "tree" },
          experiment: { cohort: "v2", arm: "control", rep: 2, intervention: null },
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
        })}\n`,
        "utf8",
      );

      const record = await buildHackathonRunRecord(
        path.join(root, "artifacts", "runs"),
        path.join(root, "artifacts", "analysis"),
        runId,
      );
      const payload = buildSeedPayload(record);

      expect(payload.author).toBe("paul");
      expect(payload.app_rating).toBe(7);
      expect(payload.paste.schema).toBe("agentcofounder.run_export.v2");
      expect(payload.paste.manifest).toBeTruthy();
      expect((payload.paste.meta as { classification?: { experiment?: string } }).classification?.experiment).toBe(
        "exp3-test-treatment",
      );
      expect(payload.overrides.run_id).toBe(runId);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("posts with X-Hackathon-Key header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "uuid-123" }), { status: 201 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const payload = {
      author: "paul",
      paste: { schema: "agentcofounder.run_export.v2", meta: { run_id: "x" } },
      overrides: { run_id: "x" },
      app_rating: null,
      app_comment: "",
      run_comment: "",
    };

    const result = await postRunToHackathon("https://example.test/hackathon", "secret-key", payload);
    expect(result.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/hackathon/api/v1/runs/");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Hackathon-Key"]).toBe("secret-key");
  });

  it("resolves frontend view URL from public runs list", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: "db-uuid-1",
            data: { run_id: "2026-08-30T10-00-00-000Z" },
          },
        ]),
        { status: 200 },
      ),
    ) as typeof fetch;

    const viewUrl = await resolveFrontendViewUrl(
      "2026-08-30T10-00-00-000Z",
      "https://example.test/hackathon",
      "https://frontend.test",
    );
    expect(viewUrl).toBe("https://frontend.test/runs/db-uuid-1");
  });

  it("indexes harness run ids from nested export meta", () => {
    const index = indexRunsByHarnessId([
      {
        id: "uuid-a",
        data: { export: { meta: { run_id: "2026-08-28T09-00-00-000Z" } } },
      },
    ]);
    expect(index.get("2026-08-28T09-00-00-000Z")).toBe("uuid-a");
  });

  it("publishRunToHackathon returns view URL on success", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "publish-run-"));
    const runId = "2026-08-30T15-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, "events.jsonl"), "{}\n", "utf8");

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/v1/runs/") && url.includes("GET")) {
          return new Response("[]", { status: 200 });
        }
        if (url.endsWith("/api/v1/runs/")) {
          return new Response(JSON.stringify({ id: "published-uuid" }), { status: 201 });
        }
        return new Response("not found", { status: 404 });
      }) as typeof fetch;

      const result = await publishRunToHackathon({
        runsRoot: path.join(root, "artifacts", "runs"),
        analysisRoot: path.join(root, "artifacts", "analysis"),
        runId,
        accessCode: "test-key",
        apiBase: "https://example.test/hackathon",
        frontendBase: "https://frontend.test",
      });

      expect(result.created).toBe(true);
      expect(result.view_url).toBe("https://frontend.test/runs/published-uuid");
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
