/**
 * Deterministic VERIFY message proof for VERIFY_RTL_TEXT_EVIDENCE_V1.
 *
 * Same sealed grammar-miss fixture, tip+junk vs QUERIED+VISIBLE TEXT.
 *
 *   node --import tsx scripts/prove-verify-rtl-text-grammar-seeded-messages.ts
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/verify-rtl-text-grammar-seeded");
const OUT_DIR = path.join(REPO, "artifacts/experiments/verify-rtl-text-grammar-seeded");
const TEMPLATE = path.join(REPO, "app-template-base");

function runNpmTest(appRoot: string, textEvidence: "0" | "1"): string {
  try {
    return execSync("npm test", {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HARNESS_VERIFY_RTL_EVIDENCE_V1: "1",
        HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1: "1",
        HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1: textEvidence,
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

function extractMessages(output: string): string[] {
  const blocks: string[] = [];
  const re = /MESSAGE\n([\s\S]*?)(?=\n(?:MATCHES\n|FAILURES |EXPECTED|RECEIVED|\[\d+\/\d+\]|\n✅|\n❌|$))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    blocks.push(m[1]!.trim());
  }
  return blocks;
}

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "rtl-text-grammar-seeded-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("node_modules") && !src.endsWith(`${path.sep}dist`),
  });
  mkdirSync(path.join(root, "src"), { recursive: true });
  cpSync(path.join(FIXTURE, "src/App.tsx"), path.join(root, "src/App.tsx"));
  cpSync(path.join(FIXTURE, "src/App.test.tsx"), path.join(root, "src/App.test.tsx"));
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

const legacyOut = runNpmTest(appRoot, "0");
const treatmentOut = runNpmTest(appRoot, "1");

writeFileSync(path.join(OUT_DIR, "verify-legacy.raw.txt"), legacyOut);
writeFileSync(path.join(OUT_DIR, "verify-treatment.raw.txt"), treatmentOut);

const legacyMsgs = extractMessages(legacyOut);
const treatmentMsgs = extractMessages(treatmentOut);

const lentLegacy =
  legacyMsgs.find((m) => /1 are currently lent out/i.test(m)) ?? legacyMsgs[0] ?? "";
const lentTreat =
  treatmentMsgs.find((m) => /1 are currently lent out/i.test(m)) ?? treatmentMsgs[0] ?? "";

const report = {
  generated_at: new Date().toISOString(),
  claim:
    "On the same seeded grammar-miss fixture, TEXT_EVIDENCE=1 shows QUERIED + VISIBLE TEXT with product copy; =0 keeps the function-matcher tip and lacks VISIBLE TEXT.",
  fixture: "fixtures/verify-rtl-text-grammar-seeded",
  cases: {
    lent_grammar: {
      legacy_excerpt: lentLegacy.slice(0, 700),
      treatment_excerpt: lentTreat.slice(0, 700),
      treatment_has_queried: /QUERIED/i.test(lentTreat),
      treatment_has_visible_text: /VISIBLE TEXT/i.test(lentTreat),
      treatment_shows_product_is: /1 is currently lent out/i.test(lentTreat),
      treatment_no_matcher_tip: !/function for your text matcher/i.test(lentTreat),
      legacy_has_matcher_tip: /function for your text matcher/i.test(lentLegacy),
      legacy_lacks_visible_text: !/VISIBLE TEXT/i.test(lentLegacy),
    },
  },
  verdict: "NOT VERIFIED" as "VERIFIED" | "NOT VERIFIED",
  gates: {} as Record<string, boolean>,
};

const g = report.cases.lent_grammar;
const ok =
  g.treatment_has_queried &&
  g.treatment_has_visible_text &&
  g.treatment_shows_product_is &&
  g.treatment_no_matcher_tip &&
  g.legacy_has_matcher_tip &&
  g.legacy_lacks_visible_text;

report.gates = { lentGrammarOk: ok };
report.verdict = ok ? "VERIFIED" : "NOT VERIFIED";

writeFileSync(path.join(OUT_DIR, "message-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

rmSync(appRoot, { recursive: true, force: true });

if (report.verdict !== "VERIFIED") {
  process.exitCode = 1;
}
