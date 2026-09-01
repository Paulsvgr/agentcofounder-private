import { describe, expect, it } from "vitest";
import {
  effectiveRatingForCompare,
  formatAppRating,
  rubricTotal,
  validateAppRubric,
} from "../shared/app-rubric.js";

describe("app-rubric", () => {
  it("computes rubric total when all categories are set", () => {
    const scores = validateAppRubric({
      usability_ux: 25,
      data_state_persistence: 15,
      robustness: 18,
      api_integration_readiness: 10,
      maintainability_extensibility: 12,
    });
    expect(rubricTotal(scores)).toBe(80);
  });

  it("returns null total for partial rubric", () => {
    const scores = validateAppRubric({
      usability_ux: 20,
      data_state_persistence: null,
      robustness: 10,
      api_integration_readiness: null,
      maintainability_extensibility: null,
    });
    expect(rubricTotal(scores)).toBeNull();
  });

  it("formats legacy 0-10 ratings", () => {
    expect(formatAppRating(8, null)).toBe("8/10 (legacy)");
  });

  it("normalizes legacy ratings for charts", () => {
    expect(effectiveRatingForCompare(8, null)).toBe(80);
    expect(effectiveRatingForCompare(82, null)).toBe(82);
  });

  it("rejects out-of-range category scores", () => {
    expect(() =>
      validateAppRubric({
        usability_ux: 31,
        data_state_persistence: 10,
        robustness: 10,
        api_integration_readiness: 5,
        maintainability_extensibility: 5,
      }),
    ).toThrow(/usability_ux/);
  });
});
