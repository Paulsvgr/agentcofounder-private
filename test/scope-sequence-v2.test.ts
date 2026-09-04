import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SS1_MESSAGE_BYTES,
  SS1_MESSAGE_FROZEN,
  SS1_ANCHOR_PATH,
  SS2_ANCHOR_ID,
  SCOPE_SEQUENCE_V2_EXPORT_FILENAME,
  createEmptyScopeSequenceV2Export,
  getScopeSequenceV2SessionState,
  isQualifyingAppTsxToolCall,
  resetScopeSequenceV2Session,
  resolveScopeSequenceV2Delivery,
  assertMutuallyExclusiveScopeSequenceExperimentFlags,
  scopeSequenceV2EnabledFromEnvironment,
  writeScopeSequenceV2Export,
} from "../solution/extensions/scope-sequence-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("scope-sequence-v2 core", () => {
  afterEach(() => {
    resetScopeSequenceV2Session();
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
  });

  it("qualifies write and edit tool_calls to App.tsx", () => {
    expect(
      isQualifyingAppTsxToolCall({
        toolName: "write",
        path: SS1_ANCHOR_PATH,
      }),
    ).toBe(true);
    expect(
      isQualifyingAppTsxToolCall({
        toolName: "edit",
        path: SS1_ANCHOR_PATH,
      }),
    ).toBe(true);
    expect(
      isQualifyingAppTsxToolCall({
        toolName: "write",
        path: "src/App.test.tsx",
      }),
    ).toBe(false);
    expect(
      isQualifyingAppTsxToolCall({
        toolName: "read",
        path: SS1_ANCHOR_PATH,
      }),
    ).toBe(false);
  });

  it("reuses the same frozen 354-byte message as SS1", () => {
    const exportRecord = createEmptyScopeSequenceV2Export();
    expect(exportRecord.message_text_frozen).toBe(SS1_MESSAGE_FROZEN);
    expect(exportRecord.message_bytes).toBe(SS1_MESSAGE_BYTES);
    expect(Buffer.byteLength(SS1_MESSAGE_FROZEN, "utf8")).toBe(SS1_MESSAGE_BYTES);
  });
});

describe("scope-sequence-v2 delivery latch (Gate D mechanism)", () => {
  afterEach(() => {
    resetScopeSequenceV2Session();
  });

  it("delivers steer exactly once on first qualifying App.tsx tool_call", () => {
    resetScopeSequenceV2Session("run-ss2-test");

    const first = resolveScopeSequenceV2Delivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 4,
    });
    expect(first.delivery).toBe("steer_before_tool_call");
    expect(first.shouldDeliverSteer).toBe(true);
    expect(first.exportPatch.anchor_tool_call_index).toBe(4);
    expect(first.exportPatch.anchor_kind).toBe("write");

    const second = resolveScopeSequenceV2Delivery({
      toolName: "edit",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 5,
    });
    expect(second.delivery).toBe("none");
    expect(second.shouldDeliverSteer).toBe(false);
  });

  it("does not deliver on non-App.tsx tool_calls before latch", () => {
    resetScopeSequenceV2Session("run-ss2-test");

    const skipped = resolveScopeSequenceV2Delivery({
      toolName: "write",
      path: "src/App.test.tsx",
      toolCallIndex: 2,
    });
    expect(skipped.delivery).toBe("none");
    expect(skipped.shouldDeliverSteer).toBe(false);

    const app = resolveScopeSequenceV2Delivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 3,
    });
    expect(app.shouldDeliverSteer).toBe(true);
  });

  it("writes scope-sequence.v2.json export with frozen early anchor id", () => {
    resetScopeSequenceV2Session("run-ss2-export");
    const artifactDir = mkdtempSync(path.join(tmpdir(), "ss2-export-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = artifactDir;

    resolveScopeSequenceV2Delivery({
      toolName: "edit",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 6,
    });

    const exportPath = path.join(artifactDir, SCOPE_SEQUENCE_V2_EXPORT_FILENAME);
    const exportRecord = getScopeSequenceV2SessionState()?.exportRecord;
    expect(exportRecord).toBeDefined();
    writeScopeSequenceV2Export(exportPath, exportRecord!);

    const parsed = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(parsed.schema).toBe("agentcofounder.scope_sequence.v2");
    expect(parsed.anchor).toBe(SS2_ANCHOR_ID);
    expect(parsed.anchor_path).toBe(SS1_ANCHOR_PATH);
    expect(parsed.message_text_frozen).toBe(SS1_MESSAGE_FROZEN);
    expect(parsed.message_bytes).toBe(SS1_MESSAGE_BYTES);
    expect(parsed.delivered).toBe(true);
    expect(parsed.trigger_consumed).toBe(true);
    expect(parsed.delivery).toBe("steer_before_tool_call");
    expect(parsed.anchor_tool_call_index).toBe(6);
    expect(parsed.anchor_kind).toBe("edit");

    rmSync(artifactDir, { recursive: true, force: true });
    delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  });
});

describe("scope-sequence-v2 OFF/ON parity", () => {
  const previousV2 = process.env.HARNESS_SCOPE_SEQUENCE_V2;
  const previousV2b = process.env.HARNESS_SCOPE_SEQUENCE_V2B;
  const previousV1 = process.env.HARNESS_SCOPE_SEQUENCE_V1;
  const previousS1 = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previousV2 === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    else process.env.HARNESS_SCOPE_SEQUENCE_V2 = previousV2;
    if (previousV2b === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    else process.env.HARNESS_SCOPE_SEQUENCE_V2B = previousV2b;
    if (previousV1 === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    else process.env.HARNESS_SCOPE_SEQUENCE_V1 = previousV1;
    if (previousS1 === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previousS1;
  });

  it("OFF: does not load scope-sequence-v2 extension (v2.2 parity)", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(false);
  });

  it("ON: loads scope-sequence-v2 extension and runtime env when flag set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V2 = "1";
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2.ts"))).toBe(true);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(false);
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V2).toBe("1");
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V1).toBeUndefined();
  });

  it("hard error when both SS1 and SS2 flags are set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V1 = "1";
    process.env.HARNESS_SCOPE_SEQUENCE_V2 = "1";
    expect(() => resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG)).toThrow(
      /mutually exclusive experiment flags/i,
    );
  });

  it("reads HARNESS_SCOPE_SEQUENCE_V2 from environment", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    expect(scopeSequenceV2EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_SCOPE_SEQUENCE_V2 = "1";
    expect(scopeSequenceV2EnabledFromEnvironment()).toBe(true);
  });
});
