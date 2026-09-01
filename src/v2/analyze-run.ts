import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCallLedger, type CallLedger } from "./normalize.js";
import { readRunManifestOptional } from "./manifest.js";
import { buildStationReport, renderStationHtml, type StationReport } from "./station.js";
import { readRunResultOptional, enrichVerificationDetails } from "./verification.js";
import { persistReconcileReport, reconcileRunIfPossible } from "./reconcile.js";
import {
  buildTrajectoryMetrics,
  formatTrajectorySummary,
  type TrajectoryMetrics,
} from "./trajectory-metrics.js";

export interface AnalyzeRunPaths {
  outputDirectory: string;
  ledgerPath: string;
  stationJsonPath: string;
  stationHtmlPath: string;
  reconcilePath: string | null;
  trajectoryPath: string;
  trajectoryV2Path: string;
}

export interface AnalyzeRunResult {
  runId: string;
  ledger: CallLedger;
  report: StationReport;
  paths: AnalyzeRunPaths;
  reconciliationOk: boolean;
  officialMissing: boolean;
  trajectory: TrajectoryMetrics;
}

export interface AnalyzeRunOptions {
  repositoryRoot: string;
  runDirectory: string;
  compareRunDirectory?: string;
}

export function resolveRunDirectory(repositoryRoot: string, arg: string): string {
  if (path.isAbsolute(arg)) return arg;
  if (arg.includes("/") || arg.includes("\\")) {
    return path.resolve(repositoryRoot, arg);
  }
  return path.join(repositoryRoot, "artifacts", "runs", arg);
}

export async function analyzeRun(options: AnalyzeRunOptions): Promise<AnalyzeRunResult> {
  const { repositoryRoot, runDirectory } = options;
  const runId = path.basename(runDirectory);
  const analysisDirectory = path.join(repositoryRoot, "artifacts", "analysis");

  const ledger = await buildCallLedger(runDirectory);
  const trajectory = buildTrajectoryMetrics(ledger);
  const manifest = await readRunManifestOptional(runDirectory);
  const runResult = await readRunResultOptional(runDirectory);

  let compareLedger: CallLedger | undefined;
  let compareManifest: Awaited<ReturnType<typeof readRunManifestOptional>> = null;
  if (options.compareRunDirectory) {
    compareLedger = await buildCallLedger(options.compareRunDirectory);
    compareManifest = await readRunManifestOptional(options.compareRunDirectory);
  }

  let report = buildStationReport(ledger, {
    manifest,
    runResult,
    ...(compareLedger === undefined ? {} : { compareLedger, compareManifest }),
  });
  report = {
    ...report,
    verification: await enrichVerificationDetails(runDirectory, report.verification),
  };

  const outputDirectory = path.join(analysisDirectory, runId);
  const paths: AnalyzeRunPaths = {
    outputDirectory,
    ledgerPath: path.join(outputDirectory, "ledger.json"),
    stationJsonPath: path.join(outputDirectory, "station.json"),
    stationHtmlPath: path.join(outputDirectory, "station.html"),
    reconcilePath: null,
    trajectoryPath: path.join(outputDirectory, "trajectory.json"),
    trajectoryV2Path: path.join(outputDirectory, "trajectory.v2.json"),
  };

  await mkdir(outputDirectory, { recursive: true });
  const trajectoryJson = `${JSON.stringify(trajectory, null, 2)}\n`;
  const writeTasks: Promise<void>[] = [
    writeFile(paths.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
    writeFile(paths.stationJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(paths.stationHtmlPath, renderStationHtml(report), "utf8"),
    writeFile(paths.trajectoryPath, trajectoryJson, "utf8"),
    writeFile(paths.trajectoryV2Path, trajectoryJson, "utf8"),
  ];

  const reconcileReport = await reconcileRunIfPossible(runDirectory);
  if (reconcileReport) {
    paths.reconcilePath = await persistReconcileReport(repositoryRoot, reconcileReport);
  }

  await Promise.all(writeTasks);

  return {
    runId,
    ledger,
    report,
    paths,
    reconciliationOk: report.reconciliation_ok,
    officialMissing: ledger.reconciliation.official_missing === true,
    trajectory,
  };
}

export function formatAnalyzeSummary(result: AnalyzeRunResult): string[] {
  const { report, ledger, paths } = result;
  const lines = [
    `run_id: ${report.run_id}`,
    ...(report.compare ? [`compare: ${report.compare.run_id}`] : []),
    `calls: ${report.totals.model_calls}`,
    `weighted_total: ${report.totals.weighted_total.toFixed(0)}`,
    ledger.reconciliation.official_missing
      ? "reconciliation: SKIPPED (no result.json in run directory)"
      : `reconciliation: ${report.reconciliation_ok ? "OK" : "MISMATCH"}`,
    report.manifest
      ? `manifest: ${report.manifest.config_hash.slice(0, 16)}… template=${report.manifest.template.id}`
      : "manifest: (none)",
    `verification: ${report.verification.status} (${report.verification.source}) · journeys ${report.verification.tests_passed}/${report.verification.tests_passed + report.verification.tests_failed} passed · harness ${report.verification.harness_passed}/${report.verification.harness_passed + report.verification.harness_failed} passed`,
  ];

  lines.push(...formatTrajectorySummary(result.trajectory));

  if (report.activity_summary.length > 0) {
    lines.push("activity:");
    for (const bucket of report.activity_summary.slice(0, 6)) {
      lines.push(
        `  ${bucket.activity.padEnd(8)} calls=${String(bucket.call_count).padStart(2)} weighted=${bucket.weighted_cost.toFixed(0)} share=${(bucket.share_of_total * 100).toFixed(1)}%`,
      );
    }
  }

  lines.push(`wrote: ${paths.trajectoryV2Path}`);
  lines.push(`wrote: ${paths.ledgerPath}`);
  lines.push(`wrote: ${paths.stationJsonPath}`);
  lines.push(`wrote: ${paths.stationHtmlPath}`);
  if (paths.reconcilePath) {
    lines.push(`wrote: ${paths.reconcilePath}`);
  }
  return lines;
}

export function analyzeExitCode(result: AnalyzeRunResult): number {
  return result.officialMissing || result.reconciliationOk ? 0 : 1;
}
