import { describe, expect, it } from "vitest";
import {
  classifyCallActivity,
  isNpmTestCommand,
  summarizeActivities,
} from "../../src/v2/classify.js";
import { isCssPath } from "../../src/v2/source-paths.js";
import type { LedgerTool } from "../../src/v2/normalize.js";

function tool(partial: Partial<LedgerTool> & Pick<LedgerTool, "name">): LedgerTool {
  return {
    detail: "",
    is_error: false,
    paths: [],
    output: null,
    ...partial,
  };
}

describe("classifyCallActivity", () => {
  it("labels npm test bash as test", () => {
    const activity = classifyCallActivity([
      tool({ name: "bash", detail: "npm test", paths: [] }),
    ]);
    expect(activity).toBe("test");
  });

  it("labels write to tsx as source", () => {
    const activity = classifyCallActivity([
      tool({
        name: "write",
        detail: "output/app/src/App.tsx",
        paths: ["output/app/src/App.tsx"],
      }),
    ]);
    expect(activity).toBe("source");
  });

  it("labels css writes separately", () => {
    expect(isCssPath("output/app/src/styles.css")).toBe(true);
    const activity = classifyCallActivity([
      tool({
        name: "write",
        detail: "output/app/src/styles.css",
        paths: ["output/app/src/styles.css"],
      }),
    ]);
    expect(activity).toBe("css");
  });

  it("labels tool errors as repair", () => {
    const activity = classifyCallActivity([
      tool({ name: "unknown", detail: "", is_error: true }),
    ]);
    expect(activity).toBe("repair");
  });

  it("labels read-only exploration as recon", () => {
    const activity = classifyCallActivity([
      tool({ name: "read", detail: "output/app/package.json", paths: ["output/app/package.json"] }),
    ]);
    expect(activity).toBe("recon");
  });
});

describe("summarizeActivities", () => {
  it("aggregates weighted cost by activity", () => {
    const buckets = summarizeActivities([
      { activity: "source", weighted_cost: 100, input_tokens: 40, output_tokens: 10, cache_read_tokens: 50 },
      { activity: "test", weighted_cost: 50, input_tokens: 5, output_tokens: 5, cache_read_tokens: 0 },
      { activity: "source", weighted_cost: 50, input_tokens: 20, output_tokens: 10, cache_read_tokens: 20 },
    ]);
    expect(buckets[0]).toMatchObject({
      activity: "source",
      call_count: 2,
      weighted_cost: 150,
      input_tokens: 60,
      output_tokens: 20,
      cache_read_tokens: 70,
    });
    expect(buckets[0]?.input_share).toBeCloseTo(60 / 150);
    expect(buckets[0]?.cache_read_share).toBeCloseTo(70 / 150);
    expect(isNpmTestCommand("npm test")).toBe(true);
  });
});
