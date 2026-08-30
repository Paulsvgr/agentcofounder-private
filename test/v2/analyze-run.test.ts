import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeRun, formatAnalyzeSummary } from "../../src/v2/analyze-run.js";

describe("analyzeRun", () => {
  it("writes ledger and station artifacts for a run directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "analyze-run-"));
    const runId = "2026-08-30T10-00-00-000Z";
    const runDir = path.join(root, "artifacts", "runs", runId);
    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(
        path.join(runDir, "events.jsonl"),
        [
          JSON.stringify({
            type: "message_end",
            message: {
              role: "assistant",
              timestamp: 1_000,
              usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150 },
            },
          }),
        ].join("\n") + "\n",
        "utf8",
      );

      const result = await analyzeRun({ repositoryRoot: root, runDirectory: runDir });

      expect(result.runId).toBe(runId);
      expect(result.report.totals.model_calls).toBe(1);
      expect(formatAnalyzeSummary(result).some((line) => line.startsWith("wrote:"))).toBe(true);

      const stationJson = JSON.parse(await readFile(result.paths.stationJsonPath, "utf8")) as {
        run_id: string;
      };
      expect(stationJson.run_id).toBe(runId);
      expect(await readFile(result.paths.stationHtmlPath, "utf8")).toContain("Analysis station");
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
