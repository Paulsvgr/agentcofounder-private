import type { DiagnosisFinding, FindingArea } from "../sensors/types.js";

/** 100-point application readiness map used by sensors + VOI. */
export type RubricPillar = "usability" | "persistence" | "robustness" | "integration" | "maintainability";

export interface QualityRequirement {
  id: string;
  pillar: RubricPillar;
  points: number;
  area: FindingArea | "ux";
  description: string;
  /** Sensor codes that cover this requirement when present/absent. */
  sensor_codes: string[];
}

export const QUALITY_MATRIX: QualityRequirement[] = [
  { id: "nav_labels", pillar: "usability", points: 6, area: "accessibility", description: "Labeled controls / accessible names", sensor_codes: ["missing_live_region"] },
  { id: "validation_ux", pillar: "usability", points: 8, area: "accessibility", description: "Visible validation + aria-invalid", sensor_codes: ["missing_aria_invalid"] },
  { id: "confirm_delete", pillar: "usability", points: 4, area: "ux", description: "Confirm before destructive delete", sensor_codes: ["journey_gap_confirm_delete"] },
  { id: "empty_filter", pillar: "usability", points: 4, area: "journeys", description: "Empty states + meaningful filter", sensor_codes: ["journey_gap_filter"] },
  { id: "stable_inline", pillar: "usability", points: 8, area: "ux", description: "Stable list order on +/- / inline edit", sensor_codes: ["journey_gap_stability"] },
  { id: "refresh", pillar: "persistence", points: 10, area: "persistence", description: "Data survives refresh", sensor_codes: ["journey_gap_persist"] },
  { id: "storage_boundary", pillar: "persistence", points: 6, area: "persistence", description: "localStorage only in repository", sensor_codes: ["missing_storage", "localstorage_in_ui"] },
  { id: "save_feedback", pillar: "persistence", points: 4, area: "persistence", description: "Non-silent save / recovery UX", sensor_codes: ["persistence_feedback_gap"] },
  { id: "invalid_input", pillar: "robustness", points: 6, area: "accessibility", description: "Reject empty/invalid required fields", sensor_codes: ["missing_aria_invalid"] },
  { id: "malformed_or_quota", pillar: "robustness", points: 6, area: "persistence", description: "Malformed storage or save failure path", sensor_codes: ["persistence_feedback_gap"] },
  { id: "domain_module", pillar: "integration", points: 8, area: "architecture", description: "src/domain pure ops", sensor_codes: ["missing_domain", "no_product_tests"] },
  { id: "storage_module", pillar: "integration", points: 7, area: "architecture", description: "src/storage repository", sensor_codes: ["missing_storage"] },
  { id: "components_module", pillar: "maintainability", points: 8, area: "architecture", description: "src/components split", sensor_codes: ["missing_components"] },
  { id: "lean_suite", pillar: "maintainability", points: 7, area: "journeys", description: "High-info ≤10 journeys", sensor_codes: ["suite_too_large"] },
  { id: "product_tests", pillar: "maintainability", points: 8, area: "tests", description: "Passing product tests exist", sensor_codes: ["no_product_tests", "l0_no_tests", "l0_tests_failed"] },
];

export function matrixPointsAtRisk(diagnosis: DiagnosisFinding[]): number {
  const codes = new Set(diagnosis.map((d) => d.code).filter(Boolean) as string[]);
  let points = 0;
  for (const req of QUALITY_MATRIX) {
    if (req.sensor_codes.some((c) => codes.has(c))) points += req.points;
  }
  // Critical test/build failures dominate.
  if (diagnosis.some((d) => d.severity === "critical" && (d.area === "tests" || d.area === "build"))) {
    points = Math.max(points, 40);
  }
  return Math.min(100, points);
}

export function criticalGapExists(diagnosis: DiagnosisFinding[]): boolean {
  return diagnosis.some((d) => d.severity === "critical");
}

export function highValueGapExists(diagnosis: DiagnosisFinding[]): boolean {
  return criticalGapExists(diagnosis) || matrixPointsAtRisk(diagnosis) >= 12;
}
