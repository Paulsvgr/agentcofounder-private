import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SS1_MESSAGE_BYTES,
  SS1_MESSAGE_FROZEN,
  SS1_ANCHOR_PATH,
  SS2B_ANCHOR_ID,
  SCOPE_SEQUENCE_V2B_EXPORT_FILENAME,
  assertMutuallyExclusiveScopeSequenceExperimentFlags,
  createEmptyScopeSequenceV2bExport,
  getScopeSequenceV2bSessionState,
  isExcludedScaffoldOrTestSrcPath,
  isQualifyingSrcProductCodePath,
  isQualifyingSrcProductCodeToolCall,
  isUnderSrcTypeScriptPath,
  resetScopeSequenceV2bSession,
  resolveScopeSequenceV2bDelivery,
  scopeSequenceV2bEnabledFromEnvironment,
  writeScopeSequenceV2bExport,
} from "../solution/extensions/scope-sequence-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("scope-sequence-v2b core", () => {
  afterEach(() => {
    resetScopeSequenceV2bSession();
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
  });

  it("identifies qualifying src product-code paths", () => {
    expect(isQualifyingSrcProductCodePath("src/App.tsx")).toBe(true);
    expect(isQualifyingSrcProductCodePath("src/useLibrary.ts")).toBe(true);
    expect(isQualifyingSrcProductCodePath("src/components/BookList.tsx")).toBe(true);
    expect(isQualifyingSrcProductCodePath("src/hooks/useBooks.ts")).toBe(true);
  });

  it("excludes scaffold, test, and ambient declaration paths", () => {
    expect(isExcludedScaffoldOrTestSrcPath("src/main.tsx")).toBe(true);
    expect(isExcludedScaffoldOrTestSrcPath("src/test/setup.ts")).toBe(true);
    expect(isExcludedScaffoldOrTestSrcPath("src/App.test.tsx")).toBe(true);
    expect(isExcludedScaffoldOrTestSrcPath("src/App.spec.tsx")).toBe(true);
    expect(isExcludedScaffoldOrTestSrcPath("src/vite-env.d.ts")).toBe(true);
    expect(isQualifyingSrcProductCodePath("src/main.tsx")).toBe(false);
    expect(isQualifyingSrcProductCodePath("src/test/setup.ts")).toBe(false);
    expect(isQualifyingSrcProductCodePath("src/App.test.tsx")).toBe(false);
    expect(isQualifyingSrcProductCodePath("src/vite-env.d.ts")).toBe(false);
  });

  it("requires src/**/*.ts(x) and write/edit tool_calls", () => {
    expect(isUnderSrcTypeScriptPath("src/styles.css")).toBe(false);
    expect(isUnderSrcTypeScriptPath("styles.css")).toBe(false);
    expect(
      isQualifyingSrcProductCodeToolCall({
        toolName: "write",
        path: "src/useLibrary.ts",
      }),
    ).toBe(true);
    expect(
      isQualifyingSrcProductCodeToolCall({
        toolName: "edit",
        path: SS1_ANCHOR_PATH,
      }),
    ).toBe(true);
    expect(
      isQualifyingSrcProductCodeToolCall({
        toolName: "read",
        path: "src/useLibrary.ts",
      }),
    ).toBe(false);
    expect(
      isQualifyingSrcProductCodeToolCall({
        toolName: "write",
        path: "src/App.test.tsx",
      }),
    ).toBe(false);
  });

  it("reuses the same frozen 354-byte message as SS1/SS2", () => {
    const exportRecord = createEmptyScopeSequenceV2bExport();
    expect(exportRecord.message_text_frozen).toBe(SS1_MESSAGE_FROZEN);
    expect(exportRecord.message_bytes).toBe(SS1_MESSAGE_BYTES);
    expect(Buffer.byteLength(SS1_MESSAGE_FROZEN, "utf8")).toBe(SS1_MESSAGE_BYTES);
  });
});

describe("scope-sequence-v2b delivery latch (Gate D mechanism)", () => {
  afterEach(() => {
    resetScopeSequenceV2bSession();
  });

  it("delivers steer exactly once on first qualifying product-code tool_call", () => {
    resetScopeSequenceV2bSession("run-ss2b-test");

    const first = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: "src/useLibrary.ts",
      toolCallIndex: 3,
    });
    expect(first.delivery).toBe("steer_before_tool_call");
    expect(first.shouldDeliverSteer).toBe(true);
    expect(first.exportPatch.anchor_path).toBe("src/useLibrary.ts");
    expect(first.exportPatch.anchor_tool_call_index).toBe(3);
    expect(first.exportPatch.anchor_kind).toBe("write");

    const second = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 4,
    });
    expect(second.delivery).toBe("none");
    expect(second.shouldDeliverSteer).toBe(false);
  });

  it("fires on hook file before App.tsx (SS2 miss case)", () => {
    resetScopeSequenceV2bSession("run-ss2b-test");

    const hook = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: "src/useLibrary.ts",
      toolCallIndex: 2,
    });
    expect(hook.shouldDeliverSteer).toBe(true);

    const app = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: SS1_ANCHOR_PATH,
      toolCallIndex: 3,
    });
    expect(app.shouldDeliverSteer).toBe(false);
  });

  it("does not deliver on excluded paths before latch", () => {
    resetScopeSequenceV2bSession("run-ss2b-test");

    const skipped = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: "src/App.test.tsx",
      toolCallIndex: 2,
    });
    expect(skipped.delivery).toBe("none");
    expect(skipped.shouldDeliverSteer).toBe(false);

    const product = resolveScopeSequenceV2bDelivery({
      toolName: "write",
      path: "src/types.ts",
      toolCallIndex: 3,
    });
    expect(product.shouldDeliverSteer).toBe(true);
  });

  it("writes scope-sequence.v2b.json export with frozen broad anchor id", () => {
    resetScopeSequenceV2bSession("run-ss2b-export");
    const artifactDir = mkdtempSync(path.join(tmpdir(), "ss2b-export-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = artifactDir;

    resolveScopeSequenceV2bDelivery({
      toolName: "edit",
      path: "src/hooks/useBooks.ts",
      toolCallIndex: 6,
    });

    const exportPath = path.join(artifactDir, SCOPE_SEQUENCE_V2B_EXPORT_FILENAME);
    const exportRecord = getScopeSequenceV2bSessionState()?.exportRecord;
    expect(exportRecord).toBeDefined();
    writeScopeSequenceV2bExport(exportPath, exportRecord!);

    const parsed = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(parsed.schema).toBe("agentcofounder.scope_sequence.v2b");
    expect(parsed.anchor).toBe(SS2B_ANCHOR_ID);
    expect(parsed.anchor_path).toBe("src/hooks/useBooks.ts");
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

describe("scope-sequence-v2b OFF/ON parity", () => {
  const previousV2b = process.env.HARNESS_SCOPE_SEQUENCE_V2B;
  const previousV2 = process.env.HARNESS_SCOPE_SEQUENCE_V2;
  const previousV1 = process.env.HARNESS_SCOPE_SEQUENCE_V1;
  const previousS1 = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previousV2b === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    else process.env.HARNESS_SCOPE_SEQUENCE_V2B = previousV2b;
    if (previousV2 === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    else process.env.HARNESS_SCOPE_SEQUENCE_V2 = previousV2;
    if (previousV1 === undefined) delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    else process.env.HARNESS_SCOPE_SEQUENCE_V1 = previousV1;
    if (previousS1 === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previousS1;
  });

  it("OFF: does not load scope-sequence-v2b extension (v2.2 parity)", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2b.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(false);
  });

  it("ON: loads scope-sequence-v2b extension and runtime env when flag set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V2B = "1";
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2b.ts"))).toBe(true);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v2.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("scope-sequence-v1.ts"))).toBe(false);
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V2B).toBe("1");
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V2).toBeUndefined();
    expect(runtimeEnv.HARNESS_SCOPE_SEQUENCE_V1).toBeUndefined();
  });

  it("hard error when SS1 and SS2b flags are set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V1 = "1";
    process.env.HARNESS_SCOPE_SEQUENCE_V2B = "1";
    expect(() => resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG)).toThrow(
      /mutually exclusive experiment flags/i,
    );
  });

  it("hard error when SS2 and SS2b flags are set", () => {
    process.env.HARNESS_SCOPE_SEQUENCE_V2 = "1";
    process.env.HARNESS_SCOPE_SEQUENCE_V2B = "1";
    expect(() => resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG)).toThrow(
      /mutually exclusive experiment flags/i,
    );
  });

  it("reads HARNESS_SCOPE_SEQUENCE_V2B from environment", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    expect(scopeSequenceV2bEnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_SCOPE_SEQUENCE_V2B = "1";
    expect(scopeSequenceV2bEnabledFromEnvironment()).toBe(true);
  });

  it("assertMutuallyExclusiveScopeSequenceExperimentFlags allows exactly one flag", () => {
    delete process.env.HARNESS_SCOPE_SEQUENCE_V1;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2;
    delete process.env.HARNESS_SCOPE_SEQUENCE_V2B;
    expect(() => assertMutuallyExclusiveScopeSequenceExperimentFlags()).not.toThrow();

    process.env.HARNESS_SCOPE_SEQUENCE_V2B = "1";
    expect(() => assertMutuallyExclusiveScopeSequenceExperimentFlags()).not.toThrow();
  });
});
