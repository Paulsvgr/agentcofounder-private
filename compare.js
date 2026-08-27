// Tabulate every run in runs/ so experiments can be compared directly.
// Usage: node compare.js
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const EFFICIENCY = (r) => r.input_tokens + r.output_tokens * 3 + r.cache_read_tokens * 0.1;

function toolCounts(runDir) {
  const artifacts = path.join(runDir, "artifacts", "runs");
  if (!existsSync(artifacts)) return {};
  const counts = {};
  for (const stamp of readdirSync(artifacts)) {
    const events = path.join(artifacts, stamp, "events.jsonl");
    if (!existsSync(events)) continue;
    for (const line of readFileSync(events, "utf8").split(/\r?\n/u)) {
      if (line.trim() === "") continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "tool_execution_end") {
          const name = String(event.toolName ?? "").trim() || "(none)";
          counts[name] = (counts[name] ?? 0) + 1;
        }
      } catch {
        // A malformed line stays in the audit artifact and is ignored here.
      }
    }
  }
  return counts;
}

const rows = [];
for (const stamp of readdirSync("runs").sort()) {
  const resultPath = path.join("runs", stamp, "result.json");
  if (!existsSync(resultPath)) continue;
  const r = JSON.parse(readFileSync(resultPath, "utf8"));
  const tools = toolCounts(path.join("runs", stamp));
  rows.push({
    run: stamp,
    status: r.status,
    calls: r.model_calls,
    input: r.input_tokens,
    output: r.output_tokens,
    efficiency: Math.round(EFFICIENCY(r)),
    eur: Number(r.cost_total ?? 0).toFixed(3),
    journeys: (r.tests_run ?? []).length,
    gate: (r.harness_checks ?? []).every((c) => c.result === "passed") ? "pass" : "FAIL",
    edits: tools.edit ?? 0,
    writes: tools.write ?? 0,
    reads: tools.read ?? 0,
  });
}

if (rows.length === 0) {
  console.log("No runs yet.");
} else {
  const cols = Object.keys(rows[0]);
  const width = Object.fromEntries(
    cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]),
  );
  const line = (cells) => cols.map((c) => String(cells[c]).padStart(width[c])).join("  ");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
  for (const r of rows) console.log(line(r));

  const best = rows.reduce((a, b) => (a.efficiency <= b.efficiency ? a : b));
  const first = rows[0];
  console.log(`\nbest: ${best.run} at ${best.efficiency.toLocaleString()}`);
  if (best !== first) {
    const delta = (1 - best.efficiency / first.efficiency) * 100;
    console.log(`vs first run (${first.efficiency.toLocaleString()}): ${delta.toFixed(1)}% lower`);
  }
}
