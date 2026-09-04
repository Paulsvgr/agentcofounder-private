import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceObservation } from "../milestone-ralph/observe.js";
import type { DiagnosisFinding, SensorContext, SensorFinding } from "./types.js";

export type { DiagnosisFinding, FindingArea, FindingSeverity, SensorContext, SensorFinding } from "./types.js";

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function architectureSensor(ctx: SensorContext): SensorFinding[] {
  const seedLike =
    /Welcome to the challenge starter|export default function App\(\) \{\s*return \(\s*<main/i.test(
      ctx.appTsxSnippet,
    ) || ctx.appTsxSnippet.trim().length < 80;

  if (ctx.productTestFiles.length === 0) {
    return [
      {
        sensor: "architecture",
        severity: "critical",
        area: "architecture",
        evidence: seedLike
          ? "No product tests; App.tsx still looks like the seed"
          : "No product tests under src/**/*.test.ts(x)",
        files: ["src/App.tsx"],
        recommended_action: "Replace seed with modular app and add 8–10 UI journey tests",
        code: "no_product_tests",
      },
    ];
  }

  const findings: SensorFinding[] = [];
  if (!ctx.hasDomainModule) {
    findings.push({
      sensor: "architecture",
      severity: "high",
      area: "architecture",
      evidence: "Missing src/domain/ (or domain module)",
      files: [],
      recommended_action: "Extract types and pure operations into src/domain/",
      code: "missing_domain",
    });
  }
  if (!ctx.hasStorageModule) {
    findings.push({
      sensor: "architecture",
      severity: "high",
      area: "architecture",
      evidence: "Missing src/storage/ repository module",
      files: [],
      recommended_action: "Move localStorage load/save into src/storage/*Repository",
      code: "missing_storage",
    });
  }
  if (!ctx.hasComponentModules) {
    findings.push({
      sensor: "architecture",
      severity: "medium",
      area: "architecture",
      evidence: "Missing src/components/",
      files: ["src/App.tsx"],
      recommended_action: "Split focused UI into src/components/",
      code: "missing_components",
    });
  }
  return findings;
}

function testStatusSensor(ctx: SensorContext): SensorFinding[] {
  if (!ctx.lastL0Summary) return [];
  if (ctx.lastL0Passed === true) return [];
  const summary = ctx.lastL0Summary;
  if (/at least one completed test|no product tests|passWithNoTests/i.test(summary)) {
    return [
      {
        sensor: "test_status",
        severity: "critical",
        area: "tests",
        evidence: "L0 reports missing or empty product tests",
        files: ctx.productTestFiles.slice(0, 5),
        recommended_action: "Add passing src/**/*.test.tsx journey tests covering implied flows",
        code: "l0_no_tests",
      },
    ];
  }
  if (/vitest|failed/i.test(summary)) {
    return [
      {
        sensor: "test_status",
        severity: "critical",
        area: "tests",
        evidence: truncate(summary, 320),
        files: ctx.productTestFiles.slice(0, 8),
        recommended_action: "Repair failing Vitest journeys named in L0; see artifact pointer",
        code: "l0_tests_failed",
      },
    ];
  }
  return [];
}

function buildSensor(ctx: SensorContext): SensorFinding[] {
  if (!ctx.lastL0Summary || ctx.lastL0Passed !== false) return [];
  if (!/build.*failed|npm run build/i.test(ctx.lastL0Summary)) return [];
  return [
    {
      sensor: "build",
      severity: "critical",
      area: "build",
      evidence: truncate(ctx.lastL0Summary, 280),
      files: [],
      recommended_action: "Fix TypeScript/build errors until npm run build passes",
      code: "l0_build_failed",
    },
  ];
}

function journeyCoverageSensor(ctx: SensorContext): SensorFinding[] {
  if (ctx.productTestFiles.length === 0) return [];
  const sample = `${ctx.sourceTextSample}\n${ctx.implementedFeatures.join(" ")}`.toLowerCase();
  const findings: SensorFinding[] = [];
  const checks: Array<{ key: string; re: RegExp; action: string }> = [
    { key: "persist", re: /localstorage|persist|refresh/, action: "Add/verify refresh persistence journey" },
    { key: "filter", re: /filter|type|category/, action: "Add/verify category filter journey" },
    { key: "validation", re: /aria-invalid|required|validation/, action: "Add visible validation + aria-invalid journey" },
    { key: "confirm_delete", re: /confirm|window\.confirm/, action: "Confirm before delete and cover in a journey" },
    { key: "stability", re: /\+\/-|increment|decrement|stable order|interaction-stability/, action: "Cover +/- or inline edit with stable row order" },
  ];
  for (const check of checks) {
    if (!check.re.test(sample)) {
      findings.push({
        sensor: "journey_coverage",
        severity: "medium",
        area: "journeys",
        evidence: `No clear signal for '${check.key}' in sampled sources/features`,
        files: ctx.productTestFiles.slice(0, 4),
        recommended_action: check.action,
        code: `journey_gap_${check.key}`,
      });
    }
  }
  if (ctx.productTestFiles.length > 10) {
    findings.push({
      sensor: "journey_coverage",
      severity: "medium",
      area: "journeys",
      evidence: `${ctx.productTestFiles.length} product test files — over soft max 10 journeys`,
      files: ctx.productTestFiles,
      recommended_action: "Collapse to ≤10 combined UI journeys; drop domain/repo unit suites",
      code: "suite_too_large",
    });
  }
  return findings;
}

function persistenceSensor(ctx: SensorContext): SensorFinding[] {
  const text = ctx.sourceTextSample;
  const usesStorage = /localStorage/.test(text);
  const findings: SensorFinding[] = [];
  if (usesStorage && /localStorage/.test(ctx.appTsxSnippet) && !ctx.hasStorageModule) {
    findings.push({
      sensor: "persistence",
      severity: "high",
      area: "persistence",
      evidence: "localStorage referenced outside a storage repository module",
      files: ["src/App.tsx"],
      recommended_action: "Confine localStorage to src/storage/*Repository",
      code: "localstorage_in_ui",
    });
  }
  if (usesStorage && !/catch\s*\(/.test(text) && !/QuotaExceeded|save failed|persist/i.test(text)) {
    findings.push({
      sensor: "persistence",
      severity: "medium",
      area: "persistence",
      evidence: "Persistence present but no clear save-failure / recovery UX signal",
      files: [],
      recommended_action: "Surface save/quota failures or malformed JSON recovery in UI + one test",
      code: "persistence_feedback_gap",
    });
  }
  return findings;
}

function accessibilitySensor(ctx: SensorContext): SensorFinding[] {
  if (ctx.productTestFiles.length === 0) return [];
  const text = ctx.sourceTextSample;
  const findings: SensorFinding[] = [];
  if (!/aria-invalid/.test(text)) {
    findings.push({
      sensor: "accessibility",
      severity: "high",
      area: "accessibility",
      evidence: "No aria-invalid usage detected in sampled sources",
      files: [],
      recommended_action: "Mark invalid fields with aria-invalid and announce errors (alert/live)",
      code: "missing_aria_invalid",
    });
  }
  if (!/aria-live|role=["']alert["']/.test(text)) {
    findings.push({
      sensor: "accessibility",
      severity: "medium",
      area: "accessibility",
      evidence: "No role=alert / aria-live announcements detected",
      files: [],
      recommended_action: "Announce validation/persistence errors with role=alert or aria-live",
      code: "missing_live_region",
    });
  }
  return findings;
}

function dependencySensor(ctx: SensorContext): SensorFinding[] {
  if (/from ["'](?!\.|@\/)/.test(ctx.sourceTextSample) && /npm install|pnpm add|yarn add/.test(ctx.sourceTextSample)) {
    return [
      {
        sensor: "dependencies",
        severity: "high",
        area: "dependencies",
        evidence: "Sources mention adding packages; lockfile-only policy applies",
        files: [],
        recommended_action: "Remove new dependencies; use lockfile-installed packages only",
        code: "dependency_policy",
      },
    ];
  }
  return [];
}

function repeatedFailureSensor(ctx: SensorContext): SensorFinding[] {
  const counts = new Map<string, number>();
  for (const fp of ctx.recentFailureFingerprints) {
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  const findings: SensorFinding[] = [];
  for (const [fp, count] of counts) {
    if (count < 2) continue;
    findings.push({
      sensor: "repeated_failure",
      severity: "high",
      area: "repeated_failure",
      evidence: `Fingerprint repeated ${count}×: ${truncate(fp, 160)}`,
      files: [],
      recommended_action: "Stop repeating the same fix; change approach or address root cause named in L0",
      code: "repeated_failure",
    });
  }
  return findings;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function diagnoseFindings(findings: SensorFinding[]): DiagnosisFinding[] {
  return [...findings]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, 12)
    .map((f) => ({
      severity: f.severity,
      area: f.area,
      evidence: f.evidence,
      files: f.files,
      recommended_action: f.recommended_action,
      sensor: f.sensor,
      ...(f.code ? { code: f.code } : {}),
    }));
}

export async function buildSensorContext(
  appDirectory: string,
  observation: WorkspaceObservation,
  options: {
    lastL0Summary: string | null;
    lastL0Passed: boolean | null;
    recentFailureFingerprints: string[];
  },
): Promise<SensorContext> {
  let appTsxSnippet = "";
  try {
    appTsxSnippet = await readFile(path.join(appDirectory, "src", "App.tsx"), "utf8");
  } catch {
    appTsxSnippet = "";
  }

  const sampleFiles = observation.sourceFiles
    .filter((f) => f.startsWith("src/") && !f.includes("node_modules"))
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .slice(0, 24);

  const chunks: string[] = [appTsxSnippet.slice(0, 4000)];
  for (const relative of sampleFiles) {
    try {
      const text = await readFile(path.join(appDirectory, relative), "utf8");
      chunks.push(text.slice(0, 1500));
    } catch {
      // skip unreadable
    }
  }

  return {
    appDirectory,
    sourceFiles: observation.sourceFiles,
    productTestFiles: observation.productTestFiles,
    hasDomainModule: observation.hasDomainModule,
    hasStorageModule: observation.hasStorageModule,
    hasComponentModules: observation.hasComponentModules,
    reportStatus: observation.reportStatus,
    implementedFeatures: observation.implementedFeatures,
    lastL0Summary: options.lastL0Summary,
    lastL0Passed: options.lastL0Passed,
    recentFailureFingerprints: options.recentFailureFingerprints,
    appTsxSnippet: appTsxSnippet.slice(0, 8000),
    sourceTextSample: chunks.join("\n").slice(0, 60_000),
  };
}

export async function runSensors(ctx: SensorContext): Promise<SensorFinding[]> {
  return [
    ...architectureSensor(ctx),
    ...testStatusSensor(ctx),
    ...buildSensor(ctx),
    ...journeyCoverageSensor(ctx),
    ...persistenceSensor(ctx),
    ...accessibilitySensor(ctx),
    ...dependencySensor(ctx),
    ...repeatedFailureSensor(ctx),
  ];
}

export async function observeAndDiagnose(
  appDirectory: string,
  observation: WorkspaceObservation,
  options: {
    lastL0Summary: string | null;
    lastL0Passed: boolean | null;
    recentFailureFingerprints: string[];
  },
): Promise<{ findings: SensorFinding[]; diagnosis: DiagnosisFinding[]; sensorContext: SensorContext }> {
  const sensorContext = await buildSensorContext(appDirectory, observation, options);
  const findings = await runSensors(sensorContext);
  return { findings, diagnosis: diagnoseFindings(findings), sensorContext };
}
