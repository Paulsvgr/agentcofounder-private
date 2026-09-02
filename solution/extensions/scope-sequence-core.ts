/**
 * SS1 — Scope & sequence v1 — pure core (anchor detection, message, export).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCOPE_SEQUENCE_EXPORT_FILENAME = "scope-sequence.v1.json";

export const SS1_ANCHOR_ID = "first_app_tsx_mutation" as const;
export const SS1_ANCHOR_PATH = "src/App.tsx";

export const SS1_MESSAGE_FROZEN =
  "Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.";

export const SS1_MESSAGE_BYTES = 354;

export type ScopeSequenceAnchorKind = "write" | "edit";

export interface ScopeSequenceExport {
  schema: "agentcofounder.scope_sequence.v1";
  run_id: string;
  delivery: "appended_to_tool_result" | "none";
  anchor: typeof SS1_ANCHOR_ID;
  anchor_path: typeof SS1_ANCHOR_PATH;
  anchor_call_index: number | null;
  anchor_tool_index: number | null;
  anchor_kind: ScopeSequenceAnchorKind | null;
  message_text_frozen: string;
  message_bytes: number;
  delivered: boolean;
  trigger_consumed: boolean;
}

export interface ScopeSequenceSessionState {
  triggerConsumed: boolean;
  exportRecord: ScopeSequenceExport;
}

let sessionState: ScopeSequenceSessionState | null = null;

export function scopeSequenceV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_SCOPE_SEQUENCE_V1;
  return raw === "1" || raw === "true";
}

export function normalizeRelativePath(pathValue: string): string {
  return pathValue.split(/[/\\]/).join("/");
}

export function isAppTsxPath(relativePath: string): boolean {
  return normalizeRelativePath(relativePath) === SS1_ANCHOR_PATH;
}

export function isQualifyingAppTsxMutation(input: {
  toolName: string;
  path: string;
  isError: boolean;
  editDiff?: string | null;
}): boolean {
  if (input.isError) return false;
  if (!isAppTsxPath(input.path)) return false;
  if (input.toolName === "write") return true;
  if (input.toolName === "edit") {
    return typeof input.editDiff === "string" && input.editDiff.length > 0;
  }
  return false;
}

export function appendScopeSequenceMessageToToolContent(
  content: Array<{ type: string; text?: string }>,
): Array<{ type: "text"; text: string }> {
  const texts = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);
  const base = texts.join("\n");
  const appended = base.length > 0 ? `${base}\n\n${SS1_MESSAGE_FROZEN}` : SS1_MESSAGE_FROZEN;
  return [{ type: "text", text: appended }];
}

export function messagePresentInToolContent(content: Array<{ type: string; text?: string }>): boolean {
  const combined = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
  return combined.includes(SS1_MESSAGE_FROZEN);
}

export function createEmptyScopeSequenceExport(runId = ""): ScopeSequenceExport {
  return {
    schema: "agentcofounder.scope_sequence.v1",
    run_id: runId,
    delivery: "none",
    anchor: SS1_ANCHOR_ID,
    anchor_path: SS1_ANCHOR_PATH,
    anchor_call_index: null,
    anchor_tool_index: null,
    anchor_kind: null,
    message_text_frozen: SS1_MESSAGE_FROZEN,
    message_bytes: SS1_MESSAGE_BYTES,
    delivered: false,
    trigger_consumed: false,
  };
}

export function resetScopeSequenceSession(runId = ""): void {
  sessionState = {
    triggerConsumed: false,
    exportRecord: createEmptyScopeSequenceExport(runId),
  };
}

export function getScopeSequenceSessionState(): ScopeSequenceSessionState | null {
  return sessionState;
}

export function resolveScopeSequenceDelivery(input: {
  toolName: string;
  path: string;
  isError: boolean;
  editDiff?: string | null;
  toolResultIndex: number;
  content: Array<{ type: string; text?: string }>;
}): {
  delivery: ScopeSequenceExport["delivery"];
  modifiedContent: Array<{ type: "text"; text: string }> | null;
  exportPatch: Partial<ScopeSequenceExport>;
} {
  const state = getScopeSequenceSessionState();
  if (!state || state.triggerConsumed) {
    return { delivery: "none", modifiedContent: null, exportPatch: {} };
  }

  if (
    !isQualifyingAppTsxMutation({
      toolName: input.toolName,
      path: input.path,
      isError: input.isError,
      ...(input.editDiff !== undefined ? { editDiff: input.editDiff } : {}),
    })
  ) {
    return { delivery: "none", modifiedContent: null, exportPatch: {} };
  }

  state.triggerConsumed = true;
  const exportPatch: Partial<ScopeSequenceExport> = {
    delivery: "appended_to_tool_result",
    anchor_tool_index: input.toolResultIndex,
    anchor_kind: input.toolName as ScopeSequenceAnchorKind,
    delivered: true,
    trigger_consumed: true,
  };
  Object.assign(state.exportRecord, exportPatch);

  return {
    delivery: "appended_to_tool_result",
    modifiedContent: appendScopeSequenceMessageToToolContent(input.content),
    exportPatch,
  };
}

export function resolveScopeSequenceExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, SCOPE_SEQUENCE_EXPORT_FILENAME);
}

export function writeScopeSequenceExport(exportPath: string, payload: ScopeSequenceExport): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readScopeSequenceExportFromRun(runDirectory: string): ScopeSequenceExport | null {
  const exportPath = path.join(runDirectory, SCOPE_SEQUENCE_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as ScopeSequenceExport;
  } catch {
    return null;
  }
}
