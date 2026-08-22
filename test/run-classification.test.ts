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

  it("maps Experiment 1 rtl arms", () => {
    expect(
      deriveRunClassification({
        approach: "rtl-control-3",
        git_branch: "setup/measure",
        git_commit: "5cf2b60",
      }),
    ).toEqual({
      line: "F",
      experiment: "exp1-rtl-control",
      run_index: 3,
      display_label: "F · exp1 rtl control · run 3",
    });
    expect(
      deriveRunClassification({
        approach: "rtl-cleanup-2",
        git_branch: "exp/rtl-cleanup",
        git_commit: "71c2586",
      }),
    ).toEqual({
      line: "F",
      experiment: "exp1-rtl-cleanup",
      run_index: 2,
      display_label: "F · exp1 rtl cleanup · run 2",
    });
  });

  it("maps Experiment 2 stop-rule arms", () => {
    expect(
      deriveRunClassification({
        approach: "stop-treatment-1",
        git_branch: "setup/measure",
        git_commit: "abc123",
      }),
    ).toEqual({
      line: "F",
      experiment: "exp2-stop-treatment",
      run_index: 1,
      display_label: "F · exp2 stop treatment · run 1",
    });
  });

  it("maps Experiment 3 test-policy arms", () => {
    expect(
      deriveRunClassification({
        approach: "test-policy-treatment-2",
        git_branch: "setup/measure",
        git_commit: "abc123",
      }),
    ).toEqual({
      line: "F",
      experiment: "exp3-test-treatment",
      run_index: 2,
      display_label: "F · exp3 test treatment · run 2",
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
