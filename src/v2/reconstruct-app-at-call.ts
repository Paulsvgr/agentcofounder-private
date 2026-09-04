/**
 * Reconstruct app filesystem state at a call boundary from events.jsonl.
 * Used for v2.2 control retro — source-derived metrics at post-mutation VERIFY anchor.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyEditsToContent } from "../../scripts/replay-run.js";
import { countAuthoredTestsInApp, isQualifyingTestFile } from "../../solution/extensions/early-verify-core.js";
import { listTestSourcesUnderSrc } from "../../solution/extensions/test-authoring-scan.js";

export interface FsOpAtCall {
  callIndex: number;
  toolIndex: number;
  kind: "write" | "edit";
  sourcePath: string;
  relativePath: string;
  content?: string;
  edits: Array<{ oldText: string; newText: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractCwd(rows: unknown[]): string {
  for (const row of rows) {
    if (isRecord(row) && row.type === "session" && typeof row.cwd === "string") {
      return row.cwd;
    }
  }
  return path.join(path.dirname(new URL(import.meta.url).pathname), "../../output/app");
}

function remapPath(originalPath: string, originalCwd: string, replayDir: string): string | null {
  if (originalPath.trim() === "") return null;

  const cwd = path.resolve(originalCwd);
  const resolved = path.isAbsolute(originalPath)
    ? path.resolve(originalPath)
    : path.resolve(cwd, originalPath);

  const marker = `${path.sep}output${path.sep}app`;
  const markerIndex = resolved.indexOf(marker);
  if (markerIndex >= 0) {
    const relative = resolved.slice(markerIndex + marker.length + 1);
    return relative === "" ? replayDir : path.join(replayDir, relative);
  }

  if (resolved === cwd || resolved.startsWith(`${cwd}${path.sep}`)) {
    return path.join(replayDir, path.relative(cwd, resolved));
  }

  return null;
}

function toRelativeAppPath(targetPath: string, replayDir: string): string {
  return path.relative(replayDir, targetPath).split(path.sep).join("/");
}

function isUsage(value: unknown): value is {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.input === "number" &&
    typeof value.output === "number" &&
    typeof value.cacheRead === "number" &&
    typeof value.cacheWrite === "number" &&
    typeof value.totalTokens === "number"
  );
}

function normalizeEditEntries(args: Record<string, unknown>): Array<{ oldText: string; newText: string }> {
  if (typeof args.oldText === "string" && typeof args.newText === "string") {
    return [{ oldText: args.oldText, newText: args.newText }];
  }

  const edits = args.edits;
  if (!Array.isArray(edits)) return [];

  const normalized: Array<{ oldText: string; newText: string }> = [];
  for (const entry of edits) {
    if (!isRecord(entry)) continue;
    if (typeof entry.oldText !== "string" || typeof entry.newText !== "string") continue;
    normalized.push({ oldText: entry.oldText, newText: entry.newText });
  }
  return normalized;
}

async function readEventsRows(eventsPath: string): Promise<unknown[]> {
  const raw = await readFile(eventsPath, "utf8");
  const rows: unknown[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Malformed lines are ignored — same tolerance as replay-run.
    }
  }
  return rows;
}

/**
 * Extract write/edit ops with ledger call indices (same assignment as normalize.ts).
 * Tools between message_end N and message_end N+1 belong to call index N.
 */
export function extractFsOpsWithCallIndex(rows: unknown[], replayDir: string, originalCwd: string): FsOpAtCall[] {
  const ops: FsOpAtCall[] = [];
  const openToolArgs = new Map<string, Record<string, unknown>>();
  const pending: Array<Omit<FsOpAtCall, "callIndex">> = [];
  let callIndex = 0;
  let toolIndex = 0;

  const flushPending = (): void => {
    if (callIndex === 0) {
      pending.length = 0;
      toolIndex = 0;
      return;
    }
    for (const op of pending) {
      ops.push({ ...op, callIndex });
    }
    pending.length = 0;
    toolIndex = 0;
  };

  for (const row of rows) {
    if (!isRecord(row)) continue;

    if (row.type === "tool_execution_start") {
      const toolCallId = typeof row.toolCallId === "string" ? row.toolCallId : "";
      const args = isRecord(row.args) ? row.args : {};
      if (toolCallId) openToolArgs.set(toolCallId, args);
      continue;
    }

    if (row.type === "tool_execution_end") {
      const toolCallId = typeof row.toolCallId === "string" ? row.toolCallId : "";
      const name = typeof row.toolName === "string" ? row.toolName : "unknown";
      const args = openToolArgs.get(toolCallId) ?? (isRecord(row.args) ? row.args : {});
      if (toolCallId) openToolArgs.delete(toolCallId);

      if (name !== "write" && name !== "edit") continue;

      const sourcePath = typeof args.path === "string" ? args.path : "";
      if (sourcePath.trim() === "") continue;

      const targetPath = remapPath(sourcePath, originalCwd, replayDir);
      if (!targetPath) continue;

      const relativePath = toRelativeAppPath(targetPath, replayDir);

      if (name === "write") {
        if (typeof args.content !== "string") continue;
        pending.push({
          toolIndex: toolIndex++,
          kind: "write",
          sourcePath,
          relativePath,
          content: args.content,
          edits: [],
        });
        continue;
      }

      pending.push({
        toolIndex: toolIndex++,
        kind: "edit",
        sourcePath,
        relativePath,
        edits: normalizeEditEntries(args),
      });
      continue;
    }

    if (row.type === "message_end") {
      const message = row.message;
      if (!isRecord(message) || !isUsage(message.usage)) continue;
      const role = message.role;
      if (role !== "assistant" && role !== "toolResult") continue;
      flushPending();
      callIndex += 1;
    }
  }

  flushPending();
  return ops;
}

export function selectFsOpsThroughVerifyAnchor(
  ops: FsOpAtCall[],
  anchorCallIndex: number,
): FsOpAtCall[] {
  // Write/edit tools only — verify/bash never appear here. Include the anchor call
  // in case Pi mutates then verifies in the same ledger call.
  return ops.filter((op) => op.callIndex <= anchorCallIndex);
}

async function applyWrite(op: FsOpAtCall, replayDir: string): Promise<void> {
  const targetPath = path.join(replayDir, op.relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, op.content ?? "", "utf8");
}

async function applyEdit(op: FsOpAtCall, replayDir: string): Promise<void> {
  const targetPath = path.join(replayDir, op.relativePath);
  const current = await readFile(targetPath, "utf8");
  await writeFile(targetPath, applyEditsToContent(current, op.edits), "utf8");
}

export interface ReconstructedAnchorMetrics {
  authored_test_count_at_anchor: number;
  test_loc_at_anchor: number;
  qualifying_test_files: string[];
  reconstruction_method: "events_replay_test_files_through_anchor_call";
  test_file_ops_replayed: number;
  test_file_edit_failures: number;
  anchor_call_index: number;
}

export interface ReconstructedAppSnapshot {
  appRoot: string;
  metrics: ReconstructedAnchorMetrics;
  cleanup: () => void;
}

/**
 * Replay qualifying test-file write/edit ops through `anchorCallIndex`, then compute
 * source-derived metrics with the Q2-D parser. Non-test product files are skipped —
 * Gate A only needs qualifying src test sources at the anchor.
 */
export async function reconstructAppAtVerifyAnchor(input: {
  runDirectory: string;
  anchorCallIndex: number;
}): Promise<ReconstructedAppSnapshot> {
  const runDirectory = path.resolve(input.runDirectory);
  const eventsPath = path.join(runDirectory, "events.jsonl");
  const rows = await readEventsRows(eventsPath);
  const originalCwd = extractCwd(rows);
  const replayDir = mkdtempSync(path.join(tmpdir(), "q2d-anchor-"));

  const allOps = extractFsOpsWithCallIndex(rows, replayDir, originalCwd);
  const ops = selectFsOpsThroughVerifyAnchor(allOps, input.anchorCallIndex).filter((op) =>
    isQualifyingTestFile(op.relativePath),
  );

  let editFailures = 0;
  for (const op of ops) {
    if (op.kind === "write") {
      await applyWrite(op, replayDir);
      continue;
    }
    if (op.edits.length === 0) continue;
    try {
      await applyEdit(op, replayDir);
    } catch {
      editFailures += 1;
    }
  }

  const metrics = countAuthoredTestsInApp(replayDir);
  const qualifyingFiles = listTestSourcesUnderSrc(replayDir).map((source) => source.relativePath);

  return {
    appRoot: replayDir,
    metrics: {
      authored_test_count_at_anchor: metrics.authored_test_count,
      test_loc_at_anchor: metrics.test_loc,
      qualifying_test_files: qualifyingFiles,
      reconstruction_method: "events_replay_test_files_through_anchor_call",
      test_file_ops_replayed: ops.length,
      test_file_edit_failures: editFailures,
      anchor_call_index: input.anchorCallIndex,
    },
    cleanup: () => {
      rm(replayDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
