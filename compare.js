// Tabulate every run in runs/ so experiments can be compared directly.
// Usage: node compare.js
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const EFFICIENCY = (r) => r.input_tokens + r.output_tokens * 3 + r.cache_read_tokens * 0.1;

function toolCounts(runDir) {
  const artifacts = path.join(runDir, "artifacts", "runs");
  if (!existsSync(artifacts)) return {};
  const counts = {};
  // The WSL workspace keeps every run's artifacts, so a run directory can hold
  // stamps from earlier runs too. Only the newest belongs to this run --
  // counting them all made tool use look like it grew run over run.
  const stamps = readdirSync(artifacts).sort().slice(-1);
  for (const stamp of stamps) {
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

  // A run with no model calls never reached the provider (quota rejection,
  // auth failure). It scores zero tokens without meaning anything, so it must
  // not win a comparison.
  const scored = rows.filter((r) => r.calls > 0 && r.input > 0);
  const unreached = rows.length - scored.length;
  if (unreached > 0) {
    console.log(`\n${unreached} run(s) never reached the model and are excluded below.`);
  }
  if (scored.length === 0) {
    console.log("No scored runs yet.");
  } else {
    const efficiencies = scored.map((r) => r.efficiency).sort((a, b) => a - b);
    const median = efficiencies[Math.floor(efficiencies.length / 2)];
    const gateFails = scored.filter((r) => r.gate === "FAIL").length;
    const successes = scored.filter((r) => r.status === "success").length;
    console.log(
      `\nscored runs : ${scored.length}` +
        `\nefficiency  : best ${efficiencies[0].toLocaleString()}` +
        ` | median ${median.toLocaleString()}` +
        ` | worst ${efficiencies.at(-1).toLocaleString()}` +
        ` (${(efficiencies.at(-1) / efficiencies[0]).toFixed(1)}x spread)` +
        `\ngate passes : ${scored.length - gateFails}/${scored.length}` +
        `\nsuccess     : ${successes}/${scored.length}`,
    );
  }
}
