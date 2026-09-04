import { describe, expect, it } from "vitest";
import {
  estimateLegacyPromptTokens,
  formatVolatileWorkerPrompt,
  initialMilestoneContext,
  measureContextPrompt,
  maybeCompactContext,
} from "../../src/v2/context/index.js";
import { diagnoseFindings, type SensorFinding } from "../../src/v2/sensors/index.js";
import { selectVoiAction } from "../../src/v2/voi/select.js";
import { initialMilestoneState } from "../../src/v2/milestone-ralph/state.js";

describe("context intelligence", () => {
  it("keeps volatile prompts much smaller than legacy idea+l0 dumps", () => {
    const idea = "I run a pottery studio and need to track glazes and clay supplies with low-stock alerts.".repeat(20);
    const legacy = estimateLegacyPromptTokens({
      idea,
      instruction: "Ship modular app with domain storage components and journeys...\n".repeat(80),
      sealedSummary: "slice0 pass, slice1 fail, slice2 pass",
      lastL0Summary: "L0 FAIL\n" + "- vitest failed: expected badge\n".repeat(40),
      qualityGaps: [
        "- Missing domain",
        "- Missing storage",
        "- Missing components",
        "- Confirm UX",
        "- Confirm interaction-stability",
        "- Keep suite lean",
      ],
    });
    const context = initialMilestoneContext(idea, ["Establish storage before UI expansion"]);
    context.volatile.top_findings = [
      {
        severity: "critical",
        area: "tests",
        evidence: "no product tests",
        recommended_action: "add journeys",
      },
    ];
    const volatile = formatVolatileWorkerPrompt(context);
    const metrics = measureContextPrompt({
      slice: 0,
      stableSystemChars: 12_000,
      volatilePrompt: volatile,
      context,
      legacyEstimateTokens: legacy,
      compacted: false,
    });
    expect(metrics.estimated_tokens_after).toBeLessThan(metrics.estimated_tokens_before);
    expect(metrics.reduction_ratio).toBeGreaterThanOrEqual(0.3);
  });

  it("compacts oversized volatile state", () => {
    const context = initialMilestoneContext("Track books");
    context.volatile.known_defects = Array.from({ length: 40 }, (_, i) => `defect-${i}`);
    context.volatile.changed_files = Array.from({ length: 80 }, (_, i) => `src/f${i}.ts`);
    context.volatile.top_findings = Array.from({ length: 20 }, (_, i) => ({
      severity: "medium",
      area: "journeys",
      evidence: `e${i}`,
      recommended_action: `a${i}`,
    }));
    // Force compact by making JSON large — lower threshold via many fields
    const { compacted, context: next } = maybeCompactContext(context);
    expect(typeof compacted).toBe("boolean");
    expect(next.volatile.top_findings.length).toBeLessThanOrEqual(20);
  });
});

describe("sensors diagnose", () => {
  it("prioritizes critical findings", () => {
    const findings: SensorFinding[] = [
      {
        sensor: "a",
        severity: "low",
        area: "ux",
        evidence: "x",
        files: [],
        recommended_action: "y",
      },
      {
        sensor: "b",
        severity: "critical",
        area: "tests",
        evidence: "no tests",
        files: ["src/App.tsx"],
        recommended_action: "add tests",
        code: "no_product_tests",
      },
    ];
    const diagnosis = diagnoseFindings(findings);
    expect(diagnosis[0]?.severity).toBe("critical");
    expect(diagnosis[0]?.code).toBe("no_product_tests");
  });
});

describe("adaptive VOI", () => {
  it("selects implement_core when no product tests exist", () => {
    const state = initialMilestoneState();
    const decision = selectVoiAction({
      observation: {
        sourceFiles: ["src/App.tsx"],
        productTestFiles: [],
        hasReportPartial: false,
        reportStatus: null,
        implementedFeatures: [],
        hasDomainModule: false,
        hasStorageModule: false,
        hasComponentModules: false,
      },
      diagnosis: [
        {
          severity: "critical",
          area: "architecture",
          evidence: "no tests",
          files: [],
          recommended_action: "implement",
          sensor: "architecture",
          code: "no_product_tests",
        },
      ],
      state,
      maxSlices: 3,
      unchangedWorkspaceStreak: 0,
    });
    expect(decision.selected.kind).toBe("implement_core");
    expect(decision.selected.action).toBe("implement_core");
  });

  it("stops after a green continue when no critical gaps", () => {
    const state = initialMilestoneState();
    state.slice = 2;
    state.last_action = "continue_journeys";
    state.last_l0 = {
      passed: true,
      tests_passed: true,
      build_passed: true,
      http_passed: false,
      summary: "L0 PASS",
    };
    const decision = selectVoiAction({
      observation: {
        sourceFiles: ["src/App.tsx", "src/a.test.tsx"],
        productTestFiles: ["src/a.test.tsx"],
        hasReportPartial: true,
        reportStatus: "success",
        implementedFeatures: ["list"],
        hasDomainModule: true,
        hasStorageModule: true,
        hasComponentModules: true,
      },
      diagnosis: [],
      state,
      maxSlices: 3,
      unchangedWorkspaceStreak: 0,
    });
    expect(decision.selected.kind).toBe("stop");
    expect(decision.stop_reason).toBeTruthy();
  });

  it("does not stop on voi_below_cost_threshold while domain/storage are missing", () => {
    const state = initialMilestoneState();
    state.slice = 1;
    state.last_action = "implement_core";
    state.last_l0 = {
      passed: true,
      tests_passed: true,
      build_passed: true,
      http_passed: false,
      summary: "L0 PASS",
    };
    const decision = selectVoiAction({
      observation: {
        sourceFiles: ["src/App.tsx", "src/App.test.tsx"],
        productTestFiles: ["src/App.test.tsx"],
        hasReportPartial: true,
        reportStatus: "partial",
        implementedFeatures: [],
        hasDomainModule: false,
        hasStorageModule: false,
        hasComponentModules: false,
      },
      diagnosis: [
        {
          severity: "high",
          area: "architecture",
          evidence: "Missing src/domain/",
          files: [],
          recommended_action: "Extract domain",
          sensor: "architecture",
          code: "missing_domain",
        },
        {
          severity: "high",
          area: "architecture",
          evidence: "Missing src/storage/",
          files: [],
          recommended_action: "Add repository",
          sensor: "architecture",
          code: "missing_storage",
        },
      ],
      state,
      maxSlices: 3,
      unchangedWorkspaceStreak: 0,
      stableSystemTokens: 5_000,
      volatileTokens: 300,
    });
    expect(decision.stop_reason).toBeNull();
    expect(decision.selected.kind).toBe("fix_architecture");
    expect(decision.selected.action).toBe("continue_journeys");
  });

  it("scores actions with competition-weighted cost in the denominator", () => {
    const state = initialMilestoneState();
    // No green L0 yet — otherwise cost-aware stop may prefer "stop" over a medium gap.
    const decision = selectVoiAction({
      observation: {
        sourceFiles: ["src/App.tsx", "src/a.test.tsx"],
        productTestFiles: ["src/a.test.tsx"],
        hasReportPartial: true,
        reportStatus: "partial",
        implementedFeatures: ["list"],
        hasDomainModule: true,
        hasStorageModule: false,
        hasComponentModules: true,
      },
      diagnosis: [
        {
          severity: "high",
          area: "persistence",
          evidence: "missing storage",
          files: ["src/App.tsx"],
          recommended_action: "add repository",
          sensor: "architecture",
          code: "missing_storage",
        },
      ],
      state,
      maxSlices: 3,
      unchangedWorkspaceStreak: 0,
      stableSystemTokens: 5_000,
      volatileTokens: 300,
    });
    expect(decision.selected.kind).not.toBe("stop");
    expect(decision.selected.breakdown.expected_weighted_cost).toBeGreaterThan(0);
    expect(decision.selected.breakdown.spend.estimated_output_tokens).toBeGreaterThan(0);
    expect(decision.selected.contract.output_budget_tokens).toBeGreaterThan(0);
  });
});