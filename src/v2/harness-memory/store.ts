import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const HARNESS_MEMORY_DIRNAME = "harness-memory";

export interface MemoryRule {
  id: string;
  rule: string;
  category: "failure" | "strategy" | "architecture" | "quality" | "behavior";
  confidence: number;
  evidence_runs: string[];
  created_at: string;
  updated_at: string;
  enabled: boolean;
  expires_at: string | null;
  provenance: string;
}

export interface MemoryFile {
  schema: string;
  updated_at: string;
  rules: MemoryRule[];
}

const EMPTY = (schema: string): MemoryFile => ({
  schema,
  updated_at: new Date().toISOString(),
  rules: [],
});

async function readMemoryFile(filePath: string, schema: string): Promise<MemoryFile> {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as MemoryFile;
    if (!raw || !Array.isArray(raw.rules)) return EMPTY(schema);
    return raw;
  } catch {
    return EMPTY(schema);
  }
}

async function writeMemoryFile(filePath: string, data: MemoryFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function harnessMemoryRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, HARNESS_MEMORY_DIRNAME);
}

export async function ensureHarnessMemory(repositoryRoot: string): Promise<void> {
  const root = harnessMemoryRoot(repositoryRoot);
  const files: Array<[string, string]> = [
    ["patterns.json", "agentcofounder.harness_memory.patterns.v1"],
    ["failure-patterns.json", "agentcofounder.harness_memory.failures.v1"],
    ["successful-strategies.json", "agentcofounder.harness_memory.strategies.v1"],
    ["quality-rules.json", "agentcofounder.harness_memory.quality.v1"],
  ];
  await mkdir(root, { recursive: true });
  for (const [name, schema] of files) {
    const filePath = path.join(root, name);
    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeMemoryFile(filePath, EMPTY(schema));
    }
  }
}

export async function loadEnabledMemoryRules(repositoryRoot: string): Promise<string[]> {
  await ensureHarnessMemory(repositoryRoot);
  const root = harnessMemoryRoot(repositoryRoot);
  const files = ["patterns.json", "failure-patterns.json", "successful-strategies.json", "quality-rules.json"];
  const now = Date.now();
  const rules: MemoryRule[] = [];
  for (const name of files) {
    const data = await readMemoryFile(path.join(root, name), "x");
    for (const rule of data.rules) {
      if (!rule.enabled) continue;
      if (rule.expires_at && Date.parse(rule.expires_at) < now) continue;
      if (rule.confidence < 0.5) continue;
      rules.push(rule);
    }
  }
  rules.sort((a, b) => b.confidence - a.confidence);
  return rules.slice(0, 12).map((r) => r.rule);
}

export async function promoteRunIntoMemory(input: {
  repositoryRoot: string;
  runId: string;
  diagnosisCodes: string[];
  l0Passed: boolean;
  productTestCount: number;
  stopReason: string | null;
}): Promise<{ promoted: number }> {
  await ensureHarnessMemory(input.repositoryRoot);
  const root = harnessMemoryRoot(input.repositoryRoot);
  const failuresPath = path.join(root, "failure-patterns.json");
  const strategiesPath = path.join(root, "successful-strategies.json");
  const qualityPath = path.join(root, "quality-rules.json");
  const failures = await readMemoryFile(failuresPath, "agentcofounder.harness_memory.failures.v1");
  const strategies = await readMemoryFile(strategiesPath, "agentcofounder.harness_memory.strategies.v1");
  const quality = await readMemoryFile(qualityPath, "agentcofounder.harness_memory.quality.v1");

  let promoted = 0;
  const now = new Date().toISOString();

  const bump = (file: MemoryFile, id: string, rule: string, category: MemoryRule["category"], confDelta = 0.25) => {
    const existing = file.rules.find((r) => r.id === id);
    if (existing) {
      if (!existing.evidence_runs.includes(input.runId)) existing.evidence_runs.push(input.runId);
      existing.confidence = Math.min(1, existing.confidence + confDelta);
      existing.updated_at = now;
      existing.enabled = existing.evidence_runs.length >= 2 || existing.confidence >= 0.75;
      if (existing.enabled) promoted += 1;
      return;
    }
    file.rules.push({
      id,
      rule,
      category,
      confidence: confDelta,
      evidence_runs: [input.runId],
      created_at: now,
      updated_at: now,
      enabled: false,
      expires_at: null,
      provenance: `run:${input.runId}`,
    });
  };

  for (const code of input.diagnosisCodes) {
    if (code === "no_product_tests" || code === "l0_no_tests") {
      bump(failures, "fail.no_product_tests", "Prefer writing product tests before polish; seed App must be replaced in implement_core.", "failure");
    }
    if (code === "missing_storage" || code === "localstorage_in_ui") {
      bump(
        quality,
        "quality.storage_boundary",
        "Establish src/storage repository before expanding UI; never call localStorage from components.",
        "architecture",
        0.3,
      );
    }
    if (code === "missing_aria_invalid") {
      bump(quality, "quality.aria_invalid", "Add aria-invalid + visible validation in the same slice as the form.", "quality");
    }
    if (code === "repeated_failure") {
      bump(failures, "fail.repeated", "On repeated identical L0 failure, change approach; do not re-read the whole tree.", "behavior", 0.35);
    }
  }

  if (input.l0Passed && input.productTestCount > 0 && input.productTestCount <= 10) {
    bump(
      strategies,
      "strategy.lean_suite",
      "Successful runs stayed ≤10 UI journeys with modular domain/storage/components.",
      "strategy",
      0.2,
    );
  }

  if (input.stopReason === "voi_below_threshold" || input.stopReason === "l0_green_no_critical_gaps") {
    bump(strategies, "strategy.early_stop", "Stop when L0 is green and VOI of another slice is low — avoid polish loops.", "strategy", 0.2);
  }

  failures.updated_at = now;
  strategies.updated_at = now;
  quality.updated_at = now;
  await writeMemoryFile(failuresPath, failures);
  await writeMemoryFile(strategiesPath, strategies);
  await writeMemoryFile(qualityPath, quality);
  return { promoted };
}
