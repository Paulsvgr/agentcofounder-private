export const RUN_LINES = [
  "A",
  "A-prime",
  "B-prime",
  "C",
  "C-prime",
  "D",
  "unknown",
] as const;

export type RunLine = (typeof RUN_LINES)[number];

export const RUN_EXPERIMENTS = [
  "baseline",
  "no-dev-server-prompt",
  "auto-test",
  "autoverify-off",
  "autoverify-supplement",
  "autoverify-owned",
  "autoverify-gated",
  "prime-comparison",
  "legacy",
  "legacy-smoke",
  "unknown",
] as const;

export type RunExperiment = (typeof RUN_EXPERIMENTS)[number];

export interface RunClassification {
  line: RunLine;
  experiment: RunExperiment;
  run_index: number | null;
  display_label: string;
}

export interface DeriveRunClassificationInput {
  approach: string | null;
  git_branch: string | null;
  git_commit: string | null;
  line?: string | null;
  experiment?: string | null;
  run_index?: number | null;
}

type ApproachMapping = {
  line: RunLine;
  experiment: RunExperiment;
  run_index: number | null;
};

const APPROACH_MAP: Record<string, ApproachMapping> = {
  "A-baseline-1": { line: "A", experiment: "baseline", run_index: 1 },
  "A-baseline-2": { line: "A", experiment: "baseline", run_index: 2 },
  "A-baseline-3": { line: "A", experiment: "baseline", run_index: 3 },
  "A-prompt-1": { line: "A", experiment: "no-dev-server-prompt", run_index: 1 },
  "A-prompt-2": { line: "A", experiment: "no-dev-server-prompt", run_index: 2 },
  "A-prompt-3": { line: "A", experiment: "no-dev-server-prompt", run_index: 3 },
  "A-autotest-1": { line: "A", experiment: "auto-test", run_index: 1 },
  "A-autotest-2": { line: "A", experiment: "auto-test", run_index: 2 },
  "A-autotest-3": { line: "A", experiment: "auto-test", run_index: 3 },
  "A-autoverify-owned-1": { line: "A", experiment: "autoverify-owned", run_index: 1 },
  "A-autoverify-owned-2": { line: "A", experiment: "autoverify-owned", run_index: 2 },
  "A-autoverify-owned-3": { line: "A", experiment: "autoverify-owned", run_index: 3 },
  "A-autoverify-supplement-1": { line: "A", experiment: "autoverify-supplement", run_index: 1 },
  "A-autoverify-supplement-2": { line: "A", experiment: "autoverify-supplement", run_index: 2 },
  "A-autoverify-owned-gated-1": { line: "A", experiment: "autoverify-gated", run_index: 1 },
  "A-raw-1": { line: "A", experiment: "baseline", run_index: 1 },
  "A-original": { line: "A", experiment: "legacy", run_index: null },
  "A-prime": { line: "A-prime", experiment: "prime-comparison", run_index: 1 },
  "A-prime-zai": { line: "A-prime", experiment: "prime-comparison", run_index: 1 },
  "B-prime": { line: "B-prime", experiment: "prime-comparison", run_index: 1 },
  "B-prime-zai": { line: "B-prime", experiment: "prime-comparison", run_index: 1 },
  "C-original": { line: "C", experiment: "legacy", run_index: 1 },
  "C-prime-openai": { line: "C-prime", experiment: "prime-comparison", run_index: 1 },
  "C-prime-gpt41": { line: "C-prime", experiment: "prime-comparison", run_index: 1 },
  "C-prime-gpt41-attempt": { line: "C-prime", experiment: "prime-comparison", run_index: 1 },
  "C-prime-zai": { line: "C-prime", experiment: "prime-comparison", run_index: 1 },
  "C-prime-zai-clean": { line: "C-prime", experiment: "prime-comparison", run_index: 1 },
  "C-prime abort": { line: "C-prime", experiment: "legacy-smoke", run_index: null },
  "run-d / D": { line: "D", experiment: "legacy", run_index: 1 },
  "run-d": { line: "D", experiment: "legacy", run_index: 1 },
  base: { line: "A", experiment: "baseline", run_index: null },
};

function parseRunIndex(approach: string): number | null {
  const match = /-(\d+)$/.exec(approach);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function formatDisplayLabel(line: RunLine, experiment: RunExperiment, runIndex: number | null): string {
  const experimentLabel = experiment.replaceAll("-", " ");
  if (runIndex !== null) {
    return `${line} · ${experimentLabel} · run ${runIndex}`;
  }
  return `${line} · ${experimentLabel}`;
}

function inferLineFromApproach(approach: string): RunLine {
  if (approach.startsWith("A-") || approach === "base") {
    return "A";
  }
  if (approach.includes("prime")) {
    const prefix = approach.split("-")[0];
    switch (prefix) {
      case "A":
        return "A-prime";
      case "B":
        return "B-prime";
      case "C":
        return "C-prime";
      default:
        return "unknown";
    }
  }
  if (approach === "run-d" || approach.startsWith("run-d")) {
    return "D";
  }
  return "unknown";
}

function inferExperimentFromApproach(approach: string): RunExperiment | null {
  if (approach.startsWith("A-autoverify-owned-gated") || approach.includes("gated")) {
    return "autoverify-gated";
  }
  if (approach.startsWith("A-autoverify-supplement")) {
    return "autoverify-supplement";
  }
  if (approach.startsWith("A-autoverify-owned")) {
    return "autoverify-owned";
  }
  if (approach.startsWith("A-autoverify-off")) {
    return "autoverify-off";
  }
  if (approach.startsWith("A-prompt")) {
    return "no-dev-server-prompt";
  }
  if (approach.startsWith("A-autotest")) {
    return "auto-test";
  }
  if (approach.startsWith("A-baseline") || approach.startsWith("A-raw")) {
    return "baseline";
  }
  if (approach === "base") {
    return "baseline";
  }
  return null;
}

function inferExperimentFromAutoVerifyEnv(): RunExperiment | null {
  const mode = process.env.CHALLENGE_AUTOVERIFY?.trim();
  if (!mode || mode === "off") {
    return mode === "off" ? "autoverify-off" : null;
  }
  switch (mode) {
    case "supplement":
      return "autoverify-supplement";
    case "harness-owned":
      return "autoverify-owned";
    case "harness-owned-gated":
      return "autoverify-gated";
    default:
      return "unknown";
  }
}

function inferExperimentFromGit(
  gitBranch: string | null,
  gitCommit: string | null,
): RunExperiment | null {
  if (gitBranch === "exp/auto-verify") {
    return inferExperimentFromAutoVerifyEnv() ?? "unknown";
  }
  if (gitBranch === "main" && gitCommit?.startsWith("d0f0b49")) {
    return "baseline";
  }
  return null;
}

function parseRunLine(value: string | null | undefined): RunLine | null {
  if (!value) {
    return null;
  }
  return (RUN_LINES as readonly string[]).includes(value) ? (value as RunLine) : null;
}

function parseRunExperiment(value: string | null | undefined): RunExperiment | null {
  if (!value) {
    return null;
  }
  return (RUN_EXPERIMENTS as readonly string[]).includes(value) ? (value as RunExperiment) : null;
}

export function deriveRunClassification(input: DeriveRunClassificationInput): RunClassification {
  const approach = input.approach?.trim() || "unknown";
  const mapped = APPROACH_MAP[approach];

  let line = parseRunLine(input.line) ?? mapped?.line ?? null;
  let experiment = parseRunExperiment(input.experiment) ?? mapped?.experiment ?? null;
  let runIndex =
    input.run_index !== undefined && input.run_index !== null
      ? input.run_index
      : (mapped?.run_index ?? parseRunIndex(approach));

  if (experiment === null) {
    experiment =
      inferExperimentFromApproach(approach) ??
      inferExperimentFromGit(input.git_branch, input.git_commit) ??
      (approach === "unknown" ? "unknown" : "legacy");
  }

  if (line === null) {
    line = inferLineFromApproach(approach);
  }

  if (experiment === "unknown" && input.git_branch === "exp/auto-verify") {
    experiment = inferExperimentFromAutoVerifyEnv() ?? "unknown";
  }

  return {
    line,
    experiment,
    run_index: runIndex,
    display_label: formatDisplayLabel(line, experiment, runIndex),
  };
}

export function classificationFromEnv(
  approach: string | null,
  gitBranch: string | null,
  gitCommit: string | null,
): RunClassification {
  const runIndexEnv = process.env.RUN_INDEX?.trim();
  let run_index: number | null = null;
  if (runIndexEnv && runIndexEnv.length > 0) {
    const parsed = Number.parseInt(runIndexEnv, 10);
    if (Number.isFinite(parsed)) run_index = parsed;
  }

  return deriveRunClassification({
    approach,
    git_branch: gitBranch,
    git_commit: gitCommit,
    line: process.env.RUN_LINE ?? null,
    experiment: process.env.RUN_EXPERIMENT ?? null,
    run_index,
  });
}
