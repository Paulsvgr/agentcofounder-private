/**
 * Offline retro scan: test-authoring-guard F1–F6 vs Q2-B historical runs.
 * Does not modify scanner rules — report only.
 *
 * Usage: node --import tsx scripts/retro-scan-q2b-guard.ts
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyEditsToContent } from "./replay-run.js";
import {
  scanTestDirectory,
  scanTestSource,
  type GuardViolation,
} from "../solution/extensions/test-authoring-scan.js";

const STAGING_ROOT = path.resolve(
  "artifacts/exports/q2-verify-repair-v1-staging/runs/q2-verify-repair-v1",
);

const RUN_IDS = [
  "2026-09-01T22-06-25-887Z",
  "2026-09-01T22-08-29-987Z",
  "2026-09-01T22-11-08-817Z",
  "2026-09-01T22-13-29-071Z",
  "2026-09-01T22-16-29-462Z",
];

interface LedgerCall {
  index: number;
  tools: Array<{
    name: string;
    detail: string;
    paths: string[];
    output: string;
    is_error: boolean;
  }>;
}

interface LedgerFile {
  calls: LedgerCall[];
}

interface VerifyFailureItem {
  callIndex: number;
  verifyOrdinal: number;
  type: string;
  at: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseVerifyFailures(output: string, callIndex: number, verifyOrdinal: number): VerifyFailureItem[] {
  const items: VerifyFailureItem[] = [];
  const chunks = output.split(/\n(?=TYPE\s+)/g);
  for (const chunk of chunks) {
    if (!chunk.includes("TestingLibraryElementError") && !chunk.includes("FAIL")) continue;
    const typeMatch = /TYPE\s+(\S+)/.exec(chunk);
    const atMatch = /AT\s+at\s+(.+)/.exec(chunk);
    const messageMatch = /MESSAGE\s*\n([\s\S]*?)(?:\nIgnored nodes:|\nMATCHES:|$)/.exec(chunk);
    if (!typeMatch && !messageMatch) continue;
    items.push({
      callIndex,
      verifyOrdinal,
      type: typeMatch?.[1] ?? "unknown",
      at: atMatch?.[1]?.trim() ?? "",
      message: (messageMatch?.[1] ?? chunk).trim().split("\n")[0] ?? chunk.slice(0, 120),
    });
  }
  if (items.length === 0 && output.includes("FAIL")) {
    const summary = output.split("\n").find((line) => line.includes("FAIL")) ?? output.slice(0, 160);
    items.push({
      callIndex,
      verifyOrdinal,
      type: output.includes("suite_error") || output.includes("0/0") ? "suite_error" : "verify_fail",
      at: "",
      message: summary.trim(),
    });
  }
  return items;
}

function reconstructTestFileBeforeCall(ledger: LedgerFile, beforeCallIndex: number): string | null {
  let current: string | null = null;
  for (const call of ledger.calls) {
    if (call.index >= beforeCallIndex) break;
    for (const tool of call.tools) {
      if (tool.detail !== "src/App.test.tsx" && !tool.paths.includes("src/App.test.tsx")) continue;
      if (tool.name === "write") {
        const content = tool.paths.find((entry) => entry.includes("import ") && entry.includes("describe("));
        if (content) current = content;
      } else if (tool.name === "edit" && current !== null) {
        const edits: Array<{ oldText: string; newText: string }> = [];
        for (let i = 0; i + 1 < tool.paths.length; i += 2) {
          const oldText = tool.paths[i];
          const newText = tool.paths[i + 1];
          if (typeof oldText === "string" && typeof newText === "string" && oldText !== "src/App.test.tsx") {
            edits.push({ oldText, newText });
          }
        }
        if (edits.length > 0) {
          try {
            current = applyEditsToContent(current, edits);
          } catch {
            // keep best-effort snapshot
          }
        }
      }
    }
  }
  return current;
}

function formatViolation(v: GuardViolation): string {
  return `${v.patternId} ${v.file}:${v.line}`;
}

function summarizeScan(label: string, appRoot: string) {
  const result = scanTestDirectory(appRoot);
  const blocking = result.allViolations.filter((v) => v.blocking);
  const f6 = result.reportOnlyHits;
  return {
    label,
    blockingHit: result.blockingHit ? formatViolation(result.blockingHit) : null,
    blocking,
    f6,
  };
}

function writeAppRoot(content: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "guard-retro-"));
  const srcDir = path.join(root, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(path.join(srcDir, "App.test.tsx"), content, "utf8");
  return root;
}

function main(): void {
  const report: unknown[] = [];

  for (const runId of RUN_IDS) {
    const runDir = path.join(STAGING_ROOT, runId);
    const ledger = JSON.parse(
      readFileSync(path.join(runDir, "analysis", "ledger.json"), "utf8"),
    ) as LedgerFile;
    const trajectory = JSON.parse(
      readFileSync(path.join(runDir, "analysis", "trajectory.v2.json"), "utf8"),
    ) as {
      verification_runs: Array<{ call_index: number; canonical_outcome: string; raw_summary: string }>;
    };

    const verifyRuns = trajectory.verification_runs.filter((run) => run.canonical_outcome !== "unknown");
    const firstVerify = verifyRuns[0];
    const firstFailVerify = verifyRuns.find((run) => run.canonical_outcome === "fail");

    const verifyFailures: VerifyFailureItem[] = [];
    let verifyOrdinal = 0;
    for (const call of ledger.calls) {
      for (const tool of call.tools) {
        if (tool.name !== "verify") continue;
        verifyOrdinal += 1;
        if (!tool.output.includes("FAIL") && !tool.output.includes("exit_code=1")) continue;
        verifyFailures.push(...parseVerifyFailures(tool.output, call.index, verifyOrdinal));
      }
    }

    const beforeFirstVerify = firstVerify
      ? reconstructTestFileBeforeCall(ledger, firstVerify.call_index)
      : null;

    const temps: string[] = [];
    const scans: Record<string, ReturnType<typeof summarizeScan>> = {};

    if (beforeFirstVerify) {
      const root = writeAppRoot(beforeFirstVerify);
      temps.push(root);
      scans.before_first_verify = summarizeScan("before_first_verify", root);
    }

    const finalPath = path.join(runDir, "app");
    scans.final_app = summarizeScan("final_app", finalPath);

    for (const temp of temps) rmSync(temp, { recursive: true, force: true });

    const blockingBefore = scans.before_first_verify?.blocking ?? [];
    const f6Before = scans.before_first_verify?.f6 ?? [];

    report.push({
      run_id: runId,
      first_verify_call: firstVerify?.call_index ?? null,
      first_fail_verify_call: firstFailVerify?.call_index ?? null,
      verify_failure_items: verifyFailures,
      scan_before_first_verify: {
        blocking_hit: scans.before_first_verify?.blockingHit ?? null,
        blocking_violations: blockingBefore.map(formatViolation),
        blocking_by_pattern: Object.fromEntries(
          ["F1", "F2", "F3", "F4", "F5"].map((id) => [
            id,
            blockingBefore.filter((v) => v.patternId === id).length,
          ]),
        ),
        f6_report_only: f6Before.map(formatViolation),
      },
      scan_final_app: {
        blocking_hit: scans.final_app.blockingHit,
        blocking_count: scans.final_app.blocking.length,
        f6_count: scans.final_app.f6.length,
      },
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
