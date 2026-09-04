/**
 * Q2-E — harness-owned test structure — filesystem guard core.
 */

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  countAuthoredTestsFromSources,
  isQualifyingTestFile,
} from "./early-verify-core.js";
import { listTestSourcesUnderSrc } from "./test-authoring-scan.js";

export const TEST_STRUCTURE_EXPORT_FILENAME = "test-structure.v1.json";

export const HARNESS_OWNED_TEST_FILE = "src/App.test.tsx";

export const HARNESS_OWNED_TEST_SHELL = `import { describe } from "vitest";

describe("App", () => {
  // Harness-owned shell — add journey tests incrementally (+1 it/test per tool action).
});
`;

export type TestStructureViolationReason =
  | "extra_test_file"
  | "authored_count_decreased"
  | "authored_increment_exceeded";

export type TestFileSnapshot = Record<string, string>;

export interface TestStructureViolation {
  reason: TestStructureViolationReason;
  accepted_count: number;
  observed_count: number;
}

export interface TestStructureRejectionEvent {
  tool_result_index: number;
  violation: TestStructureViolationReason;
  accepted_count: number;
  observed_count: number;
  restored_paths: string[];
}

export interface TestStructureExport {
  schema: "agentcofounder.test_structure.v1";
  skeleton_authored_count_at_start: number;
  first_successful_authored_test_addition_tool_result_index: number | null;
  increment_guard_rejections: number;
  increment_guard_rejection_reasons: Partial<Record<TestStructureViolationReason, number>>;
  max_accepted_single_step_delta: number;
  rejections: TestStructureRejectionEvent[];
  test_structure_error: boolean;
}

export function testStructureV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_OWNED_TEST_STRUCTURE_V1;
  return raw === "1" || raw === "true";
}

export function readQualifyingTestSnapshot(appRoot: string): TestFileSnapshot {
  const snapshot: TestFileSnapshot = {};
  for (const source of listTestSourcesUnderSrc(appRoot)) {
    if (!isQualifyingTestFile(source.relativePath)) continue;
    snapshot[source.relativePath] = source.content;
  }
  return snapshot;
}

export function authoredTestCountInSnapshot(snapshot: TestFileSnapshot): number {
  return countAuthoredTestsFromSources(
    Object.entries(snapshot).map(([relativePath, content]) => ({ relativePath, content })),
  ).authored_test_count;
}

function pathsAreAllowedOnlyAppTest(paths: string[]): boolean {
  return paths.every((relativePath) => relativePath === HARNESS_OWNED_TEST_FILE);
}

export function evaluatePostToolTestStructure(input: {
  lastAcceptedSnapshot: TestFileSnapshot;
  currentSnapshot: TestFileSnapshot;
}): { accepted: true; authored_delta: number } | { accepted: false; violation: TestStructureViolation } {
  const acceptedCount = authoredTestCountInSnapshot(input.lastAcceptedSnapshot);
  const currentPaths = Object.keys(input.currentSnapshot).sort();
  const observedCount = authoredTestCountInSnapshot(input.currentSnapshot);

  if (currentPaths.length > 0 && !pathsAreAllowedOnlyAppTest(currentPaths)) {
    return {
      accepted: false,
      violation: {
        reason: "extra_test_file",
        accepted_count: acceptedCount,
        observed_count: observedCount,
      },
    };
  }

  if (observedCount < acceptedCount) {
    return {
      accepted: false,
      violation: {
        reason: "authored_count_decreased",
        accepted_count: acceptedCount,
        observed_count: observedCount,
      },
    };
  }

  if (observedCount > acceptedCount + 1) {
    return {
      accepted: false,
      violation: {
        reason: "authored_increment_exceeded",
        accepted_count: acceptedCount,
        observed_count: observedCount,
      },
    };
  }

  return { accepted: true, authored_delta: observedCount - acceptedCount };
}

export function restoreQualifyingTestSnapshot(appRoot: string, snapshot: TestFileSnapshot): string[] {
  const restoredPaths: string[] = [];

  for (const [relativePath, content] of Object.entries(snapshot)) {
    const absolute = path.join(appRoot, relativePath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
    restoredPaths.push(relativePath);
  }

  for (const relativePath of Object.keys(readQualifyingTestSnapshot(appRoot))) {
    if (snapshot[relativePath] !== undefined) continue;
    unlinkSync(path.join(appRoot, relativePath));
    restoredPaths.push(relativePath);
  }

  return [...new Set(restoredPaths)].sort();
}

export function formatTestStructureRejectionFeedback(violation: TestStructureViolation): string {
  return [
    "test_structure_v1: rejected",
    `reason: ${violation.reason}`,
    `accepted_authored_count: ${violation.accepted_count}`,
    `observed_authored_count: ${violation.observed_count}`,
    "rule: only src/App.test.tsx; authored tests may increase by +0 or +1 per tool action",
    "action: qualifying test files restored to last accepted snapshot; other changes kept",
  ].join("\n");
}

export function seedHarnessOwnedTestShell(appRoot: string): TestFileSnapshot {
  const absolute = path.join(appRoot, HARNESS_OWNED_TEST_FILE);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, HARNESS_OWNED_TEST_SHELL, "utf8");
  return readQualifyingTestSnapshot(appRoot);
}

export function createEmptyTestStructureExport(
  skeletonAuthoredCount: number,
): TestStructureExport {
  return {
    schema: "agentcofounder.test_structure.v1",
    skeleton_authored_count_at_start: skeletonAuthoredCount,
    first_successful_authored_test_addition_tool_result_index: null,
    increment_guard_rejections: 0,
    increment_guard_rejection_reasons: {},
    max_accepted_single_step_delta: 0,
    rejections: [],
    test_structure_error: false,
  };
}

export function resolveTestStructureExportPath(): string | null {
  const artifactDir = process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  if (!artifactDir) return null;
  return path.join(artifactDir, TEST_STRUCTURE_EXPORT_FILENAME);
}

export function writeTestStructureExport(exportPath: string, payload: TestStructureExport): void {
  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readTestStructureExportFromRun(runDirectory: string): TestStructureExport | null {
  const exportPath = path.join(runDirectory, TEST_STRUCTURE_EXPORT_FILENAME);
  try {
    return JSON.parse(readFileSync(exportPath, "utf8")) as TestStructureExport;
  } catch {
    return null;
  }
}
