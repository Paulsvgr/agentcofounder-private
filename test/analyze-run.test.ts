import { describe, expect, it } from "vitest";
import {
  bashTestOutputIndicatesFailure,
  bashTestOutputIndicatesSuccess,
  classifyPhaseHeuristic,
  isFullSuiteTestCommand,
  weightedCost,
  WEIGHTS,
} from "../src/analyze-run.js";

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

describe("bash test output parsing", () => {
  it("detects Vitest failures when piped through tail (exit code masked)", () => {
    const output = `
 Test Files  1 failed (1)
      Tests  7 failed | 4 passed (11)
   Duration  1.23s
`;
    expect(bashTestOutputIndicatesFailure(output)).toBe(true);
    expect(bashTestOutputIndicatesSuccess(output)).toBe(false);
  });

  it("detects all-green Vitest summary", () => {
    const output = `
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  1.05s
`;
    expect(bashTestOutputIndicatesFailure(output)).toBe(false);
    expect(bashTestOutputIndicatesSuccess(output)).toBe(true);
  });

  it("does not treat partial pass counts as all-green", () => {
    const output = `
      Tests  27 passed (33)
`;
    expect(bashTestOutputIndicatesSuccess(output)).toBe(false);
  });

  it("strips ANSI before matching", () => {
    const output = "\u001b[31m Test Files  1 failed (1)\u001b[0m";
    expect(bashTestOutputIndicatesFailure(output)).toBe(true);
  });
});

describe("isFullSuiteTestCommand", () => {
  it("accepts canonical npm test", () => {
    expect(isFullSuiteTestCommand("npm test")).toBe(true);
    expect(isFullSuiteTestCommand("cd /app && npm test 2>&1 | tail -40")).toBe(true);
    expect(isFullSuiteTestCommand("npx vitest run")).toBe(true);
  });

  it("rejects partial suite invocations", () => {
    expect(isFullSuiteTestCommand("npx vitest run src/db")).toBe(false);
    expect(isFullSuiteTestCommand('vitest -t "lends a book"')).toBe(false);
    expect(isFullSuiteTestCommand("vitest --changed")).toBe(false);
    expect(isFullSuiteTestCommand("vitest --project unit")).toBe(false);
    expect(isFullSuiteTestCommand("npm test -- App.test.tsx")).toBe(false);
  });
});
