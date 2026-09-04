/**
 * SS1 — Scope & sequence v1 — pure core (anchor detection, message, export).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCOPE_SEQUENCE_V1_EXPORT_FILENAME = "scope-sequence.v1.json";
export const SCOPE_SEQUENCE_V2_EXPORT_FILENAME = "scope-sequence.v2.json";
export const SCOPE_SEQUENCE_V2B_EXPORT_FILENAME = "scope-sequence.v2b.json";

/** @deprecated Use SCOPE_SEQUENCE_V1_EXPORT_FILENAME */
export const SCOPE_SEQUENCE_EXPORT_FILENAME = SCOPE_SEQUENCE_V1_EXPORT_FILENAME;

export const SS1_ANCHOR_ID = "first_app_tsx_mutation" as const;
export const SS2_ANCHOR_ID = "before_first_app_tsx_mutation" as const;
export const SS2B_ANCHOR_ID = "before_first_src_product_code_mutation" as const;
export const SS1_ANCHOR_PATH = "src/App.tsx";

export const SS1_MESSAGE_FROZEN =
  "Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.";

export const SS1_MESSAGE_BYTES = 354;

export type ScopeSequenceAnchorKind = "write" | "edit";

export interface ScopeSequenceV1Export {
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

/** @deprecated Use ScopeSequenceV1Export */
export type ScopeSequenceExport = ScopeSequenceV1Export;

export interface ScopeSequenceV2Export {
  schema: "agentcofounder.scope_sequence.v2";
  run_id: string;
  delivery: "steer_before_tool_call" | "none";
  anchor: typeof SS2_ANCHOR_ID;
  anchor_path: typeof SS1_ANCHOR_PATH;
  anchor_tool_call_index: number | null;
  anchor_kind: ScopeSequenceAnchorKind | null;
  message_text_frozen: string;
  message_bytes: number;
  delivered: boolean;
  trigger_consumed: boolean;
}

export interface ScopeSequenceV2bExport {
  schema: "agentcofounder.scope_sequence.v2b";
  run_id: string;
  delivery: "steer_before_tool_call" | "none";
  anchor: typeof SS2B_ANCHOR_ID;
  anchor_path: string | null;
  anchor_tool_call_index: number | null;
  anchor_kind: ScopeSequenceAnchorKind | null;
  message_text_frozen: string;
  message_bytes: number;
  delivered: boolean;
  trigger_consumed: boolean;
}

export interface ScopeSequenceV1SessionState {
  triggerConsumed: boolean;
  exportRecord: ScopeSequenceV1Export;
}

export interface ScopeSequenceV2SessionState {
  triggerConsumed: boolean;
  exportRecord: ScopeSequenceV2Export;
}

export interface ScopeSequenceV2bSessionState {
  triggerConsumed: boolean;
  exportRecord: ScopeSequenceV2bExport;
}

/** @deprecated Use ScopeSequenceV1SessionState */
export type ScopeSequenceSessionState = ScopeSequenceV1SessionState;

let sessionStateV1: ScopeSequenceV1SessionState | null = null;
let sessionStateV2: ScopeSequenceV2SessionState | null = null;
let sessionStateV2b: ScopeSequenceV2bSessionState | null = null;

export function scopeSequenceV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_SCOPE_SEQUENCE_V1;
  return raw === "1" || raw === "true";
}

export function scopeSequenceV2EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_SCOPE_SEQUENCE_V2;
  return raw === "1" || raw === "true";
}

export function scopeSequenceV2bEnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_SCOPE_SEQUENCE_V2B;
  return raw === "1" || raw === "true";
}

export function assertMutuallyExclusiveScopeSequenceExperimentFlags(): void {
  const enabledFlags = [
    scopeSequenceV1EnabledFromEnvironment() ? "HARNESS_SCOPE_SEQUENCE_V1" : null,
    scopeSequenceV2EnabledFromEnvironment() ? "HARNESS_SCOPE_SEQUENCE_V2" : null,
    scopeSequenceV2bEnabledFromEnvironment() ? "HARNESS_SCOPE_SEQUENCE_V2B" : null,
  ].filter((flag): flag is string => flag !== null);

  if (enabledFlags.length > 1) {
    throw new Error(
      `${enabledFlags.join(", ")} are mutually exclusive experiment flags; enable at most one.`,
    );
  }
}

function normalizeRelativePathStatic(pathValue: string): string {
  return pathValue.split(/[/\\]/).join("/");
}

const SS2B_EXCLUDED_EXACT_PATHS = new Set([normalizeRelativePathStatic("src/main.tsx")]);
const SS2B_EXCLUDED_PATH_PREFIXES = ["src/test/"] as const;

export function normalizeRelativePath(pathValue: string): string {
  return normalizeRelativePathStatic(pathValue);
}

export function resolveScopeSequenceRunIdFromEnvironment(): string {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return "";
  return path.basename(artifactDir);
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

export function isQualifyingAppTsxToolCall(input: {
  toolName: string;
  path: string;
}): boolean {
  if (!isAppTsxPath(input.path)) return false;
  return input.toolName === "write" || input.toolName === "edit";
}

function isTestOrSpecSrcPath(normalizedPath: string): boolean {
  return (
    normalizedPath.endsWith(".test.ts") ||
    normalizedPath.endsWith(".test.tsx") ||
    normalizedPath.endsWith(".spec.ts") ||
    normalizedPath.endsWith(".spec.tsx")
  );
}

function isAmbientDeclarationSrcPath(normalizedPath: string): boolean {
  return normalizedPath.endsWith(".d.ts");
}

export function isUnderSrcTypeScriptPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized.startsWith("src/")) return false;
  return normalized.endsWith(".ts") || normalized.endsWith(".tsx");
}

export function isExcludedScaffoldOrTestSrcPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (SS2B_EXCLUDED_EXACT_PATHS.has(normalized)) return true;
  if (SS2B_EXCLUDED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  if (isTestOrSpecSrcPath(normalized)) return true;
  if (isAmbientDeclarationSrcPath(normalized)) return true;
  return false;
}

export function isQualifyingSrcProductCodePath(relativePath: string): boolean {
  if (!isUnderSrcTypeScriptPath(relativePath)) return false;
  return !isExcludedScaffoldOrTestSrcPath(relativePath);
}

export function isQualifyingSrcProductCodeToolCall(input: {
  toolName: string;
  path: string;
}): boolean {
  if (input.toolName !== "write" && input.toolName !== "edit") return false;
  return isQualifyingSrcProductCodePath(input.path);
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

export function createEmptyScopeSequenceV1Export(runId = ""): ScopeSequenceV1Export {
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

/** @deprecated Use createEmptyScopeSequenceV1Export */
export function createEmptyScopeSequenceExport(runId = ""): ScopeSequenceV1Export {
  return createEmptyScopeSequenceV1Export(runId);
}

export function createEmptyScopeSequenceV2Export(runId = ""): ScopeSequenceV2Export {
  return {
    schema: "agentcofounder.scope_sequence.v2",
    run_id: runId,
    delivery: "none",
    anchor: SS2_ANCHOR_ID,
    anchor_path: SS1_ANCHOR_PATH,
    anchor_tool_call_index: null,
    anchor_kind: null,
    message_text_frozen: SS1_MESSAGE_FROZEN,
    message_bytes: SS1_MESSAGE_BYTES,
    delivered: false,
    trigger_consumed: false,
  };
}

export function createEmptyScopeSequenceV2bExport(runId = ""): ScopeSequenceV2bExport {
  return {
    schema: "agentcofounder.scope_sequence.v2b",
    run_id: runId,
    delivery: "none",
    anchor: SS2B_ANCHOR_ID,
    anchor_path: null,
    anchor_tool_call_index: null,
    anchor_kind: null,
    message_text_frozen: SS1_MESSAGE_FROZEN,
    message_bytes: SS1_MESSAGE_BYTES,
    delivered: false,
    trigger_consumed: false,
  };
}

export function resetScopeSequenceV1Session(runId = ""): void {
  sessionStateV1 = {
    triggerConsumed: false,
    exportRecord: createEmptyScopeSequenceV1Export(runId),
  };
}

/** @deprecated Use resetScopeSequenceV1Session */
export function resetScopeSequenceSession(runId = ""): void {
  resetScopeSequenceV1Session(runId);
}

export function resetScopeSequenceV2Session(runId = ""): void {
  sessionStateV2 = {
    triggerConsumed: false,
    exportRecord: createEmptyScopeSequenceV2Export(runId),
  };
}

export function resetScopeSequenceV2bSession(runId = ""): void {
  sessionStateV2b = {
    triggerConsumed: false,
    exportRecord: createEmptyScopeSequenceV2bExport(runId),
  };
}

export function getScopeSequenceV1SessionState(): ScopeSequenceV1SessionState | null {
  return sessionStateV1;
}

/** @deprecated Use getScopeSequenceV1SessionState */
export function getScopeSequenceSessionState(): ScopeSequenceV1SessionState | null {
  return sessionStateV1;
}

export function getScopeSequenceV2SessionState(): ScopeSequenceV2SessionState | null {
  return sessionStateV2;
}

export function getScopeSequenceV2bSessionState(): ScopeSequenceV2bSessionState | null {
  return sessionStateV2b;
}

export function resolveScopeSequenceDelivery(input: {
  toolName: string;
  path: string;
  isError: boolean;
  editDiff?: string | null;
  toolResultIndex: number;
  content: Array<{ type: string; text?: string }>;
}): {
  delivery: ScopeSequenceV1Export["delivery"];
  modifiedContent: Array<{ type: "text"; text: string }> | null;
  exportPatch: Partial<ScopeSequenceV1Export>;
} {
  const state = getScopeSequenceV1SessionState();
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
  const exportPatch: Partial<ScopeSequenceV1Export> = {
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

export function resolveScopeSequenceV2Delivery(input: {
  toolName: string;
  path: string;
  toolCallIndex: number;
}): {
  delivery: ScopeSequenceV2Export["delivery"];
  shouldDeliverSteer: boolean;
  exportPatch: Partial<ScopeSequenceV2Export>;
} {
  const state = getScopeSequenceV2SessionState();
  if (!state || state.triggerConsumed) {
    return { delivery: "none", shouldDeliverSteer: false, exportPatch: {} };
  }

  if (
    !isQualifyingAppTsxToolCall({
      toolName: input.toolName,
      path: input.path,
    })
  ) {
    return { delivery: "none", shouldDeliverSteer: false, exportPatch: {} };
  }

  state.triggerConsumed = true;
  const exportPatch: Partial<ScopeSequenceV2Export> = {
    delivery: "steer_before_tool_call",
    anchor_tool_call_index: input.toolCallIndex,
    anchor_kind: input.toolName as ScopeSequenceAnchorKind,
    delivered: true,
    trigger_consumed: true,
  };
  Object.assign(state.exportRecord, exportPatch);

  return {
    delivery: "steer_before_tool_call",
    shouldDeliverSteer: true,
    exportPatch,
  };
}

export function resolveScopeSequenceV2bDelivery(input: {
  toolName: string;
  path: string;
  toolCallIndex: number;
}): {
  delivery: ScopeSequenceV2bExport["delivery"];
  shouldDeliverSteer: boolean;
  exportPatch: Partial<ScopeSequenceV2bExport>;
} {
  const state = getScopeSequenceV2bSessionState();
  if (!state || state.triggerConsumed) {
    return { delivery: "none", shouldDeliverSteer: false, exportPatch: {} };
  }

  const normalizedPath = normalizeRelativePath(input.path);
  if (
    !isQualifyingSrcProductCodeToolCall({
      toolName: input.toolName,
      path: input.path,
    })
  ) {
    return { delivery: "none", shouldDeliverSteer: false, exportPatch: {} };
  }

  state.triggerConsumed = true;
  const exportPatch: Partial<ScopeSequenceV2bExport> = {
    delivery: "steer_before_tool_call",
    anchor_path: normalizedPath,
    anchor_tool_call_index: input.toolCallIndex,
    anchor_kind: input.toolName as ScopeSequenceAnchorKind,
    delivered: true,
    trigger_consumed: true,
  };
  Object.assign(state.exportRecord, exportPatch);

  return {
    delivery: "steer_before_tool_call",
    shouldDeliverSteer: true,
    exportPatch,
  };
}

export function resolveScopeSequenceV1ExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, SCOPE_SEQUENCE_V1_EXPORT_FILENAME);
}

/** @deprecated Use resolveScopeSequenceV1ExportPath */
export function resolveScopeSequenceExportPath(): string | null {
  return resolveScopeSequenceV1ExportPath();
}

export function resolveScopeSequenceV2ExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, SCOPE_SEQUENCE_V2_EXPORT_FILENAME);
}

export function resolveScopeSequenceV2bExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, SCOPE_SEQUENCE_V2B_EXPORT_FILENAME);
}

export function writeScopeSequenceV1Export(exportPath: string, payload: ScopeSequenceV1Export): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** @deprecated Use writeScopeSequenceV1Export */
export function writeScopeSequenceExport(exportPath: string, payload: ScopeSequenceV1Export): void {
  writeScopeSequenceV1Export(exportPath, payload);
}

export function writeScopeSequenceV2Export(exportPath: string, payload: ScopeSequenceV2Export): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function writeScopeSequenceV2bExport(exportPath: string, payload: ScopeSequenceV2bExport): void {
  mkdirSync(path.dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readScopeSequenceV1ExportFromRun(runDirectory: string): ScopeSequenceV1Export | null {
  const exportPath = path.join(runDirectory, SCOPE_SEQUENCE_V1_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as ScopeSequenceV1Export;
  } catch {
    return null;
  }
}

/** @deprecated Use readScopeSequenceV1ExportFromRun */
export function readScopeSequenceExportFromRun(runDirectory: string): ScopeSequenceV1Export | null {
  return readScopeSequenceV1ExportFromRun(runDirectory);
}

export function readScopeSequenceV2ExportFromRun(runDirectory: string): ScopeSequenceV2Export | null {
  const exportPath = path.join(runDirectory, SCOPE_SEQUENCE_V2_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as ScopeSequenceV2Export;
  } catch {
    return null;
  }
}

export function readScopeSequenceV2bExportFromRun(runDirectory: string): ScopeSequenceV2bExport | null {
  const exportPath = path.join(runDirectory, SCOPE_SEQUENCE_V2B_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as ScopeSequenceV2bExport;
  } catch {
    return null;
  }
}
