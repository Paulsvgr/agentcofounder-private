import { describe, expect, it } from "vitest";
import { buildCallLedgerFromEvents } from "../../src/v2/normalize.js";
import { buildTrajectoryMetrics } from "../../src/v2/trajectory-metrics.js";

function ledgerFromEvents(runId: string, lines: object[]): ReturnType<typeof buildCallLedgerFromEvents> {
  return buildCallLedgerFromEvents(
    lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
    runId,
    `/tmp/${runId}/events.jsonl`,
  );
}

let turnSeq = 0;

function assistantEnd(): object {
  turnSeq += 1;
  return {
    type: "message_end",
    message: {
      role: "assistant",
      timestamp: turnSeq * 1000,
      stopReason: "toolUse",
      usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150 },
    },
  };
}

function bashTurn(command: string, output: string, isError = false): object[] {
  const id = `bash-${turnSeq + 1}`;
  return [
    { type: "turn_start" },
    { type: "tool_execution_start", toolCallId: id, toolName: "bash", args: { command } },
    {
      type: "tool_execution_end",
      toolCallId: id,
      toolName: "bash",
      isError,
      result: { content: [{ type: "text", text: output }] },
    },
    assistantEnd(),
  ];
}

function verifyTurn(output: string, isError = false): object[] {
  const id = `verify-${turnSeq + 1}`;
  return [
    { type: "turn_start" },
    { type: "tool_execution_start", toolCallId: id, toolName: "verify", args: {} },
    {
      type: "tool_execution_end",
      toolCallId: id,
      toolName: "verify",
      isError,
      result: { content: [{ type: "text", text: output }] },
    },
    assistantEnd(),
  ];
}

function writeTurn(filePath: string): object[] {
  const id = `write-${turnSeq + 1}`;
  return [
    { type: "turn_start" },
    {
      type: "tool_execution_start",
      toolCallId: id,
      toolName: "write",
      args: { path: filePath, content: "fix" },
    },
    {
      type: "tool_execution_end",
      toolCallId: id,
      toolName: "write",
      isError: false,
      result: { content: [{ type: "text", text: "ok" }] },
    },
    assistantEnd(),
  ];
}

function primeTurn(): object[] {
  return [{ type: "turn_start" }, assistantEnd()];
}

describe("buildTrajectoryMetrics v2", () => {
  it("parses first suite pass ratio and piped test count", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("test-run", [
      ...primeTurn(),
      ...bashTurn("npm test 2>&1 | tail -40", "❌ FAIL 3/7 tests · 4 failed\nFAILURES 4"),
      ...bashTurn("npm test", "✅ PASS 7/7 tests"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.verification_runs.map((run) => run.call_index)).toEqual([1, 2]);
    expect(metrics.schema).toBe("agentcofounder.trajectory_metrics.v2");
    expect(metrics.first_test_pass_ratio).toBeCloseTo(3 / 7);
    expect(metrics.piped_test_command_count).toBe(1);
    expect(metrics.test_command_count).toBe(2);
    expect(metrics.first_any_test_green_call).toBe(2);
    expect(metrics.verification_runs[0]?.canonical_outcome).toBe("fail");
  });

  it("counts piped PASS N/N as canonical pass even when exit untrusted", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("piped-pass", [
      ...primeTurn(),
      ...bashTurn("npm test 2>&1 | tail -20", "✅ PASS 7/7 tests"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.verification_runs[0]?.piped).toBe(true);
    expect(metrics.verification_runs[0]?.exit_code_trusted).toBe(false);
    expect(metrics.verification_runs[0]?.canonical_outcome).toBe("pass");
    expect(metrics.first_canonical_test_green_call).toBe(1);
  });

  it("marks truncated piped output as unknown not fail", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("piped-unknown", [
      ...primeTurn(),
      ...bashTurn("npm test | tail -5", "…some truncated garbage…"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.verification_runs[0]?.canonical_outcome).toBe("unknown");
    expect(metrics.canonical_fail_before_first_canonical_green).toBe(0);
  });

  it("detects debug sidecar files and excludes them from canonical", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("sidecar", [
      ...primeTurn(),
      ...writeTurn("src/dbg.test.tsx"),
      ...bashTurn("npx vitest run src/dbg.test.tsx", "✅ PASS 1/1 tests"),
      ...bashTurn("npm test", "✅ PASS 7/7 tests"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.debug_test_files_created).toEqual(["dbg.test.tsx"]);
    expect(metrics.verification_runs[0]?.sidecar).toBe(true);
    expect(metrics.verification_runs[0]?.canonical).toBe(false);
    expect(metrics.first_any_test_green_call).toBe(2);
    expect(metrics.first_canonical_test_green_call).toBe(3);
  });

  it("parses verify tool outcomes", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("verify-tool", [
      ...primeTurn(),
      ...verifyTurn("verify exit_code=1 (FAIL)\n\n❌ FAIL 3/7 tests"),
      ...verifyTurn("verify exit_code=0 (PASS)\n\n✅ PASS 7/7 tests"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.verify_tool_count).toBe(2);
    expect(metrics.verification_runs[0]?.source).toBe("verify");
    expect(metrics.verification_runs[0]?.canonical_outcome).toBe("fail");
    expect(metrics.verification_runs[1]?.canonical_outcome).toBe("pass");
    expect(metrics.canonical_fail_before_first_canonical_green).toBe(1);
    expect(metrics.verify_fail_before_first_canonical_green).toBe(1);
  });

  it("requires no product mutation between test and build for valid full green", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("valid-full-green", [
      ...primeTurn(),
      ...bashTurn("npm test", "✅ PASS 7/7 tests"),
      ...bashTurn("npm run build", "✓ built in 1.2s"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.first_valid_full_green_call).toBe(2);
  });

  it("detects debug sidecar files created via bash heredoc", () => {
    turnSeq = 0;
    const ledger = ledgerFromEvents("bash-sidecar", [
      ...primeTurn(),
      ...bashTurn("cat > src/debug.test.tsx << 'TESTEOF'\nimport { it } from 'vitest'\nTESTEOF", ""),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.debug_test_files_created).toEqual(["debug.test.tsx"]);
  });

  it("classifies verify failures as canonical fail when exit_code is preserved", () => {
    turnSeq = 0;
    const failOutput =
      "verify exit_code=1 (FAIL)\n\n❌ FAIL 3/7 tests · 4 failed\nTYPE TestingLibraryElementError\nAT at App.test.tsx:10:1";
    const ledger = ledgerFromEvents("verify-fail", [
      ...primeTurn(),
      ...verifyTurn(failOutput),
      ...verifyTurn("verify exit_code=0 (PASS)\n\n✅ PASS 7/7 tests"),
    ]);

    const metrics = buildTrajectoryMetrics(ledger);
    expect(metrics.verification_runs[0]?.canonical_outcome).toBe("fail");
    expect(metrics.canonical_fail_before_first_canonical_green).toBe(1);
  });
});
