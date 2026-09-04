import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = process.cwd();
const STAGING = path.join(REPO, "artifacts/exports/verify-rtl-evidence-v1-staging");
const ZIP = path.join(REPO, "artifacts/exports/cohort-verify-rtl-evidence-v1-2026-09-04.zip");

const CONTROL = [
  "2026-09-04T07-00-40-631Z",
  "2026-09-04T07-04-25-512Z",
  "2026-09-04T07-12-40-958Z",
  "2026-09-04T07-16-30-770Z",
  "2026-09-04T07-20-21-522Z",
];
const TREATMENT = [
  "2026-09-04T07-22-42-694Z",
  "2026-09-04T07-26-05-885Z",
  "2026-09-04T07-28-48-229Z",
  "2026-09-04T07-31-16-997Z",
  "2026-09-04T07-34-36-276Z",
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
  let roleNameFails = 0;
  let queriedEvidence = 0;
  try {
    const sess = readdirSync(path.join("artifacts/runs", runId, "sessions")).find((f) => f.endsWith(".jsonl"));
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
        if (!/\(FAIL\)|exit_code=1/.test(text)) continue;
        if (/Unable to find an accessible element with the role/.test(text)) {
          roleNameFails += 1;
          activated = true;
        }
        if (/QUERIED/.test(text) && /PRESENT/.test(text)) queriedEvidence += 1;
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
    activated_role_name_fail: activated,
    role_name_fail_events: roleNameFails,
    queried_evidence_blocks: queriedEvidence,
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
mkdirSync(path.join(STAGING, "runs/verify-rtl-evidence-v1-control"), { recursive: true });
mkdirSync(path.join(STAGING, "runs/verify-rtl-evidence-v1-treatment"), { recursive: true });

for (const id of CONTROL) copyRun(id, "verify-rtl-evidence-v1-control");
for (const id of TREATMENT) copyRun(id, "verify-rtl-evidence-v1-treatment");

execSync(
  `cp artifacts/experiments/verify-rtl-evidence-v1-control/*.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
execSync(
  `cp artifacts/experiments/verify-rtl-evidence-v1-treatment/*.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
execSync(
  `cp artifacts/experiments/verify-rtl-evidence-v1-cohort-pair.log "${STAGING}/experiment-logs/" 2>/dev/null || true`,
  { shell: "/bin/bash" },
);
cpSync(
  "docs/v2/control-floor/experiment-verify-rtl-evidence-v1-preregistration.md",
  path.join(STAGING, "docs/experiment-verify-rtl-evidence-v1-preregistration.md"),
);
if (existsSync("docs/v2/control-floor/forensic-207k-verify-oracle.md")) {
  cpSync(
    "docs/v2/control-floor/forensic-207k-verify-oracle.md",
    path.join(STAGING, "docs/forensic-207k-verify-oracle.md"),
  );
}
if (existsSync("docs/v2/control-floor/next-lever-test-as-oracle.md")) {
  cpSync(
    "docs/v2/control-floor/next-lever-test-as-oracle.md",
    path.join(STAGING, "docs/next-lever-test-as-oracle.md"),
  );
}

const c = CONTROL.map(inspect);
const t = TREATMENT.map(inspect);
const cOk = c.filter((r) => r.status === "success");
const tOk = t.filter((r) => r.status === "success");
const summary = {
  experiment: "verify-rtl-evidence-v1",
  date: "2026-09-04",
  stack: "HARNESS_OWNED_VERIFY=1 ROOT_ERROR_FIRST=1 PERSISTENCE=1 TAILWIND=1 CSS=0",
  control: {
    id: "verify-rtl-evidence-v1-control",
    flag: "HARNESS_VERIFY_RTL_EVIDENCE_V1=0",
    reps: c,
    harness_ok: `${cOk.length}/${c.length}`,
    median_weighted_all: med(c.map((r) => r.weighted_total)),
    median_weighted_success: med(cOk.map((r) => r.weighted_total)),
    activated: `${c.filter((r) => r.activated_role_name_fail).length}/${c.length}`,
  },
  treatment: {
    id: "verify-rtl-evidence-v1-treatment",
    flag: "HARNESS_VERIFY_RTL_EVIDENCE_V1=1",
    note: "Rep1 failed harness on invalid report.partial.json (app tests/build/dev passed).",
    reps: t,
    harness_ok: `${tOk.length}/${t.length}`,
    median_weighted_all: med(t.map((r) => r.weighted_total)),
    median_weighted_success: med(tOk.map((r) => r.weighted_total)),
    activated: `${t.filter((r) => r.activated_role_name_fail).length}/${t.length}`,
    queried_evidence_runs: t.filter((r) => r.queried_evidence_blocks > 0).length,
  },
  evaluation_note:
    "Score all-runs and activated subset separately. Activated = ≥1 role+name VERIFY FAIL; treatment activation also expects QUERIED evidence.",
};

writeFileSync(path.join(STAGING, "cohort-summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(
  path.join(STAGING, "EXPORT_MANIFEST.json"),
  JSON.stringify(
    {
      export_name: "cohort-verify-rtl-evidence-v1-2026-09-04",
      generated_at: new Date().toISOString(),
      description:
        "Legacy compact reporter vs relevance-preserving RTL role/name evidence on frozen default stack.",
      preregistration: "docs/experiment-verify-rtl-evidence-v1-preregistration.md",
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
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            zf.write(full, os.path.relpath(full, parent))
print(zip_path)
PY`,
  { shell: "/bin/bash", stdio: "inherit" },
);

console.log(JSON.stringify(summary, null, 2));
