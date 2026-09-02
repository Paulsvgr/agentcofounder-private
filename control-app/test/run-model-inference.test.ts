import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  inferModelFromCallLog,
  inferModelFromEvents,
  resolveRunModel,
  splitModelLabel,
} from "../server/run-model-inference.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNS_ROOT = path.join(REPO_ROOT, "artifacts", "runs");

describe("run-model-inference", () => {
  it("splits provider/model labels", () => {
    expect(splitModelLabel("zai/glm-5.2")).toEqual({
      provider: "zai",
      model: "glm-5.2",
    });
    expect(splitModelLabel("berget/zai-org/GLM-5.2")).toEqual({
      provider: "berget",
      model: "zai-org/GLM-5.2",
    });
  });

  it("reads model from result call_log", () => {
    expect(
      inferModelFromCallLog([{ model: "zai/glm-5.2" }]),
    ).toEqual({
      provider: "zai",
      model: "glm-5.2",
    });
  });

  it("reads model from events head for legacy runs", async () => {
    const inferred = await inferModelFromEvents(
      path.join(RUNS_ROOT, "2026-08-18T21-06-12-451Z", "events.jsonl"),
    );
    expect(inferred.provider).toBe("berget");
    expect(inferred.model).toBe("Qwen/Qwen3.8-27B-FP8");
  });

  it("prefers manifest over call_log", async () => {
    const resolved = await resolveRunModel({
      manifestProvider: "zai",
      manifestModel: "glm-5.2",
      callLog: [{ model: "berget/other" }],
      eventsPath: path.join(RUNS_ROOT, "2026-08-18T21-06-12-451Z", "events.jsonl"),
    });
    expect(resolved).toEqual({ provider: "zai", model: "glm-5.2" });
  });

  it("falls back to call_log when manifest missing", async () => {
    const resolved = await resolveRunModel({
      manifestProvider: null,
      manifestModel: null,
      callLog: [{ model: "zai/glm-5.2" }],
      eventsPath: path.join(RUNS_ROOT, "2026-08-18T21-06-12-451Z", "events.jsonl"),
    });
    expect(resolved).toEqual({ provider: "zai", model: "glm-5.2" });
  });
});
