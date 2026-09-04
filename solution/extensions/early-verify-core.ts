/**
 * Q2-D early VERIFY — filesystem mutation detection and source-derived metrics.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatVerifySourcePrefix, runCanonicalVerify } from "./canonical-verify.js";
import { formatVerifyToolOutput, verifyRepairV1EnabledFromEnvironment } from "./verify-failure-format.js";
import { extractTestBlocks, listTestSourcesUnderSrc } from "./test-authoring-scan.js";

export const EARLY_VERIFY_EXPORT_FILENAME = "early-verify.v1.json";

export function earlyVerifyV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_EARLY_VERIFY_V1;
  return raw === "1" || raw === "true";
}

export function isQualifyingTestFile(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized.startsWith("src/") &&
    (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx"))
  );
}

export type TestFileHashSnapshot = Record<string, string>;

export function hashFileContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function snapshotQualifyingTestFileHashes(appRoot: string): TestFileHashSnapshot {
  const snapshot: TestFileHashSnapshot = {};
  for (const source of listTestSourcesUnderSrc(appRoot)) {
    snapshot[source.relativePath] = hashFileContent(source.content);
  }
  return snapshot;
}

export interface FilesystemMutationDetection {
  mutatedPaths: string[];
  isFirstMutation: boolean;
}

export function detectFilesystemTestMutation(input: {
  baseline: TestFileHashSnapshot;
  previous: TestFileHashSnapshot | null;
  current: TestFileHashSnapshot;
  firstMutationAlreadyRecorded: boolean;
}): FilesystemMutationDetection {
  const mutatedPaths = new Set<string>();

  for (const [relativePath, contentHash] of Object.entries(input.current)) {
    if (!isQualifyingTestFile(relativePath)) continue;
    const baselineHash = input.baseline[relativePath];
    if (baselineHash === undefined) {
      mutatedPaths.add(relativePath);
      continue;
    }
    if (baselineHash !== contentHash) {
      mutatedPaths.add(relativePath);
      continue;
    }
    const previousHash = input.previous?.[relativePath];
    if (input.previous && previousHash !== undefined && previousHash !== contentHash) {
      mutatedPaths.add(relativePath);
    }
  }

  const sorted = [...mutatedPaths].sort();
  return {
    mutatedPaths: sorted,
    isFirstMutation: !input.firstMutationAlreadyRecorded && sorted.length > 0,
  };
}

export interface AuthoredTestMetrics {
  authored_test_count: number;
  test_loc: number;
}

export function countAuthoredTestsFromSources(
  sources: Array<{ relativePath: string; content: string }>,
): AuthoredTestMetrics {
  let authored_test_count = 0;
  let test_loc = 0;
  for (const source of sources) {
    if (!isQualifyingTestFile(source.relativePath)) continue;
    authored_test_count += extractTestBlocks(source.content).length;
    test_loc += source.content.split("\n").length;
  }
  return { authored_test_count, test_loc };
}

export function countAuthoredTestsInApp(appRoot: string): AuthoredTestMetrics {
  return countAuthoredTestsFromSources(listTestSourcesUnderSrc(appRoot));
}

export function formatAutoEarlyVerifyOutput(exitCode: number, reporterOutput: string): string {
  const body = formatVerifyToolOutput(exitCode, reporterOutput, verifyRepairV1EnabledFromEnvironment());
  return `${formatVerifySourcePrefix("auto_early_v1")}\n${body}`;
}

export interface EarlyVerifyAutoEvent {
  verify_source: "auto_early_v1";
  tool_result_index: number;
  mutated_paths: string[];
  authored_test_count_at_mutation: number;
  test_loc_at_mutation: number;
  exit_code: number;
  output: string;
  error: string | null;
}

export interface EarlyVerifyExport {
  schema: "agentcofounder.early_verify.v1";
  auto_early_verify_fired: boolean;
  first_test_mutation_tool_result_index: number | null;
  first_test_mutation_paths: string[];
  auto_early_verify: EarlyVerifyAutoEvent | null;
  early_verify_error: boolean;
}

export function createEmptyEarlyVerifyExport(): EarlyVerifyExport {
  return {
    schema: "agentcofounder.early_verify.v1",
    auto_early_verify_fired: false,
    first_test_mutation_tool_result_index: null,
    first_test_mutation_paths: [],
    auto_early_verify: null,
    early_verify_error: false,
  };
}

export function resolveEarlyVerifyExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, EARLY_VERIFY_EXPORT_FILENAME);
}

export function writeEarlyVerifyExport(exportPath: string, payload: EarlyVerifyExport): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function runAutoEarlyCanonicalVerify(appRoot: string): {
  exitCode: number;
  output: string;
  formatted: string;
} {
  const { exitCode, output } = runCanonicalVerify(appRoot);
  return {
    exitCode,
    output,
    formatted: formatAutoEarlyVerifyOutput(exitCode, output),
  };
}

export function readEarlyVerifyExportFromRun(runDirectory: string): EarlyVerifyExport | null {
  const exportPath = path.join(runDirectory, EARLY_VERIFY_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as EarlyVerifyExport;
  } catch {
    return null;
  }
}
