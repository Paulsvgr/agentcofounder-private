import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCallLedger, buildCallLedgerFromEvents, enrichLedgerToolOutputs } from "../../src/v2/normalize.js";
import { reconcileRun } from "../../src/v2/reconcile.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE_RUN = "2026-08-28T09-59-12-356Z";

describe("buildCallLedger", () => {
  it(`matches result.json totals for ${SAMPLE_RUN}`, async () => {
    const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", SAMPLE_RUN);
    try {
      await readFile(path.join(runDirectory, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const ledger = await buildCallLedger(runDirectory);
    expect(ledger.reconciliation.matched).toBe(true);
    expect(ledger.calls.length).toBeGreaterThan(0);
    expect(ledger.calls[0]?.tools.length).toBeGreaterThan(0);
    expect(ledger.calls[0]?.activity).toBeTruthy();
    expect(ledger.activity_summary.length).toBeGreaterThan(0);

    const reconcile = await reconcileRun(runDirectory);
    expect(reconcile.ok).toBe(true);
    expect(ledger.calls.length).toBe(reconcile.fields.find((f) => f.field === "model_calls")?.official);
  });

  it("builds ledger from events when result.json is missing in run dir", async () => {
    const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", "2026-08-30T07-51-15-946Z");
    try {
      await readFile(path.join(runDirectory, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const ledger = await buildCallLedger(runDirectory);
    expect(ledger.reconciliation.official_missing).toBe(true);
    expect(ledger.calls.length).toBeGreaterThan(0);
    expect(ledger.activity_summary.length).toBeGreaterThan(0);
  });

  it("captures truncated bash output on ledger tools", () => {
    const events = [
      '{"type":"turn_start"}',
      '{"type":"tool_execution_start","toolCallId":"t1","args":{"command":"npm test"}}',
      '{"type":"tool_execution_end","toolCallId":"t1","toolName":"bash","isError":false,"result":{"content":[{"type":"text","text":"FAIL src/App.test.tsx\\nExpected element to be null\\nReceived: DIV"}]}}',
      '{"type":"message_end","message":{"role":"assistant","usage":{"input":1,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":2}}}',
    ].join("\n");
    const ledger = buildCallLedgerFromEvents(events, "test-run", "events.jsonl");
    expect(ledger.calls).toHaveLength(1);
    expect(ledger.calls[0]?.tools[0]?.output).toContain("Expected element to be null");
  });

  it("attaches root-cause error to grep-only npm test summaries", () => {
    const events = [
      '{"type":"turn_start"}',
      '{"type":"tool_execution_end","toolCallId":"t1","toolName":"bash","isError":false,"args":{"command":"npm test 2>&1 | grep FAIL"},"result":{"content":[{"type":"text","text":" FAIL src/App.test.tsx > suite > edits book\\n Tests  1 failed | 8 passed"}]}}',
      '{"type":"message_end","message":{"role":"assistant","usage":{"input":1,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":2}}}',
      '{"type":"turn_start"}',
      '{"type":"tool_execution_end","toolCallId":"t2","toolName":"bash","isError":false,"args":{"command":"npm test"},"result":{"content":[{"type":"text","text":"TestingLibraryElementError: Unable to find an element with the text: Dune"}]}}',
      '{"type":"message_end","message":{"role":"assistant","usage":{"input":1,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":2}}}',
    ].join("\n");
    const ledger = buildCallLedgerFromEvents(events, "test-run", "events.jsonl");
    const enriched = enrichLedgerToolOutputs(ledger.calls);
    expect(enriched[0]?.tools[0]?.output).toContain("Cause:");
    expect(enriched[0]?.tools[0]?.output).toContain("Unable to find an element with the text: Dune");
  });
});
