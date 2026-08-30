import { describe, expect, it } from "vitest";
import {
  collectExperimentMetadata,
  resolveExperimentId,
} from "../../src/v2/experiment-metadata.js";

describe("resolveExperimentId", () => {
  it("prefers id over legacy cohort", () => {
    expect(resolveExperimentId({ id: "planner-v1", cohort: "old-name", arm: null, rep: null, intervention: null })).toBe(
      "planner-v1",
    );
  });

  it("falls back to legacy cohort", () => {
    expect(resolveExperimentId({ cohort: "v2-baseline-lock", arm: "control", rep: 1, intervention: null })).toBe(
      "v2-baseline-lock",
    );
  });

  it("returns null when unset", () => {
    expect(resolveExperimentId(null)).toBeNull();
  });
});

describe("collectExperimentMetadata", () => {
  it("reads RUN_EXPERIMENT", () => {
    const previous = process.env.RUN_EXPERIMENT;
    process.env.RUN_EXPERIMENT = "phase-f-stack-lock";
    delete process.env.RUN_COHORT;
    try {
      expect(collectExperimentMetadata().id).toBe("phase-f-stack-lock");
    } finally {
      if (previous === undefined) delete process.env.RUN_EXPERIMENT;
      else process.env.RUN_EXPERIMENT = previous;
    }
  });

  it("falls back to RUN_COHORT", () => {
    const previousExperiment = process.env.RUN_EXPERIMENT;
    const previousCohort = process.env.RUN_COHORT;
    delete process.env.RUN_EXPERIMENT;
    process.env.RUN_COHORT = "legacy-cohort";
    try {
      expect(collectExperimentMetadata().id).toBe("legacy-cohort");
    } finally {
      if (previousExperiment === undefined) delete process.env.RUN_EXPERIMENT;
      else process.env.RUN_EXPERIMENT = previousExperiment;
      if (previousCohort === undefined) delete process.env.RUN_COHORT;
      else process.env.RUN_COHORT = previousCohort;
    }
  });
});
