import type { DiagnosisFinding } from "../sensors/types.js";
import type { CandidateKind } from "../voi/select.js";
import { estimateTokens } from "./estimate.js";

export interface SliceContract {
  objective: string;
  evidence: string[];
  files: string[];
  required_behavior: string;
  do_not_modify: string[];
  success_condition: string;
  output_budget_tokens: number;
  kind: CandidateKind | string;
}

const OUTPUT_BUDGET: Record<string, number> = {
  implement_core: 5_000,
  repair_failure: 2_500,
  fix_architecture: 3_000,
  fix_persistence: 2_500,
  improve_accessibility: 2_000,
  complete_missing_journey: 2_500,
  stop: 0,
};

export function buildSliceContract(input: {
  kind: CandidateKind | string;
  title: string;
  success_condition: string;
  diagnosis: DiagnosisFinding[];
}): SliceContract {
  const top = input.diagnosis.slice(0, 2);
  const files = [...new Set(top.flatMap((d) => d.files))].slice(0, 6);
  const evidence = top.map((d) => `[${d.severity}/${d.area}] ${d.evidence}`);
  const required =
    top[0]?.recommended_action ??
    (input.kind === "implement_core"
      ? "Ship modular app + high-information journeys covering usability, persistence, robustness"
      : input.title);

  const doNot =
    input.kind === "implement_core"
      ? ["src/styles.css", "package.json dependency adds", "long textual plans"]
      : [
          "Unrelated features",
          "Expanding the test suite beyond the success condition",
          "src/styles.css",
          "Rewriting working sealed journeys",
        ];

  return {
    objective: input.title,
    evidence: evidence.length > 0 ? evidence : ["(initial implement — no prior L0 evidence)"],
    files: files.length > 0 ? files : input.kind === "implement_core" ? ["src/App.tsx", "src/domain/", "src/storage/", "src/components/"] : [],
    required_behavior: required,
    do_not_modify: doNot,
    success_condition: input.success_condition,
    output_budget_tokens: OUTPUT_BUDGET[input.kind] ?? 2_500,
    kind: input.kind,
  };
}

/**
 * Minimal sufficient worker prompt: slice contract only.
 * No full architecture dumps, journey catalogs, or memory essays.
 */
export function formatSliceContractPrompt(contract: SliceContract, ideaDigest: string): string {
  return [
    "# SLICE CONTRACT",
    "",
    `Objective: ${contract.objective}`,
    `Kind: ${contract.kind}`,
    "",
    "## Evidence",
    ...contract.evidence.map((e) => `- ${e}`),
    "",
    "## Files in scope",
    ...(contract.files.length === 0 ? ["- (infer from evidence; stay minimal)"] : contract.files.map((f) => `- ${f}`)),
    "",
    "## Required behavior",
    contract.required_behavior,
    "",
    "## Do NOT modify / do NOT do",
    ...contract.do_not_modify.map((d) => `- ${d}`),
    "",
    "## Success condition",
    contract.success_condition,
    "",
    `## Output budget: ≤ ${contract.output_budget_tokens} tokens of assistant prose`,
    "",
    "## Worker output governance",
    "1. Work until the success condition is reached.",
    "2. Do not provide long explanations or repeat this contract.",
    "3. Do not print large files or logs.",
    "4. Prefer direct write/edit tool calls.",
    "5. Stop immediately after npm test + npm run build pass (once).",
    "6. Final message ≤ 80 tokens.",
    "",
    "## Idea digest",
    ideaDigest,
    "",
    "Disk is source of truth. Implement only this contract, then stop.",
    "",
  ].join("\n");
}

export function estimateSliceContractTokens(contract: SliceContract, ideaDigest: string): number {
  return estimateTokens(formatSliceContractPrompt(contract, ideaDigest));
}
