import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = process.cwd();
const STAGING = path.join(REPO, "artifacts/exports/verify-rtl-multiple-evidence-v1-staging");
const ZIP = path.join(REPO, "artifacts/exports/cohort-verify-rtl-multiple-evidence-v1-2026-09-04.zip");

const CONTROL = [
  "2026-09-04T09-00-08-526Z",
  "2026-09-04T09-05-01-512Z",
  "2026-09-04T09-09-19-977Z",
  "2026-09-04T09-11-28-038Z",
  "2026-09-04T09-16-08-336Z",
];
const TREATMENT = [
  "2026-09-04T09-21-42-098Z",
  "2026-09-04T09-25-09-799Z",
  "2026-09-04T09-34-21-713Z",
  "2026-09-04T09-41-08-045Z",
  "2026-09-04T09-45-30-254Z",
];

function w(r: { input_tokens?: number; output_tokens?: number; cache_read_tokens?: number }) {
  return Math.floor((r.input_tokens || 0) + (r.output_tokens || 0) * 3 + (r.cache_read_tokens || 0) * 0.1);
}

function med(a: number[]) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function inspect(runId: string) {
  const result = JSON.parse(readFileSync(path.join("artifacts/runs", runId, "result.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(path.join("artifacts/runs", runId, "run-manifest.json"), "utf8"));
  let activated = false;
  let multipleFails = 0;
  let matchesPresent = 0;
  try {
    const sess = readdirSync(path.join("artifacts/runs", runId, "sessions")).find((f) =>
      f.endsWith(".jsonl"),
    );
    if (sess) {
      const lines = readFileSync(path.join("artifacts/runs", runId, "sessions", sess), "utf8")
        .trim()
        .split("\n");
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
    rep: manifest.experiment?.rep ?? null,
    status: result.status ?? null,
    calls: result.model_calls ?? null,
    weighted_total: w(result),
    journeys: (result.tests_run || []).filter((t: { result: string }) => t.result === "passed").length,
    activated_rtl_multiple: activated,
    multiple_fail_events: multipleFails,
    matches_present_blocks: matchesPresent,
  };
}

function copyRun(runId: string, armDir: string) {
  const dest = path.join(STAGING, "runs", armDir, runId);
  const src = path.join(REPO, "artifacts/runs", runId);
  const analysis = path.join(REPO, "artifacts/analysis", runId);
  mkdirSync(path.join(dest, "events"), { recursive: true });
  mkdirSync(path.join(dest, "sessions"), { recursive: true });
  mkdirSync(path.join(dest, "logs"), { recursive: true });
  mkdirSync(path.join(dest, "analysis"), { recursive: true });
  mkdirSync(path.join(dest, "app"), { recursive: true });
  for (const file of ["idea.txt", "result.json", "run-manifest.json", "app-test-results.json"]) {
    const p = path.join(src, file);
    if (existsSync(p)) cpSync(p, path.join(dest, file));
  }
  const events = path.join(src, "events.jsonl");
  if (existsSync(events)) cpSync(events, path.join(dest, "events", "raw-event-stream.jsonl"));
  const sessions = path.join(src, "sessions");
  if (existsSync(sessions)) {
    const sess = readdirSync(sessions).find((f) => f.endsWith(".jsonl"));
    if (sess) cpSync(path.join(sessions, sess), path.join(dest, "sessions", "pi-session.jsonl"));
  }
  for (const log of ["pi.stderr.log", "app-test.log", "app-build.log", "app-dev.log"]) {
    const p = path.join(src, log);
    if (existsSync(p)) cpSync(p, path.join(dest, "logs", log));
  }
  const app = path.join(src, "app");
  if (existsSync(app)) {
    execSync(`rsync -a --exclude node_modules --exclude dist "${app}/" "${dest}/app/"`, {
      stdio: "inherit",
    });
  }
  if (existsSync(analysis)) {
    execSync(`cp -r "${analysis}/." "${dest}/analysis/"`, { stdio: "inherit" });
  }
}

execSync(`rm -rf "${STAGING}"`);
mkdirSync(path.join(STAGING, "experiment-logs"), { recursive: true });
mkdirSync(path.join(STAGING, "docs"), { recursive: true });
mkdirSync(path.join(STAGING, "runs/verify-rtl-multiple-evidence-v1-control"), { recursive: true });
mkdirSync(path.join(STAGING, "runs/verify-rtl-multiple-evidence-v1-treatment"), { recursive: true });

for (const id of CONTROL) copyRun(id, "verify-rtl-multiple-evidence-v1-control");
for (const id of TREATMENT) copyRun(id, "verify-rtl-multiple-evidence-v1-treatment");

execSync(
  `cp artifacts/experiments/verify-rtl-multiple-evidence-v1-control/*.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
execSync(
  `cp artifacts/experiments/verify-rtl-multiple-evidence-v1-treatment/*.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
execSync(
  `cp artifacts/experiments/verify-rtl-multiple-evidence-v1-cohort-pair.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
if (existsSync("artifacts/experiments/verify-rtl-multiple-evidence-v1-cohort-summary.json")) {
  cpSync(
    "artifacts/experiments/verify-rtl-multiple-evidence-v1-cohort-summary.json",
    path.join(STAGING, "cohort-summary-raw.json"),
  );
}
cpSync(
  "docs/v2/control-floor/experiment-verify-rtl-multiple-evidence-v1-preregistration.md",
  path.join(STAGING, "docs/experiment-verify-rtl-multiple-evidence-v1-preregistration.md"),
);
if (existsSync("docs/v2/control-floor/audit-repair-tail-rtl-text-multiple.md")) {
  cpSync(
    "docs/v2/control-floor/audit-repair-tail-rtl-text-multiple.md",
    path.join(STAGING, "docs/audit-repair-tail-rtl-text-multiple.md"),
  );
}

const c = CONTROL.map(inspect);
const t = TREATMENT.map(inspect);
const cOk = c.filter((r) => r.status === "success");
const tOk = t.filter((r) => r.status === "success");
const cAct = c.filter((r) => r.activated_rtl_multiple);
const tAct = t.filter((r) => r.activated_rtl_multiple);
const summary = {
  experiment: "verify-rtl-multiple-evidence-v1",
  date: "2026-09-04",
  stack:
    "HARNESS_OWNED_VERIFY=1 ROOT_ERROR_FIRST=1 PERSISTENCE=1 TAILWIND=1 CSS=0 RTL_EVIDENCE=1 KEEP",
  control: {
    id: "verify-rtl-multiple-evidence-v1-control",
    flag: "HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0",
    reps: c,
    harness_ok: `${cOk.length}/${c.length}`,
    median_weighted_all: med(c.map((r) => r.weighted_total)),
    median_weighted_activated: med(cAct.map((r) => r.weighted_total)),
    activated: `${cAct.length}/${c.length}`,
  },
  treatment: {
    id: "verify-rtl-multiple-evidence-v1-treatment",
    flag: "HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1",
    reps: t,
    harness_ok: `${tOk.length}/${t.length}`,
    median_weighted_all: med(t.map((r) => r.weighted_total)),
    median_weighted_activated: med(tAct.map((r) => r.weighted_total)),
    activated: `${tAct.length}/${t.length}`,
    matches_present_runs: t.filter((r) => r.matches_present_blocks > 0).length,
  },
  evaluation_note:
    "Score all-runs and activated subset separately. Activated = ≥1 Found multiple elements… VERIFY FAIL; treatment mechanism = MATCHES PRESENT.",
};

writeFileSync(path.join(STAGING, "cohort-summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(
  path.join(STAGING, "EXPORT_MANIFEST.json"),
  JSON.stringify(
    {
      export_name: "cohort-verify-rtl-multiple-evidence-v1-2026-09-04",
      generated_at: new Date().toISOString(),
      description:
        "Legacy tag-token MATCHES vs structured MATCHES PRESENT for rtl_multiple on frozen default stack (role+name evidence KEEP).",
      preregistration: "docs/experiment-verify-rtl-multiple-evidence-v1-preregistration.md",
      cohort_summary: summary,
    },
    null,
    2,
  ),
);

execSync(
  `python3 - <<'PY'
import os, zipfile
staging = ${JSON.stringify(STAGING)}
zip_path = ${JSON.stringify(ZIP)}
parent = os.path.dirname(staging)
os.makedirs(os.path.dirname(zip_path), exist_ok=True)
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            zf.write(full, os.path.relpath(full, parent))
print(zip_path)
size = os.path.getsize(zip_path)
print(f"size_bytes={size}")
PY`,
  { shell: "/bin/bash", stdio: "inherit" },
);

console.log(JSON.stringify(summary, null, 2));
