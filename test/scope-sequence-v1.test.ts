import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SS1_ANCHOR_ID,
  SS1_ANCHOR_PATH,
  SS1_MESSAGE_BYTES,
  SS1_MESSAGE_FROZEN,
  SCOPE_SEQUENCE_EXPORT_FILENAME,
  appendScopeSequenceMessageToToolContent,
  createEmptyScopeSequenceExport,
  getScopeSequenceSessionState,
  isAppTsxPath,
  isQualifyingAppTsxMutation,
  messagePresentInToolContent,
  resetScopeSequenceSession,
  resolveScopeSequenceDelivery,
  scopeSequenceV1EnabledFromEnvironment,
  writeScopeSequenceExport,
} from "../solution/extensions/scope-sequence-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("scope-sequence-core", () => {
  afterEach(() => {
    resetScopeSequenceSession();
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
  });

  it("freezes message at exactly 354 UTF-8 bytes", () => {
    expect(Buffer.byteLength(SS1_MESSAGE_FROZEN, "utf8")).toBe(SS1_MESSAGE_BYTES);
  });

  it("matches src/App.tsx only (normalized slashes)", () => {
    expect(isAppTsxPath("src/App.tsx")).toBe(true);
    expect(isAppTsxPath("src\\App.tsx")).toBe(true);
    expect(isAppTsxPath("src/components/App.tsx")).toBe(false);
    expect(isAppTsxPath("src/App.test.tsx")).toBe(false);
    expect(isAppTsxPath("src/main.tsx")).toBe(false);
  });

  it("qualifies successful write and content-changing edit to App.tsx", () => {
    expect(
      isQualifyingAppTsxMutation({
        toolName: "write",
        path: SS1_ANCHOR_PATH,
        isError: false,
      }),
    ).toBe(true);
    expect(
      isQualifyingAppTsxMutation({
        toolName: "edit",
        path: SS1_ANCHOR_PATH,
        isError: false,
        editDiff: "+export function App() {}",
      }),
    ).toBe(true);
  });

  it("does not qualify failed or no-op App.tsx mutations", () => {
    expect(
      isQualifyingAppTsxMutation({
        toolName: "write",
        path: SS1_ANCHOR_PATH,
        isError: true,
      }),
    ).toBe(false);
    expect(
      isQualifyingAppTsxMutation({
        toolName: "edit",
        path: SS1_ANCHOR_PATH,
        isError: true,
        editDiff: "",
      }),
    ).toBe(false);
    expect(
      isQualifyingAppTsxMutation({
        toolName: "edit",
        path: SS1_ANCHOR_PATH,
        isError: false,
        editDiff: "",
      }),
    ).toBe(false);
  });

  it("does not qualify writes to non-App.tsx paths", () => {
    expect(
      isQualifyingAppTsxMutation({
        toolName: "write",
        path: "src/App.test.tsx",
        isError: false,
      }),
    ).toBe(false);
  });

  it("appends verbatim frozen message to tool result text", () => {
    const modified = appendScopeSequenceMessageToToolContent([
      { type: "text", text: "Wrote 120 lines to src/App.tsx" },
    ]);
    expect(messagePresentInToolContent(modified)).toBe(true);
    expect(modified[0]?.text.endsWith(SS1_MESSAGE_FROZEN)).toBe(true);
    expect(modified[0]?.text).toContain("Wrote 120 lines to src/App.tsx");
  });
});

describe("scope-sequence delivery latch (Gate D mechanism)", () => {
  afterEach(() => {
    resetScopeSequenceSession();
  });

  function baseContent(): Array<{ type: string; text: string }> {
    return [{ type: "text", text: "tool ok" }];
  }

  it("delivers exactly once on first qualifying App.tsx mutation", () => {
    resetScopeSequenceSession("run-ss1-test");

    const first = resolveScopeSequenceDelivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      isError: false,
      toolResultIndex: 1,
      content: baseContent(),
    });
    expect(first.delivery).toBe("appended_to_tool_result");
    expect(first.modifiedContent).not.toBeNull();
    expect(messagePresentInToolContent(first.modifiedContent ?? [])).toBe(true);

    const second = resolveScopeSequenceDelivery({
      toolName: "edit",
      path: SS1_ANCHOR_PATH,
      isError: false,
      editDiff: "+more",
      toolResultIndex: 2,
      content: baseContent(),
    });
    expect(second.delivery).toBe("none");
    expect(second.modifiedContent).toBeNull();
  });

  it("failed first edit does not consume trigger; later success delivers", () => {
    resetScopeSequenceSession("run-ss1-test");

    const failed = resolveScopeSequenceDelivery({
      toolName: "edit",
      path: SS1_ANCHOR_PATH,
      isError: true,
      editDiff: "",
      toolResultIndex: 1,
      content: baseContent(),
    });
    expect(failed.delivery).toBe("none");

    const success = resolveScopeSequenceDelivery({
      toolName: "edit",
      path: SS1_ANCHOR_PATH,
      isError: false,
      editDiff: "+export {}",
      toolResultIndex: 2,
      content: baseContent(),
    });
    expect(success.delivery).toBe("appended_to_tool_result");
    expect(success.exportPatch.anchor_tool_index).toBe(2);
    expect(success.exportPatch.anchor_kind).toBe("edit");
  });

  it("writes scope-sequence.v1.json export with frozen anchor id", () => {
    resetScopeSequenceSession("run-ss1-export");
    const artifactDir = mkdtempSync(path.join(tmpdir(), "ss1-export-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = artifactDir;

    resolveScopeSequenceDelivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      isError: false,
      toolResultIndex: 3,
      content: baseContent(),
    });

    const exportPath = path.join(artifactDir, SCOPE_SEQUENCE_EXPORT_FILENAME);
    const exportRecord = getScopeSequenceSessionState()?.exportRecord;
    expect(exportRecord).toBeDefined();
    writeScopeSequenceExport(exportPath, exportRecord!);

    const parsed = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(parsed.schema).toBe("agentcofounder.scope_sequence.v1");
    expect(parsed.anchor).toBe(SS1_ANCHOR_ID);
    expect(parsed.anchor_path).toBe(SS1_ANCHOR_PATH);
    expect(parsed.message_text_frozen).toBe(SS1_MESSAGE_FROZEN);
    expect(parsed.message_bytes).toBe(SS1_MESSAGE_BYTES);
    expect(parsed.delivered).toBe(true);
    expect(parsed.trigger_consumed).toBe(true);
    expect(parsed.delivery).toBe("appended_to_tool_result");
    expect(parsed.anchor_tool_index).toBe(3);
    expect(parsed.anchor_kind).toBe("write");

    rmSync(artifactDir, { recursive: true, force: true });
    delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  });
});

describe("scope-sequence OFF/ON parity", () => {
  const previous = process.env.HARNESS_SCOPE_SEQUENCE_V1;
  const previousS1 = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previous === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    else process.env.HARNESS_SCOPE_SEQUENCE_V1 = previous;
    if (previousS1 === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previousS1;
  });

  it("OFF: does not load scope-sequence extension (v2.2 parity)", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("convergence-intervention-v1.ts"))).toBe(false);
  });

  it("ON: loads scope-sequence extension and runtime env when flag set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V1 = "1";
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(true);
    expect(extensions.some((entry) => entry.endsWith("convergence-intervention-v1.ts"))).toBe(false);
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V1).toBe("1");
    expect(runtimeEnv.HARNESS_CONVERGENCE_INTERVENTION_V1).toBeUndefined();
  });

  it("reads HARNESS_SCOPE_SEQUENCE_V1 from environment", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    expect(scopeSequenceV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_SCOPE_SEQUENCE_V1 = "1";
    expect(scopeSequenceV1EnabledFromEnvironment()).toBe(true);
  });
});
