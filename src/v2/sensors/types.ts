export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type FindingArea =
  | "tests"
  | "build"
  | "journeys"
  | "architecture"
  | "persistence"
  | "accessibility"
  | "dependencies"
  | "repeated_failure"
  | "ux";

export interface SensorFinding {
  sensor: string;
  severity: FindingSeverity;
  area: FindingArea;
  evidence: string;
  files: string[];
  recommended_action: string;
  code?: string;
}

export interface DiagnosisFinding {
  severity: FindingSeverity;
  area: FindingArea;
  evidence: string;
  files: string[];
  recommended_action: string;
  sensor: string;
  code?: string;
}

export interface SensorContext {
  appDirectory: string;
  sourceFiles: string[];
  productTestFiles: string[];
  hasDomainModule: boolean;
  hasStorageModule: boolean;
  hasComponentModules: boolean;
  reportStatus: "success" | "partial" | "failed" | null;
  implementedFeatures: string[];
  lastL0Summary: string | null;
  lastL0Passed: boolean | null;
  recentFailureFingerprints: string[];
  appTsxSnippet: string;
  sourceTextSample: string;
}
