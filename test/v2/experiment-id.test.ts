import { describe, expect, it } from "vitest";
import { assertValidExperimentId, isValidExperimentId } from "../../src/v2/experiment-id.js";

describe("experiment id validation", () => {
  it("accepts lowercase slugs with hyphens", () => {
    expect(isValidExperimentId("exp7-planner-treatment")).toBe(true);
    expect(isValidExperimentId("css-vocabulary-v1-1")).toBe(true);
  });

  it("rejects dots, uppercase, and empty ids", () => {
    expect(isValidExperimentId("css-vocabulary-v1.1")).toBe(false);
    expect(isValidExperimentId("Bad_Slug")).toBe(false);
    expect(isValidExperimentId("")).toBe(false);
    expect(() => assertValidExperimentId("css-vocabulary-v1.1")).toThrow(/lowercase/);
  });
});
