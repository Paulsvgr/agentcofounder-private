import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripPiDocumentationBlock } from "../../solution/extensions/protected-paths.js";
import { earlyVerifyV1EnabledFromEnvironment } from "../../solution/extensions/early-verify-core.js";
import { testStructureV1EnabledFromEnvironment } from "../../solution/extensions/test-structure-core.js";
import { testAuthoringGuardV1EnabledFromEnvironment } from "../../solution/extensions/test-authoring-guard.js";
import { convergenceInterventionV1EnabledFromEnvironment } from "../../solution/extensions/convergence-intervention-core.js";
import { scopeSequenceV1EnabledFromEnvironment } from "../../solution/extensions/scope-sequence-core.js";
import { verifyRepairV1EnabledFromEnvironment } from "../../solution/extensions/verify-failure-format.js";
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
}): ChallengePromptBundle {
  const rawAppend = buildAppendSystemPrompt(
    input.sources.systemPrompt,
    input.sources.publicJourneys,
    input.sources.agentsMd,
  );
  const { effectiveFullSystemPrompt, effectiveAppendSystemPrompt } = extractEffectiveAppendSystemPrompt(
    input.piBuiltInSystemPrompt,
    rawAppend,
  );

  return {
    idea: input.idea.trim(),
    sources: input.sources,
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
  const extensions = [
    path.join(repositoryRoot, "solution", "extensions", "protected-paths.ts"),
  ];
  if (harnessConfig.harness_owned_verify) {
    extensions.push(path.join(repositoryRoot, "solution", "extensions", "harness-owned-verify.ts"));
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
  };
  if (harnessConfig.harness_owned_verify) {
    runtimeEnv.HARNESS_OWNED_VERIFY = "1";
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
  args.push("--thinking", process.env.CHALLENGE_THINKING ?? "off");
  args.push(bundle.user_message);
  return args;
}
