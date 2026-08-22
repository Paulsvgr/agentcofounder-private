import { describe, expect, it } from "vitest";
import { classifyPhaseHeuristic, weightedCost, WEIGHTS } from "../src/analyze-run.js";

describe("analyze-run weighting", () => {
  it("uses the contest formula with cacheWrite defaulting to 0", () => {
    expect(WEIGHTS.cacheWrite).toBe(0);
    expect(
      weightedCost({
        input_tokens: 100,
        output_tokens: 10,
        cache_read_tokens: 1000,
        cache_write_tokens: 50,
      }),
    ).toBe(100 + 10 * 3 + 1000 * 0.1);
  });
});

describe("classifyPhaseHeuristic", () => {
  it("labels recon for read/bash without tests", () => {
    expect(
      classifyPhaseHeuristic([
        { name: "read", detail: "SKILL.md", is_error: false },
        { name: "bash", detail: "ls -la", is_error: false },
      ]),
    ).toBe("recon");
  });

  it("labels test_debug for npm test", () => {
    expect(
      classifyPhaseHeuristic([{ name: "bash", detail: "npm test 2>&1 | tail -40", is_error: false }]),
    ).toBe("test_debug");
  });

  it("labels mixed when write and test share a turn", () => {
    expect(
      classifyPhaseHeuristic([
        { name: "write", detail: "src/App.tsx", is_error: false },
        { name: "bash", detail: "npm test", is_error: false },
      ]),
    ).toBe("mixed");
  });
});
