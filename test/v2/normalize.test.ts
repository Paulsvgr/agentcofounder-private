import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCallLedger } from "../../src/v2/normalize.js";
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
});
