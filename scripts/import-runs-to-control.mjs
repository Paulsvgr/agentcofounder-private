// Lay our run output out the way the control app expects.
//
// wrun.sh writes runs/<stamp>/ with result.json at the top and the Pi audit
// trail under artifacts/runs/<inner>/. The control app wants one directory per
// run holding events.jsonl and result.json together, under artifacts/runs/.
// Copying rather than moving keeps runs/ intact as the source of truth.
import { readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import path from "node:path";

const SOURCE = "runs";
const TARGET = path.join("artifacts", "runs");
mkdirSync(TARGET, { recursive: true });

let imported = 0;
let skipped = 0;

for (const stamp of readdirSync(SOURCE).sort()) {
  const runDir = path.join(SOURCE, stamp);
  if (!statSync(runDir).isDirectory()) continue;

  const result = path.join(runDir, "result.json");
  const auditRoot = path.join(runDir, "artifacts", "runs");
  if (!existsSync(result) || !existsSync(auditRoot)) {
    skipped += 1;
    continue;
  }

  // The newest audit directory belongs to this run; earlier ones are leftovers.
  const inner = readdirSync(auditRoot).sort().at(-1);
  const events = path.join(auditRoot, inner, "events.jsonl");
  if (!existsSync(events)) {
    skipped += 1;
    continue;
  }

  // The control app only lists directories named like Pi's own run ids
  // (2026-09-02T12-11-30-963Z), so reuse the audit directory's name rather
  // than the shorter stamp wrun.sh uses.
  const destination = path.join(TARGET, inner);
  mkdirSync(destination, { recursive: true });
  copyFileSync(result, path.join(destination, "result.json"));
  copyFileSync(events, path.join(destination, "events.jsonl"));

  for (const extra of ["idea.txt", "app-test-results.json", "app-build.log", "app-test.log"]) {
    const from = path.join(auditRoot, inner, extra);
    if (existsSync(from)) copyFileSync(from, path.join(destination, extra));
  }
  imported += 1;
}

console.log(`imported ${imported} runs into ${TARGET}`);
if (skipped > 0) console.log(`skipped ${skipped} without a result or audit trail`);
