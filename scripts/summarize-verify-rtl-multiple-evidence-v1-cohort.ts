/**
 * Discover + summarize verify-rtl-multiple-evidence-v1 cohort runs.
 * Activation: ≥1 VERIFY FAIL with Found multiple elements…
 * Treatment mechanism: MATCHES PRESENT in VERIFY MESSAGE.
 *
 * Usage (after cohort):
 *   node --import tsx scripts/summarize-verify-rtl-multiple-evidence-v1-cohort.ts
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const CONTROL_ID = "verify-rtl-multiple-evidence-v1-control";
const TREATMENT_ID = "verify-rtl-multiple-evidence-v1-treatment";

function weighted(r: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
}) {
  return Math.floor(
    (r.input_tokens || 0) + (r.output_tokens || 0) * 3 + (r.cache_read_tokens || 0) * 0.1,
  );
}

function med(a: number[]) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function inspect(runId: string) {
  const result = JSON.parse(readFileSync(path.join("artifacts/runs", runId, "result.json"), "utf8"));
  const manifest = JSON.parse(
    readFileSync(path.join("artifacts/runs", runId, "run-manifest.json"), "utf8"),
  );
  let multipleFails = 0;
  let matchesPresent = 0;
  let activated = false;
  try {
    const sessDir = path.join("artifacts/runs", runId, "sessions");
    const sess = readdirSync(sessDir).find((f) => f.endsWith(".jsonl"));
    if (sess) {
      const lines = readFileSync(path.join(sessDir, sess), "utf8").trim().split("\n");
      for (const line of lines) {
        const o = JSON.parse(line);
        if (o.message?.role !== "toolResult" || o.message?.toolName !== "verify") continue;
        const text = (o.message.content || [])
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("\n");
        if (!/❌ FAIL|FAILURES |exit_code=1/.test(text)) continue;
        if (/Found multiple elements with the (text|role)/i.test(text)) {
          multipleFails += 1;
          activated = true;
        }
        // Mechanism success = real candidates, not merely "MATCHES PRESENT\n(none parsed)"
        if (
          /MATCHES PRESENT/i.test(text) &&
          !/\(none parsed\)/i.test(text) &&
          /^\d+\.\s+</m.test(text)
        ) {
          matchesPresent += 1;
        }
      }
    }
  } catch {
    // ignore
  }
  return {
    run_id: runId,
    experiment: manifest.experiment?.id ?? null,
    rep: manifest.experiment?.rep ?? null,
    status: result.status ?? null,
    calls: result.model_calls ?? null,
    weighted_total: weighted(result),
    activated_rtl_multiple: activated,
    multiple_fail_events: multipleFails,
    matches_present_blocks: matchesPresent,
  };
}

function discover(experimentId: string) {
  const runsDir = "artifacts/runs";
  const ids = readdirSync(runsDir).filter((id) => {
    const p = path.join(runsDir, id, "run-manifest.json");
    if (!existsSync(p)) return false;
    try {
      const m = JSON.parse(readFileSync(p, "utf8"));
      return m.experiment?.id === experimentId;
    } catch {
      return false;
    }
  });
  return ids.sort().map(inspect);
}

function armSummary(label: string, rows: ReturnType<typeof inspect>[]) {
  const activated = rows.filter((r) => r.activated_rtl_multiple);
  return {
    arm: label,
    n: rows.length,
    success: rows.filter((r) => r.status === "success").length,
    median_weighted_all: med(rows.map((r) => r.weighted_total)),
    median_calls_all: med(rows.map((r) => r.calls ?? 0)),
    activated_n: activated.length,
    median_weighted_activated: med(activated.map((r) => r.weighted_total)),
    median_calls_activated: med(activated.map((r) => r.calls ?? 0)),
    matches_present_total: rows.reduce((s, r) => s + r.matches_present_blocks, 0),
    runs: rows,
  };
}

const control = discover(CONTROL_ID);
const treatment = discover(TREATMENT_ID);
const report = {
  generated_at: new Date().toISOString(),
  question:
    "When rtl_multiple fires, does structured candidate evidence reduce wrong diagnosis, repeated FAILs, WRONG_PRODUCT, calls after first FAIL, and weighted repair tail? (activated vs all)",
  control: armSummary("control", control),
  treatment: armSummary("treatment", treatment),
};

mkdirSync("artifacts/experiments", { recursive: true });
const out = path.join(
  "artifacts/experiments",
  "verify-rtl-multiple-evidence-v1-cohort-summary.json",
);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${out}`);
