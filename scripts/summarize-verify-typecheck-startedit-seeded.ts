/**
 * Compare control vs treatment seeded startEdit repair runs.
 *
 * Usage:
 *   node --import tsx scripts/summarize-verify-typecheck-startedit-seeded.ts \
 *     --control <runId> --treatment <runId>
 *
 * Or omit IDs to pick latest runs tagged RUN_EXPERIMENT=*startedit-seeded-*.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const RUNS_DIR = path.join(REPO, "artifacts/runs");
const OUT_DIR = path.join(REPO, "artifacts/experiments/verify-typecheck-startedit-seeded");

type EditKind = "test" | "product" | "other";

function parseArgs(): { control?: string; treatment?: string } {
  const out: { control?: string; treatment?: string } = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--control") out.control = argv[++i];
    if (argv[i] === "--treatment") out.treatment = argv[++i];
  }
  return out;
}

function findLatestByExperiment(substr: string): string | undefined {
  const dirs = readdirSync(RUNS_DIR)
    .filter((d) => existsSync(path.join(RUNS_DIR, d, "run.json")))
    .sort()
    .reverse();
  for (const d of dirs) {
    try {
      const meta = JSON.parse(readFileSync(path.join(RUNS_DIR, d, "run.json"), "utf8"));
      const exp = String(meta.experiment ?? meta.RUN_EXPERIMENT ?? meta.env?.RUN_EXPERIMENT ?? "");
      if (exp.includes(substr)) return d;
    } catch {
      /* skip */
    }
    const envPath = path.join(RUNS_DIR, d, "env.json");
    if (existsSync(envPath)) {
      try {
        const env = JSON.parse(readFileSync(envPath, "utf8"));
        if (String(env.RUN_EXPERIMENT ?? "").includes(substr)) return d;
      } catch {
        /* skip */
      }
    }
  }
  return undefined;
}

function sessionPath(runId: string): string {
  const dir = path.join(RUNS_DIR, runId, "sessions");
  const f = readdirSync(dir).find((x) => x.endsWith(".jsonl"));
  if (!f) throw new Error(`No session jsonl in ${dir}`);
  return path.join(dir, f);
}

function weightedFromUsage(u: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cache_read_tokens?: number;
}): number {
  const input = u.input ?? 0;
  const output = u.output ?? 0;
  const cacheRead = u.cacheRead ?? u.cache_read_tokens ?? 0;
  return input + output * 3 + cacheRead * 0.1;
}

function classifyPath(p: string): EditKind {
  const n = p.replace(/\\/g, "/");
  if (/\.test\.[tj]sx?$/.test(n) || /\/test\//.test(n) || /debug/i.test(n)) return "test";
  if (/\/src\/App\.tsx$/.test(n) || /\/src\/.+\.[tj]sx?$/.test(n)) return "product";
  return "other";
}

function analyze(runId: string, arm: string) {
  const runMetaPath = path.join(RUNS_DIR, runId, "run.json");
  const runMeta = existsSync(runMetaPath)
    ? JSON.parse(readFileSync(runMetaPath, "utf8"))
    : {};
  const lines = readFileSync(sessionPath(runId), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  let callIdx = 0;
  const toolArgs = new Map<string, { name: string; args: Record<string, unknown> }>();
  const events: Array<{
    call: number;
    name: string;
    args: Record<string, unknown>;
    resultText: string;
    weightedDelta: number;
  }> = [];

  let cumulativeWeighted = 0;
  let firstFailAt: number | null = null;
  let greenAt: number | null = null;
  const verifySequence: string[] = [];
  let firstDiagnosis = "";
  let firstEdit: {
    call: number;
    op: string;
    kind: EditKind;
    path: string;
  } | null = null;
  let correctFixAt: number | null = null;
  const editsSummary = { test: 0, product: 0, other: 0 };
  let unrelatedProductOrTest = 0;
  let firstVerifyExcerpt = "";
  let sawTs2345 = false;
  let sawTypecheck = false;
  let sawDisplayDune = false;

  for (const ev of lines) {
    if (ev.type === "message" && ev.message?.role === "assistant") {
      const content = ev.message.content ?? [];
      for (const part of content) {
        if (part.type === "text" && typeof part.text === "string") {
          if (!firstDiagnosis && firstFailAt !== null && callIdx >= firstFailAt) {
            const t = part.text.trim();
            if (t.length > 40) firstDiagnosis = t.slice(0, 280);
          }
        }
        if (part.type === "toolCall" || part.type === "tool_use") {
          callIdx += 1;
          const id = part.id ?? part.toolCallId ?? `c${callIdx}`;
          const name = part.name ?? part.toolName ?? "";
          const args = (part.arguments ?? part.input ?? {}) as Record<string, unknown>;
          toolArgs.set(String(id), { name, args });
        }
      }
      const usage = ev.message.usage ?? ev.usage;
      if (usage) cumulativeWeighted += weightedFromUsage(usage);
    }

    if (ev.type === "message" && ev.message?.role === "toolResult") {
      const id = String(ev.message.toolCallId ?? ev.toolCallId ?? "");
      const meta = toolArgs.get(id);
      if (!meta) continue;
      const text =
        typeof ev.message.content === "string"
          ? ev.message.content
          : Array.isArray(ev.message.content)
            ? ev.message.content.map((c: { text?: string }) => c.text ?? "").join("\n")
            : String(ev.message.content ?? ev.message.result ?? "");

      events.push({
        call: callIdx,
        name: meta.name,
        args: meta.args,
        resultText: text,
        weightedDelta: 0,
      });

      const isVerify =
        meta.name === "verify" ||
        meta.name === "harness_owned_verify" ||
        /verify/i.test(meta.name);

      if (isVerify) {
        const fail = /FAIL|exit_code=1|exit code.?1/i.test(text) && !/exit_code=0 \(PASS\)/.test(text);
        const pass = /exit_code=0 \(PASS\)|✅ PASS/i.test(text) && !fail;
        if (fail && firstFailAt === null) {
          firstFailAt = callIdx;
          firstVerifyExcerpt = text.replace(/\s+/g, " ").slice(0, 400);
          sawTs2345 = /TS2345/.test(text);
          sawTypecheck = /TYPECHECK/.test(text);
          sawDisplayDune = /display value:\s*Dune/i.test(text);
        }
        if (pass && greenAt === null && firstFailAt !== null) greenAt = callIdx;
        const flags = [
          fail ? "FAIL" : pass ? "PASS" : "?",
          /TYPECHECK/.test(text) ? "+TC" : "",
          /TS2345/.test(text) ? "+2345" : "",
          /display value:\s*Dune/i.test(text) ? "+Dune" : "",
        ]
          .filter(Boolean)
          .join("");
        verifySequence.push(`${callIdx}:${flags}`);
      }

      const op = meta.name;
      if (op === "edit" || op === "write" || op === "str_replace" || op === "apply_patch") {
        const p = String(
          meta.args.path ?? meta.args.file_path ?? meta.args.filePath ?? "",
        );
        if (p && firstFailAt !== null && (greenAt === null || callIdx <= greenAt)) {
          const kind = classifyPath(p);
          editsSummary[kind] += 1;
          if (!firstEdit) {
            firstEdit = { call: callIdx, op, kind, path: p };
          }
          const argsStr = JSON.stringify(meta.args);
          const resultStr = text;
          const blob = `${argsStr}\n${resultStr}`;
          const fixedStartEdit =
            /startEdit\(\s*book\s*\)/.test(blob) &&
            (/startEdit\(\s*book\.id\s*\)/.test(blob) ||
              /book\.id/.test(String(meta.args.old_string ?? meta.args.oldString ?? "")) ||
              /startEdit\(book\.id\)/.test(String(meta.args.oldText ?? "")));
          // Also detect write that contains correct call without wrong id
          const productFix =
            /\/src\/App\.tsx$/.test(p.replace(/\\/g, "/")) &&
            (/startEdit\(\s*book\s*\)/.test(blob) ||
              /onClick=\{\(\)\s*=>\s*startEdit\(book\)\}/.test(blob));
          if ((fixedStartEdit || productFix) && correctFixAt === null) {
            correctFixAt = callIdx;
          }
          if (kind === "test" || (kind === "product" && !productFix && !fixedStartEdit)) {
            // Count edits that aren't the one-line startEdit fix as unrelated surface
            if (!(productFix || fixedStartEdit)) unrelatedProductOrTest += 1;
          }
        }
      }
    }
  }

  // Fallback: scan final App.tsx in run artifact for fix
  const appArtifact = path.join(RUNS_DIR, runId, "app", "src", "App.tsx");
  let finalHasCorrectFix = false;
  let finalStillHasBug = false;
  if (existsSync(appArtifact)) {
    const src = readFileSync(appArtifact, "utf8");
    finalHasCorrectFix = /startEdit\(\s*book\s*\)/.test(src) && !/startEdit\(\s*book\.id\s*\)/.test(src);
    finalStillHasBug = /startEdit\(\s*book\.id\s*\)/.test(src);
  }

  const repairCalls =
    firstFailAt !== null && greenAt !== null
      ? greenAt - firstFailAt
      : firstFailAt !== null
        ? callIdx - firstFailAt
        : null;

  const failStreak = verifySequence.filter((s) => s.includes("FAIL")).length;

  return {
    arm,
    runId,
    status: runMeta.status ?? runMeta.result ?? "unknown",
    weighted: Math.round(cumulativeWeighted),
    calls: callIdx,
    greenAt,
    firstFailAt,
    repairCalls,
    repairWeighted: null as number | null, // filled below if we can
    firstVerifyEvidence: {
      sawDisplayDune,
      sawTypecheck,
      sawTs2345,
      excerpt: firstVerifyExcerpt,
    },
    firstDiagnosis,
    firstEdit,
    correctFixAt,
    finalHasCorrectFix,
    finalStillHasBug,
    editsSummary,
    unrelatedProductOrTest,
    failVerifyCount: failStreak,
    verifySequence,
  };
}

function main() {
  const args = parseArgs();
  const controlId =
    args.control ?? findLatestByExperiment("verify-typecheck-startedit-seeded-control");
  const treatmentId =
    args.treatment ?? findLatestByExperiment("verify-typecheck-startedit-seeded-treatment");
  if (!controlId || !treatmentId) {
    console.error("Need --control and --treatment runIds (or completed tagged runs).");
    console.error({ controlId, treatmentId });
    process.exit(1);
  }

  const control = analyze(controlId, "control");
  const treatment = analyze(treatmentId, "treatment");
  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    claim:
      "Treatment TYPECHECK TS2345 on VERIFY FAIL steers Pi to startEdit(book) faster than display-value-only control.",
    control,
    treatment,
    delta: {
      repairCalls:
        control.repairCalls !== null && treatment.repairCalls !== null
          ? control.repairCalls - treatment.repairCalls
          : null,
      weighted: control.weighted - treatment.weighted,
      correctFixEarlier:
        control.correctFixAt !== null && treatment.correctFixAt !== null
          ? treatment.correctFixAt < control.correctFixAt
          : treatment.correctFixAt !== null && control.correctFixAt === null,
      treatmentSawTs2345: treatment.firstVerifyEvidence.sawTs2345,
      controlSawTs2345: control.firstVerifyEvidence.sawTs2345,
    },
  };
  const outPath = path.join(OUT_DIR, "seeded-repair-compare.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`Wrote ${outPath}`);
}

main();
