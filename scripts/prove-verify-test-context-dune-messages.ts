/**
 * Deterministic VERIFY message proof for TEST_CONTEXT evidence v1.
 * Same Dune mid-spiral fixture — control lacks TEST CONTEXT; treatment has exact window.
 *
 *   node --import tsx scripts/prove-verify-test-context-dune-messages.ts
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/verify-test-context-dune-148k");
const OUT_DIR = path.join(REPO, "artifacts/experiments/verify-test-context-dune-148k");
const TEMPLATE = path.join(REPO, "app-template-base");

function runNpmTest(appRoot: string, testContext: "0" | "1"): string {
  try {
    return execSync("npm test", {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HARNESS_VERIFY_RTL_EVIDENCE_V1: "1",
        HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1: "1",
        HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1: "1",
        HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1: testContext,
        CI: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }
}

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "test-context-dune-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("node_modules") && !src.endsWith(`${path.sep}dist`),
  });
  mkdirSync(path.join(root, "src"), { recursive: true });
  cpSync(path.join(FIXTURE, "src"), path.join(root, "src"), { recursive: true });
  const liveSelfTest = path.join(root, "test/compact-failure-multiple-live.test.ts");
  if (existsSync(liveSelfTest)) rmSync(liveSelfTest, { force: true });
  const reuseCandidates = [
    path.join(REPO, "output/app/node_modules"),
    path.join(TEMPLATE, "node_modules"),
  ];
  for (const nm of reuseCandidates) {
    if (existsSync(nm)) {
      execSync(`cp -a "${nm}" "${path.join(root, "node_modules")}"`, { stdio: "ignore" });
      break;
    }
  }
  if (!existsSync(path.join(root, "node_modules"))) {
    execSync("npm ci --ignore-scripts --prefer-offline", { cwd: root, stdio: "inherit" });
  }
  return root;
}

mkdirSync(OUT_DIR, { recursive: true });
const appRoot = prepareApp();

const controlOut = runNpmTest(appRoot, "0");
const treatmentOut = runNpmTest(appRoot, "1");

writeFileSync(path.join(OUT_DIR, "control-npm-test.txt"), controlOut);
writeFileSync(path.join(OUT_DIR, "treatment-npm-test.txt"), treatmentOut);

const advice = /filter is wrong|edit the test|prefer (?:editing|fixing)|maybe your/i;
const controlHasContext = /TEST CONTEXT/.test(controlOut);
const treatmentHasContext = /TEST CONTEXT/.test(treatmentOut);
const treatmentHasFailLine = />\s*65\|/.test(treatmentOut);
const treatmentHasMarkReturned = /Mark returned/.test(
  treatmentOut.slice(treatmentOut.indexOf("TEST CONTEXT")),
);
const treatmentHasDuneQuery = /heading.*Dune|name:\s*"Dune"/.test(
  treatmentOut.slice(Math.max(0, treatmentOut.indexOf("TEST CONTEXT"))),
);
const controlDuneMiss = /Unable to find[\s\S]*Dune|heading[\s\S]*Dune/i.test(controlOut);
const treatmentDuneMiss = /Unable to find[\s\S]*Dune|heading[\s\S]*Dune/i.test(treatmentOut);
const noAdvice =
  !advice.test(treatmentOut) && !/RECENT TEST ACTIONS/.test(treatmentOut);

const proof = {
  control_has_test_context: controlHasContext,
  treatment_has_test_context: treatmentHasContext,
  treatment_has_fail_line_65: treatmentHasFailLine,
  treatment_context_includes_mark_returned: treatmentHasMarkReturned,
  treatment_context_includes_dune_query: treatmentHasDuneQuery,
  both_show_dune_miss: controlDuneMiss && treatmentDuneMiss,
  no_advice_or_recent_actions: noAdvice,
  pass:
    !controlHasContext &&
    treatmentHasContext &&
    treatmentHasFailLine &&
    treatmentHasMarkReturned &&
    treatmentHasDuneQuery &&
    controlDuneMiss &&
    treatmentDuneMiss &&
    noAdvice,
};

writeFileSync(path.join(OUT_DIR, "message-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));
if (!proof.pass) {
  console.error("PROOF FAILED — see", OUT_DIR);
  process.exit(1);
}
console.log("PROOF PASS — control/treatment differ only by TEST CONTEXT");
rmSync(appRoot, { recursive: true, force: true });
