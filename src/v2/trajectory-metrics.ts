import { isBuildCommand, isNpmTestCommand } from "./classify.js";
import type { CallLedger, CallLedgerEntry, LedgerTool } from "./normalize.js";
import { isCssPath, isSourceFilePath, isSourceMutationCommand } from "./source-paths.js";

export const TRAJECTORY_METRICS_SCHEMA = "agentcofounder.trajectory_metrics.v2" as const;

const SUITE_SUMMARY = /(?:✅|❌)\s*(PASS|FAIL)\s*(\d+)\/(\d+)/iu;

export type CanonicalOutcome = "pass" | "fail" | "unknown" | null;

export type VerificationSource = "bash" | "verify";

export interface VerificationRunSnapshot {
  call_index: number;
  source: VerificationSource;
  command: string;
  piped: boolean;
  canonical: boolean;
  sidecar: boolean;
  exit_code_trusted: boolean;
  verify_exit_code: number | null;
  passed: number | null;
  total: number | null;
  pass_ratio: number | null;
  suite_error: boolean;
  canonical_outcome: CanonicalOutcome;
  raw_summary: string | null;
}

/** @deprecated Use VerificationRunSnapshot */
export type SuiteRunSnapshot = VerificationRunSnapshot;

export interface TrajectoryMetrics {
  schema: typeof TRAJECTORY_METRICS_SCHEMA;
  run_id: string;
  weighted_total: number;
  model_calls: number;
  weighted_per_call: number | null;

  test_command_count: number;
  piped_test_command_count: number;
  verify_tool_count: number;
  build_command_count: number;
  piped_build_command_count: number;
  canonical_verification_count: number;
  sidecar_verification_count: number;

  first_test_command_call: number | null;
  first_test_pass_ratio: number | null;
  first_any_test_green_call: number | null;
  first_canonical_test_green_call: number | null;
  first_build_green_call: number | null;
  first_valid_full_green_call: number | null;

  canonical_fail_before_first_canonical_green: number;
  canonical_unknown_before_first_canonical_green: number;
  verify_fail_before_first_canonical_green: number;
  verify_unknown_before_first_canonical_green: number;
  weighted_before_first_canonical_verification: number;

  post_any_test_green_calls: number;
  post_valid_full_green_calls: number;

  debug_test_files_created: string[];
  debug_test_run_count: number;
  debug_test_weighted: number;

  persistence_related_reads: number;
  persistence_related_writes: number;
  persistence_related_weighted: number;

  verification_runs: VerificationRunSnapshot[];

  /** @deprecated alias for first_any_test_green_call */
  first_test_green_call: number | null;
  /** @deprecated alias for first_valid_full_green_call */
  first_full_green_call: number | null;
  /** @deprecated alias for post_any_test_green_calls */
  post_test_green_calls: number;
  /** @deprecated alias for post_valid_full_green_calls */
  post_full_green_calls: number;
  /** @deprecated bash-only verification runs */
  suite_runs: VerificationRunSnapshot[];
}

function isPipedCommand(command: string): boolean {
  return /\|\s*(?:tail|grep|head|awk|sed)\b/i.test(command);
}

function isSidecarTestPath(filePath: string): boolean {
  return (
    /\bdbg\d*\.test\./i.test(filePath) ||
    /\bdebug[\w-]*\.test\./i.test(filePath) ||
    /\bselecttest\.test\./i.test(filePath) ||
    /\bprobe\.test\./i.test(filePath) ||
    /\bscratch\.test\./i.test(filePath) ||
    /^\/tmp\/.+\.test\./i.test(filePath)
  );
}

function isSidecarCommand(command: string): boolean {
  if (isSidecarTestPath(command)) return true;
  return /\b(dbg\d*|debug[\w-]*|selecttest|probe|scratch)\.test\./i.test(command);
}

function isFileScopedTestCommand(command: string): boolean {
  if (/\bnpm\s+(?:run\s+)?test\b[^|]*--\s+\S+\.test\./i.test(command)) return true;
  if (/\bvitest\s+run\s+\S+\.test\./i.test(command)) return true;
  if (/\bnpx\s+vitest\s+run\s+\S+\.test\./i.test(command)) return true;
  return false;
}

function isCanonicalFullSuite(source: VerificationSource, command: string): boolean {
  if (source === "verify") return true;
  if (!isNpmTestCommand(command)) return false;
  if (isSidecarCommand(command)) return false;
  if (isFileScopedTestCommand(command)) return false;
  return true;
}

function bashTools(calls: CallLedgerEntry[]): Array<{ call: CallLedgerEntry; tool: LedgerTool }> {
  const matches: Array<{ call: CallLedgerEntry; tool: LedgerTool }> = [];
  for (const call of calls) {
    for (const tool of call.tools) {
      if (tool.name === "bash") matches.push({ call, tool });
    }
  }
  return matches;
}

function verificationTools(
  calls: CallLedgerEntry[],
): Array<{ call: CallLedgerEntry; tool: LedgerTool; source: VerificationSource }> {
  const matches: Array<{ call: CallLedgerEntry; tool: LedgerTool; source: VerificationSource }> = [];
  for (const call of calls) {
    for (const tool of call.tools) {
      if (tool.name === "verify") {
        matches.push({ call, tool, source: "verify" });
        continue;
      }
      if (tool.name === "bash" && isNpmTestCommand(tool.detail)) {
        matches.push({ call, tool, source: "bash" });
      }
    }
  }
  return matches;
}

function truncate(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function parseVerifyExitCode(output: string | null): number | null {
  if (!output) return null;
  const match = output.match(/verify exit_code=(\d+)/i);
  return match?.[1] !== undefined ? Number(match[1]) : null;
}

function parseSuiteSummary(output: string | null): {
  passed: number | null;
  total: number | null;
  pass_ratio: number | null;
  suite_error: boolean;
  raw_summary: string | null;
} {
  if (!output) {
    return {
      passed: null,
      total: null,
      pass_ratio: null,
      suite_error: false,
      raw_summary: null,
    };
  }

  if (/FAIL\s*0\/0|suite did not run|SUITE_ERROR/iu.test(output)) {
    return {
      passed: 0,
      total: 0,
      pass_ratio: null,
      suite_error: true,
      raw_summary: truncate(output),
    };
  }

  const match = output.match(SUITE_SUMMARY);
  if (!match?.[2] || !match[3]) {
    return {
      passed: null,
      total: null,
      pass_ratio: null,
      suite_error: false,
      raw_summary: truncate(output),
    };
  }

  const passed = Number(match[2]);
  const total = Number(match[3]);
  return {
    passed,
    total,
    pass_ratio: total > 0 ? passed / total : null,
    suite_error: false,
    raw_summary: truncate(output),
  };
}

function classifyCanonicalOutcome(
  source: VerificationSource,
  parsed: ReturnType<typeof parseSuiteSummary>,
  verifyExitCode: number | null,
  exitCodeTrusted: boolean,
  toolIsError: boolean,
  canonical: boolean,
): CanonicalOutcome {
  if (!canonical) return null;

  if (parsed.suite_error) return "fail";

  if (source === "verify") {
    if (verifyExitCode !== null && verifyExitCode !== 0) return "fail";
    if (parsed.passed !== null && parsed.total !== null && parsed.total > 0 && parsed.passed === parsed.total) {
      return "pass";
    }
    if (verifyExitCode === 0) return "pass";
    return "unknown";
  }

  if (parsed.passed !== null && parsed.total !== null) {
    if (parsed.total > 0 && parsed.passed === parsed.total) return "pass";
    if (parsed.passed < parsed.total) return "fail";
  }

  if (exitCodeTrusted && toolIsError) return "fail";

  return "unknown";
}

function isParsedPass(snapshot: Pick<VerificationRunSnapshot, "suite_error" | "passed" | "total">): boolean {
  if (snapshot.suite_error) return false;
  if (snapshot.passed === null || snapshot.total === null) return false;
  return snapshot.total > 0 && snapshot.passed === snapshot.total;
}

function isBuildSuccess(output: string | null): boolean {
  if (!output) return false;
  if (/error TS\d+|Failed to compile|Build failed/iu.test(output)) return false;
  return /✓ built in|built in \d+/iu.test(output);
}

const SIDECAR_PATH_IN_TEXT =
  /(?:^|[\s'"`>/])(\S*(?:dbg\d*|debug[\w-]*|selecttest|probe|scratch)\.test\.(?:tsx?|jsx?))/giu;

function sidecarFileBasenamesFromText(text: string): string[] {
  const files = new Set<string>();
  for (const match of text.matchAll(SIDECAR_PATH_IN_TEXT)) {
    const raw = match[1]?.replace(/^['"]|['"]$/gu, "") ?? "";
    if (isSidecarTestPath(raw)) {
      files.add(raw.split("/").pop() ?? raw);
    }
  }
  for (const match of text.matchAll(/(\/tmp\/\S+\.test\.(?:tsx?|jsx?))/giu)) {
    files.add(match[1]!.split("/").pop() ?? match[1]!);
  }
  return [...files];
}

function collectDebugSidecarFiles(calls: CallLedgerEntry[]): string[] {
  const files = new Set<string>();
  for (const call of calls) {
    for (const tool of call.tools) {
      const texts =
        tool.name === "bash"
          ? [tool.detail, ...tool.paths]
          : tool.name === "write" || tool.name === "edit"
            ? [tool.detail, ...tool.paths]
            : [];
      for (const text of texts) {
        for (const basename of sidecarFileBasenamesFromText(text)) {
          files.add(basename);
        }
      }
    }
  }
  return [...files].sort();
}

const PERSISTENCE_PATH =
  /repository|collectionStore|useCollection|memoryStorage|localStorage|bookStore|useBooks|useLibrary|useBookLibrary/iu;

function isPersistencePath(text: string): boolean {
  return PERSISTENCE_PATH.test(text);
}

function persistenceSignals(calls: CallLedgerEntry[]): {
  reads: number;
  writes: number;
  weighted: number;
} {
  let reads = 0;
  let writes = 0;
  let weighted = 0;

  for (const call of calls) {
    let hit = false;
    for (const tool of call.tools) {
      const texts = [tool.detail, ...tool.paths, tool.output ?? ""];
      if (!texts.some(isPersistencePath)) continue;
      hit = true;
      if (tool.name === "read") reads += 1;
      if (tool.name === "write" || tool.name === "edit") writes += 1;
    }
    if (hit) weighted += call.weighted_cost;
  }

  return { reads, writes, weighted };
}

function isProductMutationTool(tool: LedgerTool): boolean {
  if (tool.name !== "write" && tool.name !== "edit") return false;
  for (const filePath of [tool.detail, ...tool.paths]) {
    if (isSidecarTestPath(filePath)) continue;
    if (isSourceFilePath(filePath) || isCssPath(filePath)) return true;
  }
  return false;
}

function callHasProductMutation(call: CallLedgerEntry): boolean {
  for (const tool of call.tools) {
    if (isProductMutationTool(tool)) return true;
    if (tool.name === "bash" && isSourceMutationCommand(tool.detail)) return true;
  }
  return false;
}

function computeFirstValidFullGreen(
  canonicalPasses: number[],
  buildGreens: number[],
  mutationCalls: Set<number>,
): number | null {
  let firstValid: number | null = null;

  for (const testCall of canonicalPasses) {
    for (const buildCall of buildGreens) {
      const start = Math.min(testCall, buildCall);
      const end = Math.max(testCall, buildCall);
      let mutatedBetween = false;
      for (const mutationCall of mutationCalls) {
        if (mutationCall > start && mutationCall < end) {
          mutatedBetween = true;
          break;
        }
      }
      if (mutatedBetween) continue;
      if (firstValid === null || end < firstValid) {
        firstValid = end;
      }
    }
  }

  return firstValid;
}

function weightedBeforeCall(calls: CallLedgerEntry[], callIndex: number): number {
  if (callIndex <= 0) return 0;
  const previous = calls.find((call) => call.index === callIndex - 1);
  return previous?.cumulative_weighted ?? 0;
}

export function buildTrajectoryMetrics(ledger: CallLedger): TrajectoryMetrics {
  const calls = ledger.calls;
  const weightedTotal = calls.length > 0 ? calls[calls.length - 1]!.cumulative_weighted : 0;

  let testCommandCount = 0;
  let pipedTestCommandCount = 0;
  let verifyToolCount = 0;
  let buildCommandCount = 0;
  let pipedBuildCommandCount = 0;
  let canonicalVerificationCount = 0;
  let sidecarVerificationCount = 0;

  const verificationRuns: VerificationRunSnapshot[] = [];
  const suiteRuns: VerificationRunSnapshot[] = [];

  for (const { call, tool, source } of verificationTools(calls)) {
    const command = source === "verify" ? "verify" : tool.detail;
    const piped = source === "bash" ? isPipedCommand(command) : false;
    const sidecar = source === "bash" && isSidecarCommand(command);
    const canonical = isCanonicalFullSuite(source, command);
    const parsed = parseSuiteSummary(tool.output);
    const verifyExitCode = source === "verify" ? parseVerifyExitCode(tool.output) : null;
    const exitCodeTrusted = source === "verify" || (source === "bash" && !piped);
    const canonicalOutcome = classifyCanonicalOutcome(
      source,
      parsed,
      verifyExitCode,
      exitCodeTrusted,
      tool.is_error,
      canonical,
    );

    const snapshot: VerificationRunSnapshot = {
      call_index: call.index,
      source,
      command,
      piped,
      canonical,
      sidecar,
      exit_code_trusted: exitCodeTrusted,
      verify_exit_code: verifyExitCode,
      ...parsed,
      canonical_outcome: canonicalOutcome,
    };

    verificationRuns.push(snapshot);
    if (source === "bash") {
      testCommandCount += 1;
      if (piped) pipedTestCommandCount += 1;
      suiteRuns.push(snapshot);
    } else {
      verifyToolCount += 1;
    }

    if (canonical) canonicalVerificationCount += 1;
    if (sidecar) sidecarVerificationCount += 1;
  }

  for (const { tool } of bashTools(calls)) {
    if (!isBuildCommand(tool.detail)) continue;
    buildCommandCount += 1;
    if (isPipedCommand(tool.detail)) pipedBuildCommandCount += 1;
  }

  const firstBashSuite = suiteRuns[0] ?? null;

  let firstAnyTestGreenCall: number | null = null;
  for (const run of verificationRuns) {
    if (run.canonical_outcome === "pass" || (!run.canonical && isParsedPass(run))) {
      firstAnyTestGreenCall = run.call_index;
      break;
    }
  }

  let firstCanonicalTestGreenCall: number | null = null;
  for (const run of verificationRuns) {
    if (run.canonical && run.canonical_outcome === "pass") {
      firstCanonicalTestGreenCall = run.call_index;
      break;
    }
  }

  let firstBuildGreenCall: number | null = null;
  for (const { call, tool } of bashTools(calls)) {
    if (!isBuildCommand(tool.detail)) continue;
    if (isBuildSuccess(tool.output)) {
      firstBuildGreenCall = call.index;
      break;
    }
  }

  const mutationCalls = new Set<number>();
  for (const call of calls) {
    if (callHasProductMutation(call)) mutationCalls.add(call.index);
  }

  const canonicalPasses = verificationRuns
    .filter((run) => run.canonical && run.canonical_outcome === "pass")
    .map((run) => run.call_index);
  const buildGreens: number[] = [];
  for (const { call, tool } of bashTools(calls)) {
    if (!isBuildCommand(tool.detail)) continue;
    if (isBuildSuccess(tool.output)) buildGreens.push(call.index);
  }

  const firstValidFullGreenCall = computeFirstValidFullGreen(canonicalPasses, buildGreens, mutationCalls);

  let firstCanonicalVerificationCall: number | null = null;
  for (const run of verificationRuns) {
    if (run.canonical) {
      firstCanonicalVerificationCall = run.call_index;
      break;
    }
  }

  let canonicalFailBefore = 0;
  let canonicalUnknownBefore = 0;
  let verifyFailBefore = 0;
  let verifyUnknownBefore = 0;

  if (firstCanonicalTestGreenCall !== null) {
    for (const run of verificationRuns) {
      if (run.call_index >= firstCanonicalTestGreenCall) break;
      if (!run.canonical) continue;
      if (run.canonical_outcome === "fail") canonicalFailBefore += 1;
      if (run.canonical_outcome === "unknown") canonicalUnknownBefore += 1;
      if (run.source === "verify" && run.canonical_outcome === "fail") verifyFailBefore += 1;
      if (run.source === "verify" && run.canonical_outcome === "unknown") verifyUnknownBefore += 1;
    }
  }

  const weightedBeforeFirstCanonicalVerification =
    firstCanonicalVerificationCall === null
      ? weightedTotal
      : weightedBeforeCall(calls, firstCanonicalVerificationCall);

  const postAnyTestGreenCalls =
    firstAnyTestGreenCall === null
      ? 0
      : calls.filter((call) => call.index > firstAnyTestGreenCall).length;

  const postValidFullGreenCalls =
    firstValidFullGreenCall === null
      ? 0
      : calls.filter((call) => call.index > firstValidFullGreenCall).length;

  const debugFiles = collectDebugSidecarFiles(calls);
  let debugTestRunCount = 0;
  let debugTestWeighted = 0;
  for (const { call, tool } of bashTools(calls)) {
    if (!isNpmTestCommand(tool.detail)) continue;
    if (isSidecarCommand(tool.detail)) {
      debugTestRunCount += 1;
      debugTestWeighted += call.weighted_cost;
    }
  }

  const persistence = persistenceSignals(calls);

  return {
    schema: TRAJECTORY_METRICS_SCHEMA,
    run_id: ledger.run_id,
    weighted_total: weightedTotal,
    model_calls: calls.length,
    weighted_per_call: calls.length > 0 ? weightedTotal / calls.length : null,

    test_command_count: testCommandCount,
    piped_test_command_count: pipedTestCommandCount,
    verify_tool_count: verifyToolCount,
    build_command_count: buildCommandCount,
    piped_build_command_count: pipedBuildCommandCount,
    canonical_verification_count: canonicalVerificationCount,
    sidecar_verification_count: sidecarVerificationCount,

    first_test_command_call: firstBashSuite?.call_index ?? verificationRuns[0]?.call_index ?? null,
    first_test_pass_ratio: firstBashSuite?.pass_ratio ?? verificationRuns[0]?.pass_ratio ?? null,
    first_any_test_green_call: firstAnyTestGreenCall,
    first_canonical_test_green_call: firstCanonicalTestGreenCall,
    first_build_green_call: firstBuildGreenCall,
    first_valid_full_green_call: firstValidFullGreenCall,

    canonical_fail_before_first_canonical_green: canonicalFailBefore,
    canonical_unknown_before_first_canonical_green: canonicalUnknownBefore,
    verify_fail_before_first_canonical_green: verifyFailBefore,
    verify_unknown_before_first_canonical_green: verifyUnknownBefore,
    weighted_before_first_canonical_verification: weightedBeforeFirstCanonicalVerification,

    post_any_test_green_calls: postAnyTestGreenCalls,
    post_valid_full_green_calls: postValidFullGreenCalls,

    debug_test_files_created: debugFiles,
    debug_test_run_count: debugTestRunCount,
    debug_test_weighted: debugTestWeighted,

    persistence_related_reads: persistence.reads,
    persistence_related_writes: persistence.writes,
    persistence_related_weighted: persistence.weighted,

    verification_runs: verificationRuns,

    first_test_green_call: firstAnyTestGreenCall,
    first_full_green_call: firstValidFullGreenCall,
    post_test_green_calls: postAnyTestGreenCalls,
    post_full_green_calls: postValidFullGreenCalls,
    suite_runs: suiteRuns,
  };
}

export function formatTrajectorySummary(metrics: TrajectoryMetrics): string[] {
  const ratio =
    metrics.first_test_pass_ratio === null
      ? "—"
      : `${(metrics.first_test_pass_ratio * 100).toFixed(0)}%`;
  return [
    `trajectory: first_test_pass=${ratio} first_canonical_green@${metrics.first_canonical_test_green_call ?? "—"} first_valid_full_green@${metrics.first_valid_full_green_call ?? "—"}`,
    `trajectory: canonical_fail_before_green=${metrics.canonical_fail_before_first_canonical_green} unknown=${metrics.canonical_unknown_before_first_canonical_green} verify=${metrics.verify_tool_count} piped=${metrics.piped_test_command_count}`,
    `trajectory: tests=${metrics.test_command_count} sidecars=${metrics.debug_test_files_created.length} post_valid_full_green=${metrics.post_valid_full_green_calls}`,
  ];
}
