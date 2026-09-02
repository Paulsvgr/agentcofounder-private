import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONVERGENCE_INTERVENTION_EXPORT_FILENAME,
  TIER1_MESSAGE,
  TIER2_MESSAGE,
  appendInterventionTier,
  classifyConvergenceState,
  convergenceInterventionV1EnabledFromEnvironment,
  createEmptyConvergenceExport,
  decideInterventionTier,
  hasExactSignatureRepeat,
  isDebugSidecarBashCommand,
  isDebugSidecarWritePath,
  markDebugSidecarFromToolCall,
  normalizeSignatures,
  parseFailedCount,
  processCanonicalVerifyForConvergence,
  resetConvergenceSession,
} from "../solution/extensions/convergence-intervention-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const RTL_FAIL_BLOCK = [
  "[1/1]",
  "FAIL src/App.test.tsx",
  "TEST journeys > adds a book",
  "TYPE TestingLibraryElementError",
  "AT src/App.test.tsx:42:11",
  "MESSAGE",
  'Found multiple elements with the text: Title',
].join("\n");

function verifyText(failed: number, total: number, body = RTL_FAIL_BLOCK): string {
  return [
    `verify exit_code=1 (FAIL)`,
    "",
    `❌ FAIL ${total - failed}/${total} tests · ${failed} failed`,
    body,
  ].join("\n");
}

describe("convergence-intervention-core", () => {
  const previousEnv = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  const previousArtifact = process.env.CHALLENGE_RUN_ARTIFACT_DIR;

  afterEach(() => {
    if (previousEnv === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previousEnv;
    if (previousArtifact === undefined) delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
    else process.env.CHALLENGE_RUN_ARTIFACT_DIR = previousArtifact;
  });

  it("reads HARNESS_CONVERGENCE_INTERVENTION_V1 from environment", () => {
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    expect(convergenceInterventionV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = "1";
    expect(convergenceInterventionV1EnabledFromEnvironment()).toBe(true);
  });

  it("parses failed count from canonical verify header", () => {
    expect(parseFailedCount("❌ FAIL 9/10 tests · 1 failed")).toBe(1);
    expect(parseFailedCount("verify exit_code=1 (FAIL)\n\n❌ FAIL 0/0 tests · suite did not run")).toBe(null);
  });

  it("classifies converging, stalled, and regressing from fail counts", () => {
    expect(
      classifyConvergenceState({
        failedBefore: 11,
        failedAfter: 1,
        isFirstVerify: false,
        isPass: false,
      }),
    ).toBe("converging");
    expect(
      classifyConvergenceState({
        failedBefore: 4,
        failedAfter: 4,
        isFirstVerify: false,
        isPass: false,
      }),
    ).toBe("stalled");
    expect(
      classifyConvergenceState({
        failedBefore: 1,
        failedAfter: 4,
        isFirstVerify: false,
        isPass: false,
      }),
    ).toBe("regressing");
    expect(
      classifyConvergenceState({
        failedBefore: 4,
        failedAfter: 0,
        isFirstVerify: false,
        isPass: true,
      }),
    ).toBe("converging");
    expect(
      classifyConvergenceState({
        failedBefore: null,
        failedAfter: 2,
        isFirstVerify: true,
        isPass: false,
      }),
    ).toBe("converging");
  });

  it("detects exact normalized signature repetition for fallback", () => {
    const sig = normalizeSignatures(RTL_FAIL_BLOCK).map((record) => record.signature)[0];
    expect(sig).toBeTruthy();
    expect(hasExactSignatureRepeat([sig!], [sig!])).toBe(true);
    expect(hasExactSignatureRepeat([sig!], ["other|sig"])).toBe(false);
  });

  it("decides Tier 1 on stalled/regressing and Tier 2 with debug sidecar", () => {
    expect(
      decideInterventionTier({
        state: "stalled",
        signaturesBefore: ["a"],
        signaturesAfter: ["b"],
        debugSidecarSinceLastVerify: false,
      }),
    ).toEqual({ tier: 1, signatureFallback: false });

    expect(
      decideInterventionTier({
        state: "regressing",
        signaturesBefore: ["a"],
        signaturesAfter: ["b"],
        debugSidecarSinceLastVerify: true,
      }),
    ).toEqual({ tier: 2, signatureFallback: false });

    expect(
      decideInterventionTier({
        state: "unknown",
        signaturesBefore: ["rtl_duplicate|Title"],
        signaturesAfter: ["rtl_duplicate|Title"],
        debugSidecarSinceLastVerify: true,
      }),
    ).toEqual({ tier: 1, signatureFallback: true });
  });

  it("detects debug sidecar paths and bash heredocs", () => {
    expect(isDebugSidecarWritePath("src/debug.test.tsx")).toBe(true);
    expect(isDebugSidecarWritePath("src/App.test.tsx")).toBe(false);
    expect(isDebugSidecarBashCommand("cat > src/debug.test.tsx << 'EOF'")).toBe(true);
    expect(isDebugSidecarBashCommand("cat > /tmp/probe.test.ts << 'EOF'")).toBe(true);
  });
});

describe("convergence-intervention verify piggyback", () => {
  const previousEnv = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  let artifactDir = "";

  afterEach(() => {
    if (previousEnv === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previousEnv;
    if (artifactDir) rmSync(artifactDir, { recursive: true, force: true });
    artifactDir = "";
    delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  });

  function enableIntervention(): void {
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = "1";
    artifactDir = mkdtempSync(path.join(tmpdir(), "s1-export-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = artifactDir;
    resetConvergenceSession();
  }

  it("does not append on converging 11→1 transition", () => {
    enableIntervention();
    const first = processCanonicalVerifyForConvergence(verifyText(11, 12), 1);
    expect(first).not.toContain("[harness]");
    const second = processCanonicalVerifyForConvergence(verifyText(1, 12), 1);
    expect(second).not.toContain(TIER1_MESSAGE);
    expect(second).not.toContain(TIER2_MESSAGE);
  });

  it("appends Tier 1 on stalled and regressing transitions", () => {
    enableIntervention();
    processCanonicalVerifyForConvergence(verifyText(4, 10), 1);
    const stalled = processCanonicalVerifyForConvergence(verifyText(4, 10), 1);
    expect(stalled.endsWith(TIER1_MESSAGE)).toBe(true);

    resetConvergenceSession();
    processCanonicalVerifyForConvergence(verifyText(1, 8), 1);
    const regressing = processCanonicalVerifyForConvergence(verifyText(4, 12), 1);
    expect(regressing.endsWith(TIER1_MESSAGE)).toBe(true);
  });

  it("stays silent on unknown counts unless signature repeats", () => {
    enableIntervention();
    processCanonicalVerifyForConvergence(
      "verify exit_code=1 (FAIL)\n\nError: piped output without structured counts A",
      1,
    );
    const silent = processCanonicalVerifyForConvergence(
      "verify exit_code=1 (FAIL)\n\nError: piped output without structured counts B",
      1,
    );
    expect(silent).not.toContain("[harness]");

    resetConvergenceSession();
    processCanonicalVerifyForConvergence(`verify exit_code=1 (FAIL)\n\n${RTL_FAIL_BLOCK}`, 1);
    const fallback = processCanonicalVerifyForConvergence(`verify exit_code=1 (FAIL)\n\n${RTL_FAIL_BLOCK}`, 1);
    expect(fallback.endsWith(TIER1_MESSAGE)).toBe(true);
  });

  it("appends Tier 2 when debug sidecar appears between non-converging verifies", () => {
    enableIntervention();
    processCanonicalVerifyForConvergence(verifyText(4, 10), 1);
    markDebugSidecarFromToolCall("write", { path: "src/debug.test.tsx" });
    const escalated = processCanonicalVerifyForConvergence(verifyText(4, 10), 1);
    expect(escalated.endsWith(TIER2_MESSAGE)).toBe(true);
  });

  it("does not mutate verify output when intervention env is OFF", () => {
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    const base = verifyText(4, 10);
    expect(processCanonicalVerifyForConvergence(base, 1)).toBe(base);
  });

  it("writes convergence-intervention.v1.json export with transition records", () => {
    enableIntervention();
    processCanonicalVerifyForConvergence(verifyText(4, 10), 1);
    processCanonicalVerifyForConvergence(verifyText(4, 10), 1);

    const exportPath = path.join(artifactDir, CONVERGENCE_INTERVENTION_EXPORT_FILENAME);
    const parsed = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(parsed.schema).toBe("agentcofounder.convergence_intervention.v1");
    expect(parsed.transitions).toHaveLength(2);
    expect(parsed.transitions[1].state).toBe("stalled");
    expect(parsed.transitions[1].intervention_tier).toBe(1);
    expect(parsed.tier1_count).toBe(1);
    expect(parsed.false_positive_converging_interventions).toBe(0);
  });

  it("appendInterventionTier only adds text — no extra tool semantics", () => {
    const base = "verify exit_code=1 (FAIL)\n\nbody";
    expect(appendInterventionTier(base, 0)).toBe(base);
    expect(appendInterventionTier(base, 1)).toBe(`${base}\n\n${TIER1_MESSAGE}`);
  });
});

describe("convergence-intervention OFF parity", () => {
  const previous = process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (previous === undefined) delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    else process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = previous;
  });

  it("OFF: does not load convergence extension (v2.2 parity)", () => {
    delete process.env.HARNESS_CONVERGENCE_INTERVENTION_V1;
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
    delete process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("convergence-intervention-v1.ts"))).toBe(false);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-verify.ts"))).toBe(true);
  });

  it("ON: loads convergence extension and runtime env when flag set", () => {
    process.env.HARNESS_CONVERGENCE_INTERVENTION_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("convergence-intervention-v1.ts"))).toBe(true);
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_CONVERGENCE_INTERVENTION_V1).toBe("1");
  });
});

describe("convergence export schema", () => {
  it("matches frozen prereg shape", () => {
    const record = createEmptyConvergenceExport("2026-09-02T09-38-48-126Z");
    record.transitions.push({
      ordinal: 2,
      state: "regressing",
      counts_known: true,
      failed_before: 1,
      failed_after: 4,
      signatures_before: ["import_resolve|./useCollection"],
      signatures_after: ["rtl_duplicate|Title"],
      intervention_tier: 1,
      delivery: "appended_to_verify_result",
      debug_sidecar_detected: false,
      signature_fallback: false,
    });
    record.tier1_count = 1;
    expect(record.schema).toBe("agentcofounder.convergence_intervention.v1");
    expect(record.transitions[0].delivery).toBe("appended_to_verify_result");
  });
});
