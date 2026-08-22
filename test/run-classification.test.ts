import { describe, expect, it } from "vitest";
import { deriveRunClassification } from "../src/run-classification.js";

describe("deriveRunClassification", () => {
  it("maps labeled A-baseline cohort entries", () => {
    expect(
      deriveRunClassification({
        approach: "A-baseline-2",
        git_branch: "main",
        git_commit: "d0f0b49abc",
      }),
    ).toEqual({
      line: "A",
      experiment: "baseline",
      run_index: 2,
      display_label: "A · baseline · run 2",
    });
  });

  it("maps autoverify arms from approach prefix", () => {
    expect(
      deriveRunClassification({
        approach: "A-autoverify-owned-gated-1",
        git_branch: "exp/auto-verify",
        git_commit: "5e96941",
      }),
    ).toEqual({
      line: "A",
      experiment: "autoverify-gated",
      run_index: 1,
      display_label: "A · autoverify gated · run 1",
    });
  });

  it("falls back to stock A baseline from main commit", () => {
    expect(
      deriveRunClassification({
        approach: "base",
        git_branch: "main",
        git_commit: "d0f0b49abc",
      }),
    ).toEqual({
      line: "A",
      experiment: "baseline",
      run_index: null,
      display_label: "A · baseline",
    });
  });

  it("maps prime comparison lines", () => {
    expect(
      deriveRunClassification({
        approach: "A-prime-zai",
        git_branch: null,
        git_commit: null,
      }),
    ).toEqual({
      line: "A-prime",
      experiment: "prime-comparison",
      run_index: 1,
      display_label: "A-prime · prime comparison · run 1",
    });
  });

  it("honors explicit line/experiment overrides", () => {
    expect(
      deriveRunClassification({
        approach: "custom-label",
        git_branch: "main",
        git_commit: "abc",
        line: "B-prime",
        experiment: "legacy",
        run_index: 4,
      }),
    ).toEqual({
      line: "B-prime",
      experiment: "legacy",
      run_index: 4,
      display_label: "B-prime · legacy · run 4",
    });
  });
});
