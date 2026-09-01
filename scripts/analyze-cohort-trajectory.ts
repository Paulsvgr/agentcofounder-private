/**
 * Retro-analyze trajectory metrics v2 for fixed experiment cohorts.
 *
 * Usage:
 *   npm run analyze:cohort-trajectory
 *   npm run analyze:cohort-trajectory -- --cohort control-v2.1
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRun } from "../src/v2/analyze-run.js";
import type { TrajectoryMetrics } from "../src/v2/trajectory-metrics.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TAIL_WEIGHTED_THRESHOLD = 120_000;

const COHORTS: Record<string, { label: string; runIds: string[] }> = {
  "control-v2.1": {
    label: "Control v2.1",
    runIds: [
      "2026-08-31T12-46-51-224Z",
      "2026-08-31T12-53-10-136Z",
      "2026-08-31T12-56-26-048Z",
      "2026-08-31T12-59-28-147Z",
      "2026-08-31T13-05-01-562Z",
    ],
  },
  "experiment-b": {
    label: "Experiment B (data slice)",
    runIds: [
      "2026-08-31T13-27-27-135Z",
      "2026-08-31T13-32-02-109Z",
      "2026-08-31T13-36-25-474Z",
      "2026-08-31T13-40-40-215Z",
      "2026-08-31T13-44-58-268Z",
    ],
  },
  "experiment-c": {
    label: "Experiment C (UI + data slice)",
    runIds: [
      "2026-08-31T14-10-21-280Z",
      "2026-08-31T14-17-22-430Z",
      "2026-08-31T14-23-34-009Z",
      "2026-08-31T14-30-44-720Z",
      "2026-08-31T14-36-58-838Z",
    ],
  },
  "verify-v1": {
    label: "VERIFY v1 (harness-owned verify, invalid exit)",
    runIds: [
      "2026-08-31T15-39-40-550Z",
      "2026-08-31T15-45-36-928Z",
      "2026-08-31T15-51-10-217Z",
      "2026-08-31T15-54-07-890Z",
      "2026-08-31T15-57-09-094Z",
    ],
  },
  "verify-v1.1": {
    label: "VERIFY v1.1 / Control v2.2 baseline",
    runIds: [
      "2026-08-31T21-16-45-263Z",
      "2026-08-31T21-19-44-728Z",
      "2026-08-31T21-22-09-667Z",
      "2026-08-31T21-24-11-541Z",
      "2026-08-31T21-28-10-966Z",
    ],
  },
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function distribution(values: number[]): string {
  if (values.length === 0) return "—";
  return [...values].sort((left, right) => left - right).join(", ");
}

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function num(value: number | null, digits = 0): string {
  if (value === null) return "—";
  return value.toFixed(digits);
}

function rowCells(metrics: TrajectoryMetrics): string[] {
  return [
    metrics.run_id.slice(0, 19),
    String(Math.round(metrics.weighted_total)),
    String(metrics.model_calls),
    num(metrics.weighted_per_call),
    pct(metrics.first_test_pass_ratio),
    metrics.first_canonical_test_green_call === null ? "—" : String(metrics.first_canonical_test_green_call),
    metrics.first_valid_full_green_call === null ? "—" : String(metrics.first_valid_full_green_call),
    String(metrics.canonical_fail_before_first_canonical_green),
    String(metrics.canonical_unknown_before_first_canonical_green),
    String(metrics.verify_tool_count),
    String(metrics.piped_test_command_count),
    String(metrics.debug_test_files_created.length),
    String(metrics.post_valid_full_green_calls),
  ];
}

function cohortSummary(label: string, metrics: TrajectoryMetrics[]): string[] {
  const weighted = metrics.map((entry) => entry.weighted_total);
  const canonicalFail = metrics.map((entry) => entry.canonical_fail_before_first_canonical_green);
  const canonicalUnknown = metrics.map((entry) => entry.canonical_unknown_before_first_canonical_green);
  const verifyCalls = metrics.map((entry) => entry.verify_tool_count);
  const piped = metrics.map((entry) => entry.piped_test_command_count);
  const postValidGreen = metrics.map((entry) => entry.post_valid_full_green_calls);
  const tailReps = weighted.filter((value) => value > TAIL_WEIGHTED_THRESHOLD).length;

  return [
    `## ${label}`,
    "",
    "| Run | Weighted | Calls | W/Call | 1st pass | Canon green @ | Valid full green @ | Canon fail | Canon unk | Verify | Piped | Sidecars | Post-valid-green |",
    "|-----|----------|-------|--------|----------|---------------|--------------------|-----------:|----------:|-------:|------:|---------:|-----------------:|",
    ...metrics.map((entry) => {
      const cells = rowCells(entry);
      return `| ${cells.join(" | ")} |`;
    }),
    "",
    `- Weighted distribution: **${distribution(weighted.map((value) => Math.round(value)))}**`,
    `- Median weighted: **${num(median(weighted))}**`,
    `- Tail rep rate (>${TAIL_WEIGHTED_THRESHOLD / 1000}k): **${tailReps}/${metrics.length}**`,
    `- Median canonical fail before green: **${num(median(canonicalFail))}**`,
    `- Median canonical unknown before green: **${num(median(canonicalUnknown))}**`,
    `- Median verify tool calls: **${num(median(verifyCalls))}**`,
    `- Median piped test commands: **${num(median(piped))}**`,
    `- Median post-valid-full-green calls: **${num(median(postValidGreen))}**`,
    "",
  ];
}

function parseArgs(argv: string[]): string[] {
  const cohorts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--cohort") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --cohort");
      cohorts.push(value);
      index += 1;
      continue;
    }
    if (token === "--help") return [];
    throw new Error(`Unknown argument: ${token}`);
  }
  return cohorts.length > 0 ? cohorts : Object.keys(COHORTS);
}

async function main(): Promise<void> {
  const selected = parseArgs(process.argv.slice(2));
  if (selected.length === 0) {
    console.log(`Usage: npm run analyze:cohort-trajectory -- [--cohort ${Object.keys(COHORTS).join("|")}]`);
    process.exit(0);
  }

  const allMetrics: TrajectoryMetrics[] = [];
  const sections: string[] = [
    "# Trajectory cohort retro-analysis (metrics v2)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  for (const cohortId of selected) {
    const cohort = COHORTS[cohortId];
    if (!cohort) {
      throw new Error(`Unknown cohort: ${cohortId}`);
    }

    const metrics: TrajectoryMetrics[] = [];
    for (const runId of cohort.runIds) {
      const runDirectory = path.join(REPOSITORY_ROOT, "artifacts", "runs", runId);
      const result = await analyzeRun({ repositoryRoot: REPOSITORY_ROOT, runDirectory });
      metrics.push(result.trajectory);
      allMetrics.push(result.trajectory);
      console.log(`analyzed ${runId}`);
    }

    sections.push(...cohortSummary(cohort.label, metrics));
  }

  const outputDirectory = path.join(REPOSITORY_ROOT, "artifacts", "analysis", "trajectory-cohorts");
  await mkdir(outputDirectory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const markdownPath = path.join(outputDirectory, `${stamp}.md`);
  await writeFile(markdownPath, `${sections.join("\n")}\n`, "utf8");

  console.log("");
  console.log(`wrote: ${markdownPath}`);
  console.log(
    `all ${allMetrics.length} runs: median weighted=${num(median(allMetrics.map((entry) => entry.weighted_total)))} median canonical_fail=${num(median(allMetrics.map((entry) => entry.canonical_fail_before_first_canonical_green)))}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
