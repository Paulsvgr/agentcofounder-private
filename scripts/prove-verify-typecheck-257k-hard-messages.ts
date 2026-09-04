/**
 * Hard 257k seed message proof:
 * same snapshot fail surface; treatment adds TYPECHECK TS2345 only.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { runHarnessOwnedVerifyAt } from "../solution/extensions/harness-owned-verify.ts";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/verify-typecheck-257k-hard");
const OUT = path.join(REPO, "artifacts/experiments/verify-typecheck-257k-hard");
const TEMPLATE = path.join(REPO, "app-template-base");

function stripHarnessSelfTests(root: string) {
  const testDir = path.join(root, "test");
  if (existsSync(testDir)) {
    for (const name of readdirSync(testDir)) {
      if (/compact-failure|harness-owned|self-test/i.test(name)) {
        rmSync(path.join(testDir, name), { force: true });
      }
    }
  }
  rmSync(path.join(root, "src/debug.test.tsx"), { force: true });
  rmSync(path.join(root, "src/debug.test.ts"), { force: true });
}

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "typecheck-257k-hard-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (s) => !s.includes("node_modules") && !s.endsWith(`${path.sep}dist`),
  });
  cpSync(FIXTURE, root, {
    recursive: true,
    filter: (s) => !s.endsWith("repair-idea.txt") && !s.endsWith("README.md"),
  });
  stripHarnessSelfTests(root);
  const nm = path.join(REPO, "output/app/node_modules");
  if (existsSync(nm)) {
    execSync(`cp -a "${nm}" "${path.join(root, "node_modules")}"`);
  } else {
    execSync("npm ci --ignore-scripts --prefer-offline", { cwd: root, stdio: "inherit" });
  }
  return root;
}

mkdirSync(OUT, { recursive: true });
const appRoot = prepareApp();

const appSrc = readFileSync(path.join(appRoot, "src/App.tsx"), "utf8");
if (!/startEdit\(\s*book\.id\s*\)/.test(appSrc)) {
  console.error("Fixture App missing startEdit(book.id)");
  process.exit(1);
}
if (/BUG:|string id passed where Book/i.test(appSrc)) {
  console.error("Fixture still has answer-key BUG comment");
  process.exit(1);
}

process.env.HARNESS_OWNED_VERIFY = "1";
process.env.HARNESS_VERIFY_RTL_EVIDENCE_V1 = "1";
process.env.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1 = "1";
process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
process.env.HARNESS_ERROR_MEMORY_V1 = "0";
process.env.HARNESS_VERIFY_REPAIR_V1 = "0";

process.env.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1 = "0";
const control = runHarnessOwnedVerifyAt(appRoot);
writeFileSync(path.join(OUT, "verify-control.raw.txt"), control.text);

process.env.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1 = "1";
const treatment = runHarnessOwnedVerifyAt(appRoot);
writeFileSync(path.join(OUT, "verify-treatment.raw.txt"), treatment.text);

const controlTests = (control.text.match(/FAIL\s+\d+\/\d+|PASS\s+\d+\/\d+/g) || []).join(" | ");
const treatmentTests = (treatment.text.match(/FAIL\s+\d+\/\d+|PASS\s+\d+\/\d+/g) || []).join(" | ");

const report = {
  generated_at: new Date().toISOString(),
  claim:
    "Hard 257k snapshot: identical fail surface; control = Dune miss only; treatment adds TYPECHECK TS2345. No harness self-tests.",
  source_run: "2026-09-04T09-25-09-799Z",
  fixture: "fixtures/verify-typecheck-257k-hard",
  control: {
    exitCode: control.exitCode,
    has_display_value_dune: /display value:\s*Dune/i.test(control.text),
    has_typecheck: /TYPECHECK/.test(control.text),
    has_ts2345: /TS2345/.test(control.text),
    harness_self_test: /compact-failure-multiple-live/i.test(control.text),
    summary_line: controlTests,
    excerpt: control.text.slice(0, 600),
  },
  treatment: {
    exitCode: treatment.exitCode,
    has_display_value_dune: /display value:\s*Dune/i.test(treatment.text),
    has_typecheck: /TYPECHECK/.test(treatment.text),
    has_ts2345: /TS2345/.test(treatment.text),
    has_book_assignability: /string.*Book|Book/i.test(treatment.text),
    harness_self_test: /compact-failure-multiple-live/i.test(treatment.text),
    summary_line: treatmentTests,
    excerpt: treatment.text.slice(0, 700),
  },
  same_fail_shape:
    /display value:\s*Dune/i.test(control.text) &&
    /display value:\s*Dune/i.test(treatment.text) &&
    control.exitCode !== 0 &&
    treatment.exitCode !== 0,
};

const ok =
  report.same_fail_shape &&
  !report.control.has_typecheck &&
  !report.control.harness_self_test &&
  report.treatment.has_typecheck &&
  report.treatment.has_ts2345 &&
  !report.treatment.harness_self_test;

report.verdict = ok ? "VERIFIED" : "NOT VERIFIED";
writeFileSync(path.join(OUT, "message-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
rmSync(appRoot, { recursive: true, force: true });
if (!ok) process.exitCode = 1;
