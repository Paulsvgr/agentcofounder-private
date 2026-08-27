// Audit generated apps against observable proxies for the judging rubric.
//
// These are signals, not scores: the committee's rubric is not published, and a
// regex cannot judge usability. What this does give is a way to notice a
// quality gap across runs instead of discovering it by reading one app by hand.
// Usage: node audit.js
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

/** Each check is [rubric area, label, predicate over the app's source]. */
const CHECKS = [
  // A label can be associated explicitly (htmlFor / aria-label) or implicitly
  // by wrapping the control, which the shipped stylesheet encourages. Both are
  // accessible, so both count.
  ["ux", "labelled inputs", (s) => /htmlFor=|aria-label=|<label/.test(s)],
  ["ux", "input validation", (s) => /required|\.trim\(\)/.test(s)],
  ["ux", "empty state", (s) => /length === 0|length ? |isEmpty|No .* yet/i.test(s)],
  ["ux", "semantic list or table", (s) => /<ul|<ol|<table/.test(s)],
  ["ux", "headings", (s) => /<h1|<h2/.test(s)],
  ["persist", "uses persistence layer", (s) => /useCollection|localStorage/.test(s)],
  ["robust", "surfaces errors", (s) => /role="alert"/.test(s)],
  ["robust", "handles storage failure", (s) => /onFailure/.test(s)],
  ["robust", "guards destructive action", (s) => /confirm|areYouSure|undo/i.test(s)],
  ["maintain", "logic split out of the component", (s, files) => files.length > 1],
  ["maintain", "component under 250 lines", (s) => s.split("\n").length < 250],
];

const AREAS = { ux: "Usability & UX", persist: "Persistence", robust: "Robustness", maintain: "Maintainability" };

function appSources(runDir) {
  const src = path.join(runDir, "output", "app", "src");
  if (!existsSync(src)) return null;
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // lib/ is shipped by the template and test/ is setup, so neither
        // reflects what the model built.
        if (entry.name !== "lib" && entry.name !== "test") walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(src);
  return files.length > 0 ? files : null;
}

const results = [];
for (const stamp of readdirSync("runs").sort()) {
  const runDir = path.join("runs", stamp);
  const files = appSources(runDir);
  if (!files) continue;
  let status = "?";
  try {
    status = JSON.parse(readFileSync(path.join(runDir, "result.json"), "utf8")).status;
  } catch {
    // A run without a readable result is still worth auditing.
  }
  const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const passed = CHECKS.map(([, label, test]) => [label, Boolean(test(source, files))]);
  results.push({ stamp, status, passed, files: files.length });
}

if (results.length === 0) {
  console.log("No generated app sources found in runs/.");
} else {
  const labels = CHECKS.map(([, label]) => label);
  const width = Math.max(...labels.map((l) => l.length)) + 2;

  console.log(`Auditing ${results.length} generated app(s)\n`);
  let area = "";
  for (const [key, label, ] of CHECKS) {
    if (key !== area) {
      area = key;
      console.log(`\n${AREAS[key]}`);
    }
    const hits = results.filter((r) => r.passed.find(([l]) => l === label)?.[1]).length;
    const bar = "█".repeat(hits) + "·".repeat(results.length - hits);
    console.log(`  ${label.padEnd(width)} ${bar}  ${hits}/${results.length}`);
  }

  const weakest = CHECKS.map(([, label]) => ({
    label,
    hits: results.filter((r) => r.passed.find(([l]) => l === label)?.[1]).length,
  }))
    .filter((c) => c.hits < results.length)
    .sort((a, b) => a.hits - b.hits);

  if (weakest.length > 0) {
    console.log("\nGaps, weakest first:");
    for (const c of weakest) console.log(`  ${c.hits}/${results.length}  ${c.label}`);
  } else {
    console.log("\nEvery audited app passed every check.");
  }
}
