import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunResult } from "../../src/types.js";
import type { CallLedgerEntry } from "../../src/v2/normalize.js";
import {
  buildStationVerification,
  enrichVerificationDetails,
} from "../../src/v2/verification.js";

function minimalCall(overrides: Partial<CallLedgerEntry> = {}): CallLedgerEntry {
  return {
    index: 1,
    turn: 1,
    activity: "other",
    weighted_cost: 1,
    model: "test-model",
    input_tokens: 10,
    output_tokens: 5,
    cache_read_tokens: 0,
    seconds_since_start: 12.5,
    tools: [],
    ...overrides,
  };
}

describe("buildStationVerification", () => {
  it("merges result.json journeys and harness checks with ledger error signals", () => {
    const runResult: RunResult = {
      status: "partial",
      summary: "2 journeys failed",
      pi_exit_code: 1,
      tests_run: [
        { command: "npm test", journey: "journey-a", result: "passed" },
        { command: "npm test", journey: "journey-b", result: "failed" },
      ],
      harness_checks: [
        {
          command: "vitest run",
          journey: "vitest green",
          result: "failed",
        },
      ],
    } as RunResult;

    const calls: CallLedgerEntry[] = [
      minimalCall({
        index: 3,
        activity: "repair",
        tools: [{ name: "bash", detail: "npm test", is_error: true }],
      }),
      minimalCall({
        index: 4,
        tools: [{ name: "bash", detail: "npm test", is_error: false }],
      }),
    ];

    const verification = buildStationVerification(calls, { runResult });

    expect(verification.source).toBe("result.json");
    expect(verification.status).toBe("partial");
    expect(verification.tests_passed).toBe(1);
    expect(verification.tests_failed).toBe(1);
    expect(verification.harness_passed).toBe(0);
    expect(verification.harness_failed).toBe(1);
    expect(verification.error_tool_count).toBe(1);
    expect(verification.error_call_count).toBe(1);
    expect(verification.repair_call_count).toBe(1);
    expect(verification.npm_test_command_count).toBe(2);
    expect(verification.npm_test_error_count).toBe(1);
    expect(verification.time_to_first_failing_test_s).toBe(12.5);
    expect(verification.first_error_call_index).toBe(3);
    expect(verification.agent_tool_errors).toHaveLength(1);
  });

  it("falls back to manifest outcome when result.json is missing", () => {
    const verification = buildStationVerification([], {
      manifest: {
        outcome: {
          status: "failed",
          pi_exit_code: 2,
          model_calls: 0,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          weighted_cost: 0,
          wall_ms: 1000,
        },
      } as never,
    });

    expect(verification.source).toBe("manifest.outcome");
    expect(verification.status).toBe("failed");
    expect(verification.pi_exit_code).toBe(2);
    expect(verification.tests_run).toEqual([]);
  });

  it("uses ledger_only when no result or manifest outcome exists", () => {
    const verification = buildStationVerification([minimalCall()], {});

    expect(verification.source).toBe("ledger_only");
    expect(verification.status).toBe("unknown");
    expect(verification.agent_tool_errors).toEqual([]);
  });
});

describe("enrichVerificationDetails", () => {
  it("attaches dev log detail to failed harness dev check", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "verify-detail-"));
    try {
      await writeFile(
        path.join(root, "app-dev.log"),
        "Port 3000 already had a listener before app verification.\n",
        "utf8",
      );
      const base = buildStationVerification([], {
        runResult: {
          status: "partial",
          tests_run: [],
          harness_checks: [
            {
              command: "npm run dev",
              journey: "The generated app started its own HTTP server on port 3000 and shut down cleanly",
              result: "failed",
            },
          ],
        } as RunResult,
      });
      const enriched = await enrichVerificationDetails(root, base);
      expect(enriched.harness_checks[0]?.detail).toContain("Port 3000 already had a listener");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("attaches vitest failure messages to failed journeys", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "verify-vitest-"));
    try {
      await writeFile(
        path.join(root, "app-test-results.json"),
        `${JSON.stringify({
          success: false,
          numFailedTests: 1,
          testResults: [
            {
              assertionResults: [
                {
                  title: "rejects blank title",
                  fullName: "book library journeys rejects blank title",
                  status: "failed",
                  failureMessages: ["Expected element to be null"],
                },
              ],
            },
          ],
        })}\n`,
        "utf8",
      );
      const base = buildStationVerification([], {
        runResult: {
          status: "partial",
          tests_run: [
            {
              command: "npm test",
              journey: "Adding a book with a blank title is rejected",
              result: "failed",
            },
          ],
          harness_checks: [],
        } as RunResult,
      });
      const enriched = await enrichVerificationDetails(root, base);
      expect(enriched.tests_run[0]?.detail).toContain("Expected element to be null");
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
