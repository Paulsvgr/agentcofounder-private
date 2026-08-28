import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCallLedger } from "../../src/v2/normalize.js";
import {
  STATION_SCHEMA,
  buildStationReport,
  renderStationHtml,
} from "../../src/v2/station.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE_RUN = "2026-08-28T09-59-12-356Z";

describe("buildStationReport", () => {
  it(`builds report and html for ${SAMPLE_RUN}`, async () => {
    const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", SAMPLE_RUN);
    try {
      await readFile(path.join(runDirectory, "events.jsonl"), "utf8");
    } catch {
      return;
    }

    const ledger = await buildCallLedger(runDirectory);
    const report = buildStationReport(ledger);

    expect(report.schema).toBe(STATION_SCHEMA);
    expect(report.calls.length).toBe(ledger.calls.length);
    expect(report.activity_summary.length).toBeGreaterThan(0);
    expect(report.cumulative_series.at(-1)?.cumulative_weighted).toBe(
      report.totals.weighted_total,
    );

    const html = renderStationHtml(report);
    expect(html).toContain("Analysis station");
    expect(html).toContain(SAMPLE_RUN);
    expect(html).toContain('"activity_summary"');
  });
});
