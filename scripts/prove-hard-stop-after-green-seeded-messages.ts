/**
 * Prove green fixture: VERIFY PASS; treatment adds HARD_STOP; control does not.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { runHarnessOwnedVerifyAt } from "../solution/extensions/harness-owned-verify.ts";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/hard-stop-after-green-seeded");
const OUT = path.join(REPO, "artifacts/experiments/hard-stop-after-green-seeded");
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
}

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "hard-stop-seeded-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (s) => !s.includes("node_modules") && !s.endsWith(`${path.sep}dist`),
  });
  cpSync(FIXTURE, root, {
    recursive: true,
    filter: (s) => !s.endsWith("repair-idea.txt"),
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

process.env.HARNESS_OWNED_VERIFY = "1";
process.env.HARNESS_VERIFY_RTL_EVIDENCE_V1 = "1";
process.env.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1 = "1";
process.env.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
process.env.HARNESS_ERROR_MEMORY_V1 = "0";
process.env.HARNESS_VERIFY_REPAIR_V1 = "0";
process.env.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1 = "1";

process.env.HARNESS_HARD_STOP_AFTER_GREEN_V1 = "0";
const control = runHarnessOwnedVerifyAt(appRoot);
writeFileSync(path.join(OUT, "verify-control.raw.txt"), control.text);

process.env.HARNESS_HARD_STOP_AFTER_GREEN_V1 = "1";
const treatment = runHarnessOwnedVerifyAt(appRoot);
writeFileSync(path.join(OUT, "verify-treatment.raw.txt"), treatment.text);

const report = {
  generated_at: new Date().toISOString(),
  claim:
    "Already-green seed: both arms VERIFY PASS; treatment appends HARD_STOP; control does not.",
  control: {
    exitCode: control.exitCode,
    status: control.status,
    has_hard_stop: /HARD_STOP/.test(control.text),
    excerpt: control.text.slice(0, 400),
  },
  treatment: {
    exitCode: treatment.exitCode,
    status: treatment.status,
    has_hard_stop: /HARD_STOP/.test(treatment.text),
    excerpt: treatment.text.slice(0, 500),
  },
};

const ok =
  control.exitCode === 0 &&
  treatment.exitCode === 0 &&
  !report.control.has_hard_stop &&
  report.treatment.has_hard_stop;

report.verdict = ok ? "VERIFIED" : "NOT VERIFIED";
writeFileSync(path.join(OUT, "message-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
rmSync(appRoot, { recursive: true, force: true });
if (!ok) process.exitCode = 1;
