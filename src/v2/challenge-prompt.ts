import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripPiDocumentationBlock } from "../../solution/extensions/protected-paths.js";
import { earlyVerifyV1EnabledFromEnvironment } from "../../solution/extensions/early-verify-core.js";
import { testStructureV1EnabledFromEnvironment } from "../../solution/extensions/test-structure-core.js";
import { testAuthoringGuardV1EnabledFromEnvironment } from "../../solution/extensions/test-authoring-guard.js";
import { convergenceInterventionV1EnabledFromEnvironment } from "../../solution/extensions/convergence-intervention-core.js";
import { scopeSequenceV1EnabledFromEnvironment, scopeSequenceV2EnabledFromEnvironment, scopeSequenceV2bEnabledFromEnvironment, assertMutuallyExclusiveScopeSequenceExperimentFlags } from "../../solution/extensions/scope-sequence-core.js";
import { verifyRepairV1EnabledFromEnvironment } from "../../solution/extensions/verify-failure-format.js";
import { tailSweepV1EnabledFromEnvironment } from "../../solution/extensions/tail-sweep-core.js";
import { hardStopAfterGreenV1EnabledFromEnvironment } from "../../solution/extensions/hard-stop-after-green-core.js";
import { fullGreenGateV1EnabledFromEnvironment } from "../../solution/extensions/full-green-gate-core.js";
import { repairSurfaceLockV1EnabledFromEnvironment } from "../../solution/extensions/repair-surface-lock-core.js";
import { preGreenSingleTestV1EnabledFromEnvironment } from "../../solution/extensions/pre-green-single-test-core.js";
import { errorMemoryV1EnabledFromEnvironment } from "../../solution/extensions/error-memory-core.js";
import { rootErrorFirstV1EnabledFromEnvironment } from "../../solution/extensions/root-error-first-core.js";
import {
  applyProductQualityContractV1,
  productQualityContractV1EnabledFromEnvironment,
} from "../../solution/product-quality-contract-v1.js";
import type { HarnessConfig } from "./config.js";
import { cssVocabularyGuardsEnabled, type TemplateOverlayConfig } from "./template-overlays.js";

export interface ChallengePromptSources {
  systemPrompt: string;
  publicJourneys: string;
  agentsMd: string;
}

export interface ChallengePromptBundle {
  idea: string;
  sources: ChallengePromptSources;
  raw_append_system_prompt: string;
  effective_append_system_prompt: string;
  effective_full_system_prompt: string;
  pi_builtin_system_prompt: string;
  user_message: string;
}

export interface ChallengeExtensionResolution {
  extensions: string[];
  skill: string;
  css_guards_enabled: boolean;
  runtime_env: Record<string, string>;
}

export function buildAppendSystemPrompt(
  systemPrompt: string,
  publicJourneys: string,
  agentsMd: string,
): string {
  return `${systemPrompt.trim()}\n\n${publicJourneys.trim()}\n\n${agentsMd.trim()}`;
}

export function buildProductIdeaUserMessage(idea: string): string {
  return `## Product idea\n\n${idea.trim()}\n`;
}

export async function loadChallengePromptSources(
  repositoryRoot: string,
  agentsMd: string,
): Promise<ChallengePromptSources> {
  const [systemPrompt, publicJourneys] = await Promise.all([
    readFile(path.join(repositoryRoot, "solution", "system-prompt.md"), "utf8"),
    readFile(path.join(repositoryRoot, "contract-public", "journeys.md"), "utf8"),
  ]);
  return { systemPrompt, publicJourneys, agentsMd };
}

export async function resolvePiBuiltInSystemPrompt(cwd = "/"): Promise<string> {
  const piEntry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
  const systemPromptModulePath = path.join(path.dirname(piEntry), "core/system-prompt.js");
  const { buildSystemPrompt } = (await import(pathToFileURL(systemPromptModulePath).href)) as {
    buildSystemPrompt: (options: { cwd: string }) => string;
  };
  return buildSystemPrompt({ cwd });
}

export function applyProtectedPathsSystemPromptTransform(systemPrompt: string): string {
  return stripPiDocumentationBlock(systemPrompt);
}

function extractEffectiveAppendSystemPrompt(
  piBuiltInSystemPrompt: string,
  rawAppendSystemPrompt: string,
): { effectiveFullSystemPrompt: string; effectiveAppendSystemPrompt: string } {
  const rawFull = `${piBuiltInSystemPrompt.trim()}\n\n${rawAppendSystemPrompt.trim()}`;
  const effectiveFullSystemPrompt = applyProtectedPathsSystemPromptTransform(rawFull);
  const effectiveBuiltin = applyProtectedPathsSystemPromptTransform(piBuiltInSystemPrompt.trim());
  const prefix = `${effectiveBuiltin.trim()}\n\n`;
  const effectiveAppendSystemPrompt = effectiveFullSystemPrompt.startsWith(prefix)
    ? effectiveFullSystemPrompt.slice(prefix.length)
    : rawAppendSystemPrompt;
  return { effectiveFullSystemPrompt, effectiveAppendSystemPrompt };
}

export function buildChallengePromptBundle(input: {
  idea: string;
  sources: ChallengePromptSources;
  piBuiltInSystemPrompt: string;
  env?: NodeJS.ProcessEnv;
}): ChallengePromptBundle {
  const systemPrompt = applyProductQualityContractV1(
    input.sources.systemPrompt,
    input.env ?? process.env,
  );
  const rawAppend = buildAppendSystemPrompt(
    systemPrompt,
    input.sources.publicJourneys,
    input.sources.agentsMd,
  );
  const { effectiveFullSystemPrompt, effectiveAppendSystemPrompt } = extractEffectiveAppendSystemPrompt(
    input.piBuiltInSystemPrompt,
    rawAppend,
  );

  return {
    idea: input.idea.trim(),
    sources: {
      ...input.sources,
      systemPrompt,
    },
    raw_append_system_prompt: rawAppend,
    effective_append_system_prompt: effectiveAppendSystemPrompt,
    effective_full_system_prompt: effectiveFullSystemPrompt,
    pi_builtin_system_prompt: input.piBuiltInSystemPrompt,
    user_message: buildProductIdeaUserMessage(input.idea),
  };
}

export function resolveChallengeExtensions(
  repositoryRoot: string,
  harnessConfig: HarnessConfig,
): Pick<ChallengeExtensionResolution, "extensions" | "skill"> {
  assertMutuallyExclusiveScopeSequenceExperimentFlags();
  const extensions = [
    path.join(repositoryRoot, "solution", "extensions", "protected-paths.ts"),
  ];
  if (harnessConfig.harness_owned_verify) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "harness-owned-verify.ts"));
  }
  if (tailSweepV1EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "tail-sweep-v1.ts"));
  }
  if (hardStopAfterGreenV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "hard-stop-after-green-v1.ts"),
    );
  }
  if (fullGreenGateV1EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "full-green-gate-v1.ts"));
  }
  if (repairSurfaceLockV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "repair-surface-lock-v1.ts"),
    );
  }
  if (preGreenSingleTestV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "pre-green-single-test-v1.ts"),
    );
  }
  if (verifyRepairV1EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "verify-repair-v1.ts"));
  }
  if (testAuthoringGuardV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "test-authoring-guard-v1.ts"),
    );
  }
  if (earlyVerifyV1EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "early-verify-v1.ts"));
  }
  if (testStructureV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "harness-owned-test-structure-v1.ts"),
    );
  }
  if (convergenceInterventionV1EnabledFromEnvironment()) {
    extensions.push(
      path.join(repositoryRoot, "solution", "extensions", "convergence-intervention-v1.ts"),
    );
  }
  if (scopeSequenceV1EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "scope-sequence-v1.ts"));
  } else if (scopeSequenceV2bEnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "scope-sequence-v2b.ts"));
  } else if (scopeSequenceV2EnabledFromEnvironment()) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "scope-sequence-v2.ts"));
  }
  return {
    extensions,
    skill: path.join(repositoryRoot, "solution", "skills", "mvp-builder"),
  };
}

export function resolveChallengeRuntimeEnv(
  overlayConfig: TemplateOverlayConfig,
  harnessConfig: HarnessConfig,
): Record<string, string> {
  const runtimeEnv: Record<string, string> = {
    TEMPLATE_CSS_VOCABULARY: cssVocabularyGuardsEnabled(overlayConfig) ? "1" : "0",
    TEMPLATE_TAILWIND: overlayConfig.tailwind ? "1" : "0",
    TEMPLATE_API_CLIENT: overlayConfig.api_client ? "1" : "0",
    TEMPLATE_STRIPE: overlayConfig.stripe ? "1" : "0",
  };
  if (harnessConfig.harness_owned_verify) {
    runtimeEnv.HARNESS_OWNED_VERIFY = "1";
  }
  if (tailSweepV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_TAIL_SWEEP_V1 = "1";
  }
  if (verifyRepairV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_VERIFY_REPAIR_V1 = "1";
  }
  if (testAuthoringGuardV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_TEST_AUTHORING_GUARD_V1 = "1";
  }
  if (earlyVerifyV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_EARLY_VERIFY_V1 = "1";
  }
  if (testStructureV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_OWNED_TEST_STRUCTURE_V1 = "1";
  }
  if (convergenceInterventionV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_CONVERGENCE_INTERVENTION_V1 = "1";
  }
  if (scopeSequenceV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_SCOPE_SEQUENCE_V1 = "1";
  } else if (scopeSequenceV2bEnabledFromEnvironment()) {
    runtimeEnv.HARNESS_SCOPE_SEQUENCE_V2B = "1";
  } else if (scopeSequenceV2EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_SCOPE_SEQUENCE_V2 = "1";
  }
  if (errorMemoryV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_ERROR_MEMORY_V1 = "1";
  }
  if (rootErrorFirstV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_ROOT_ERROR_FIRST_V1 = "1";
  }
  const rtlEvidenceRaw = process.env.HARNESS_VERIFY_RTL_EVIDENCE_V1;
  if (rtlEvidenceRaw !== undefined && rtlEvidenceRaw.trim() !== "") {
    const normalized = rtlEvidenceRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_RTL_EVIDENCE_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_RTL_EVIDENCE_V1 = "1";
    }
  }
  const rtlMultipleRaw = process.env.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1;
  if (rtlMultipleRaw !== undefined && rtlMultipleRaw.trim() !== "") {
    const normalized = rtlMultipleRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1 = "1";
    }
  }
  const rtlTextRaw = process.env.HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1;
  if (rtlTextRaw !== undefined && rtlTextRaw.trim() !== "") {
    const normalized = rtlTextRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1 = "1";
    }
  }
  const testContextRaw = process.env.HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1;
  if (testContextRaw !== undefined && testContextRaw.trim() !== "") {
    const normalized = testContextRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1 = "1";
    }
  }
  const typecheckOnFailRaw = process.env.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1;
  if (typecheckOnFailRaw !== undefined && typecheckOnFailRaw.trim() !== "") {
    const normalized = typecheckOnFailRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1 = "1";
    }
  }
  const repairPresentHintRaw = process.env.HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1;
  if (repairPresentHintRaw !== undefined && repairPresentHintRaw.trim() !== "") {
    const normalized = repairPresentHintRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1 = "1";
    }
  }
  const hardStopRaw = process.env.HARNESS_HARD_STOP_AFTER_GREEN_V1;
  if (hardStopRaw !== undefined && hardStopRaw.trim() !== "") {
    const normalized = hardStopRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_HARD_STOP_AFTER_GREEN_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_HARD_STOP_AFTER_GREEN_V1 = "1";
    }
  }
  // Ship KEEP: default ON when unset (mirror fullGreenGateV1EnabledFromEnvironment).
  runtimeEnv.HARNESS_FULL_GREEN_GATE_V1 = fullGreenGateV1EnabledFromEnvironment() ? "1" : "0";
  const repairSurfaceLockRaw = process.env.HARNESS_REPAIR_SURFACE_LOCK_V1;
  if (repairSurfaceLockRaw !== undefined && repairSurfaceLockRaw.trim() !== "") {
    const normalized = repairSurfaceLockRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_REPAIR_SURFACE_LOCK_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_REPAIR_SURFACE_LOCK_V1 = "1";
    }
  }
  const preGreenSingleTestRaw = process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1;
  if (preGreenSingleTestRaw !== undefined && preGreenSingleTestRaw.trim() !== "") {
    const normalized = preGreenSingleTestRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    }
  }
  const qualityContractRaw = process.env.HARNESS_PRODUCT_QUALITY_CONTRACT_V1;
  if (qualityContractRaw !== undefined && qualityContractRaw.trim() !== "") {
    const normalized = qualityContractRaw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      runtimeEnv.HARNESS_PRODUCT_QUALITY_CONTRACT_V1 = "0";
    } else if (normalized === "1" || normalized === "true" || normalized === "yes") {
      runtimeEnv.HARNESS_PRODUCT_QUALITY_CONTRACT_V1 = "1";
    }
  } else if (productQualityContractV1EnabledFromEnvironment()) {
    runtimeEnv.HARNESS_PRODUCT_QUALITY_CONTRACT_V1 = "1";
  }
  return runtimeEnv;
}

export function resolveChallengeExtensionResolution(
  repositoryRoot: string,
  overlayConfig: TemplateOverlayConfig,
  harnessConfig: HarnessConfig,
): ChallengeExtensionResolution {
  const { extensions, skill } = resolveChallengeExtensions(repositoryRoot, harnessConfig);
  return {
    extensions,
    skill,
    css_guards_enabled: cssVocabularyGuardsEnabled(overlayConfig),
    runtime_env: resolveChallengeRuntimeEnv(overlayConfig, harnessConfig),
  };
}

export function buildPiArgumentsFromBundle(
  bundle: ChallengePromptBundle,
  artifactDirectory: string,
  repositoryRoot: string,
  harnessConfig: HarnessConfig,
): string[] {
  const { extensions, skill } = resolveChallengeExtensions(repositoryRoot, harnessConfig);
  const args = [
    "--mode",
    "json",
    "--offline",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--append-system-prompt",
    bundle.raw_append_system_prompt,
    "--session-dir",
    path.join(artifactDirectory, "sessions"),
    ...extensions.flatMap((extensionPath) => ["--extension", extensionPath]),
    "--skill",
    skill,
  ];
  if (process.env.CHALLENGE_PROVIDER) args.push("--provider", process.env.CHALLENGE_PROVIDER);
  if (process.env.CHALLENGE_MODEL) args.push("--model", process.env.CHALLENGE_MODEL);
  args.push("--thinking", process.env.CHALLENGE_THINKING ?? "high");
  args.push(bundle.user_message);
  return args;
}
