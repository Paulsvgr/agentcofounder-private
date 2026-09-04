/**
 * Deterministic VERIFY message proof for VERIFY_RTL_MULTIPLE_EVIDENCE_V1.
 *
 * Same sealed failing fixture, old reporter vs fixed reporter.
 * Proves what Pi would see — no random cohort, no Pi cost.
 *
 *   node --import tsx scripts/prove-verify-rtl-multiple-seeded-messages.ts
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  hasParsedMultipleCandidates,
} from "../app-template-base/compactFailureMessage.ts";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures/verify-rtl-multiple-seeded");
const OUT_DIR = path.join(REPO, "artifacts/experiments/verify-rtl-multiple-seeded");
const TEMPLATE = path.join(REPO, "app-template-base");

function runNpmTest(appRoot: string, multipleEvidence: "0" | "1"): string {
  try {
    return execSync("npm test", {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HARNESS_VERIFY_RTL_EVIDENCE_V1: "1",
        HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1: multipleEvidence,
        // Avoid compact reporter being swapped off
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
  // Fallback: whole FAIL sections
  if (blocks.length === 0 && /Found multiple elements/i.test(output)) {
    blocks.push(output.slice(0, 2000));
  }
  return blocks;
}

function prepareApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "rtl-multiple-seeded-"));
  cpSync(TEMPLATE, root, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("node_modules") && !src.endsWith(`${path.sep}dist`),
  });
  // Overlay seeded failing sources (keep template test setup / vitest config)
  mkdirSync(path.join(root, "src"), { recursive: true });
  cpSync(path.join(FIXTURE, "src/App.tsx"), path.join(root, "src/App.tsx"));
  cpSync(path.join(FIXTURE, "src/App.test.tsx"), path.join(root, "src/App.test.tsx"));
  // Do not run harness self-tests inside the seeded app suite.
  const liveSelfTest = path.join(root, "test/compact-failure-multiple-live.test.ts");
  if (existsSync(liveSelfTest)) rmSync(liveSelfTest, { force: true });
  // Prefer reusing installed modules from output/app or template
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

const scienceLegacy = legacyMsgs.find((m) => /text:\s*Science/i.test(m)) ?? legacyMsgs[0] ?? "";
const scienceTreat = treatmentMsgs.find((m) => /text:\s*Science|text="Science"/i.test(m)) ?? treatmentMsgs[0] ?? "";
const lendLegacy =
  legacyMsgs.find((m) => /Lend out/i.test(m) && /multiple elements with the role/i.test(m)) ??
  legacyMsgs.find((m) => /Lend out/i.test(m)) ??
  "";
const lendTreat =
  treatmentMsgs.find((m) => /Lend out/i.test(m) && (/MATCHES PRESENT|QUERY/i.test(m) || /multiple/i.test(m))) ??
  treatmentMsgs.find((m) => /Lend out/i.test(m)) ??
  "";

const report = {
  generated_at: new Date().toISOString(),
  claim:
    "On the same seeded failing fixture, MULTIPLE_EVIDENCE=1 shows parsed candidates; =0 does not.",
  fixture: "fixtures/verify-rtl-multiple-seeded",
  cases: {
    science: {
      legacy_excerpt: scienceLegacy.slice(0, 600),
      treatment_excerpt: scienceTreat.slice(0, 600),
      treatment_has_parsed_candidates: hasParsedMultipleCandidates(scienceTreat),
      treatment_has_option: /<option>/i.test(scienceTreat),
      treatment_has_span_badge: /<span>.*class="badge"/i.test(scienceTreat),
      legacy_looks_like_tag_tokens:
        /<\/option>|<\/span>/.test(scienceLegacy) && !hasParsedMultipleCandidates(scienceLegacy),
    },
    lend_out: {
      legacy_excerpt: lendLegacy.slice(0, 600),
      treatment_excerpt: lendTreat.slice(0, 600),
      treatment_has_parsed_candidates: hasParsedMultipleCandidates(lendTreat),
      treatment_button_candidate_lines: (lendTreat.match(/^\d+\.\s+<button>/gm) || []).length,
      legacy_looks_like_tag_tokens:
        /<\/button>/.test(lendLegacy) && !hasParsedMultipleCandidates(lendLegacy),
    },
  },
};

const scienceOk =
  report.cases.science.treatment_has_parsed_candidates &&
  report.cases.science.treatment_has_option &&
  report.cases.science.treatment_has_span_badge;
const lendOk =
  report.cases.lend_out.treatment_has_parsed_candidates &&
  report.cases.lend_out.treatment_button_candidate_lines >= 2;

report.verdict = scienceOk && lendOk ? "VERIFIED" : "NOT VERIFIED";
report.gates = { scienceOk, lendOk };

writeFileSync(path.join(OUT_DIR, "message-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

rmSync(appRoot, { recursive: true, force: true });

if (report.verdict !== "VERIFIED") {
  process.exitCode = 1;
}
