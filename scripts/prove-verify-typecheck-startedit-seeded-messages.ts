/**
 * Prove sealed fixture: VERIFY shows display-value miss; with TYPECHECK flag,
 * harness output also includes TS2345 for startEdit(book.id).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { runHarnessOwnedVerifyAt } from "../solution/extensions/harness-owned-verify.ts";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/verify-typecheck-startedit-seeded");
const OUT = path.join(REPO, "artifacts/experiments/verify-typecheck-startedit-seeded");
const TEMPLATE = path.join(REPO, "app-template-base");

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "typecheck-seeded-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (s) => !s.includes("node_modules") && !s.endsWith(`${path.sep}dist`),
  });
  cpSync(FIXTURE, root, {
    recursive: true,
    filter: (s) => !s.endsWith("repair-idea.txt"),
  });
  const live = path.join(root, "test/compact-failure-multiple-live.test.ts");
  if (existsSync(live)) rmSync(live, { force: true });
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

const report = {
  generated_at: new Date().toISOString(),
  claim:
    "Same startEdit(book.id) fixture: control VERIFY has display-value miss without TYPECHECK; treatment adds TS2345.",
  control: {
    exitCode: control.exitCode,
    has_display_value_dune: /display value:\s*Dune/i.test(control.text),
    has_typecheck: /TYPECHECK/.test(control.text),
    has_ts2345: /TS2345/.test(control.text),
    excerpt: control.text.slice(0, 500),
  },
  treatment: {
    exitCode: treatment.exitCode,
    has_display_value_dune: /display value:\s*Dune/i.test(treatment.text),
    has_typecheck: /TYPECHECK/.test(treatment.text),
    has_ts2345: /TS2345/.test(treatment.text),
    has_book_assignability: /string.*Book|Book/i.test(treatment.text),
    excerpt: treatment.text.slice(0, 700),
  },
};

const ok =
  control.exitCode !== 0 &&
  treatment.exitCode !== 0 &&
  report.control.has_display_value_dune &&
  !report.control.has_typecheck &&
  report.treatment.has_display_value_dune &&
  report.treatment.has_typecheck &&
  report.treatment.has_ts2345;

report.verdict = ok ? "VERIFIED" : "NOT VERIFIED";
writeFileSync(path.join(OUT, "message-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
rmSync(appRoot, { recursive: true, force: true });
if (!ok) process.exitCode = 1;
