import { describe, expect, it } from "vitest";
import { deriveActionFlow, extractCallActionSignals } from "../src/action-flow.js";
import type { CallLedgerEntry } from "../src/analyze-run.js";

function call(
  index: number,
  tools: CallLedgerEntry["tools"],
  gap = 1,
): CallLedgerEntry {
  return {
    index,
    timestamp: "2026-08-20T21:51:00.000Z",
    seconds_since_start: index,
    gap_seconds: gap,
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 1000,
    cache_write_tokens: 0,
    reasoning_tokens: 0,
    total_tokens: 1150,
    weighted_cost: 100 + 150 + 100,
    cumulative_weighted: index * 350,
    stop_reason: "toolUse",
    tools,
    phase_heuristic: "mixed",
  };
}

describe("extractCallActionSignals", () => {
  it("detects app and test writes in the same call", () => {
    const signals = extractCallActionSignals(
      call(1, [
        { name: "write", detail: "/app/src/App.tsx", is_error: false },
        { name: "write", detail: "/app/src/App.test.tsx", is_error: false },
      ]),
    );
    expect(signals.writesAppFile).toBe(true);
    expect(signals.writesTestFile).toBe(true);
  });
});

describe("deriveActionFlow", () => {
  it("segments a clean inspect → build → test → green trajectory", () => {
    const calls = [
      call(1, [{ name: "read", detail: "SKILL.md", is_error: false }]),
      call(2, [{ name: "write", detail: "/app/src/App.tsx", is_error: false }]),
      call(3, [{ name: "write", detail: "/app/src/App.test.tsx", is_error: false }]),
      call(4, [{ name: "bash", detail: "npm test", is_error: false, test_passed: true }]),
      call(5, [{ name: "bash", detail: "npm run build", is_error: false }]),
      call(6, [{ name: "write", detail: "report.partial.json", is_error: false }]),
    ];

    const { segments, source } = deriveActionFlow(calls);
    expect(source).toBe("derived");
    expect(segments.map((segment) => segment.stage)).toEqual([
      "inspect",
      "build_app",
      "write_tests",
      "green_build",
      "report_final",
    ]);
    expect(segments.find((segment) => segment.stage === "green_build")?.call_count).toBe(2);
  });

  it("puts failed test runs into diagnose then repair_loop", () => {
    const calls = [
      call(1, [{ name: "write", detail: "/app/src/App.tsx", is_error: false }]),
      call(2, [{ name: "write", detail: "/app/src/App.test.tsx", is_error: false }]),
      call(3, [{ name: "bash", detail: "npm test 2>&1 | tail -40", is_error: true }]),
      call(4, [{ name: "write", detail: "/app/src/test/setup.ts", is_error: false }]),
      call(5, [{ name: "bash", detail: "npm test", is_error: false, test_passed: true }]),
    ];

    const { segments } = deriveActionFlow(calls);
    expect(segments.some((segment) => segment.stage === "diagnose")).toBe(true);
    expect(segments.some((segment) => segment.stage === "repair_loop")).toBe(true);
  });

  it("applies call_stage overrides", () => {
    const calls = [
      call(1, [{ name: "read", detail: "SKILL.md", is_error: false }]),
      call(2, [
        { name: "write", detail: "/app/src/App.tsx", is_error: false },
        { name: "write", detail: "/app/src/App.test.tsx", is_error: false },
      ]),
    ];

    const { segments, source } = deriveActionFlow(calls, {
      call_stage: { "2": "build_app" },
      notes: { build_app: "mega-call" },
    });
    expect(source).toBe("derived+override");
    expect(segments.find((segment) => segment.stage === "build_app")?.note).toBe("mega-call");
  });
});
