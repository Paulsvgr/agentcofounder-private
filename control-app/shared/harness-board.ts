/**
 * Frozen experimental board for Control App launch UI.
 * Source of truth for KEEP / PARKED / OFF — do not invent efficiency claims here.
 */

export type BoardDecision = "KEEP" | "PARKED" | "OFF" | "BASELINE";

export interface HarnessFlagSpec {
  key: string;
  label: string;
  decision: BoardDecision;
  /** Default value when launching (string "0" | "1"). */
  defaultValue: "0" | "1";
  /** When true, shown in New Run as a toggle. */
  launchToggle: boolean;
  note: string;
}

/** Default KEEP stack for new local runs (repair-tail board as of 2026-09-04). */
export const HARNESS_BOARD_FLAGS: HarnessFlagSpec[] = [
  {
    key: "HARNESS_OWNED_VERIFY",
    label: "Harness-owned VERIFY",
    decision: "BASELINE",
    defaultValue: "1",
    launchToggle: true,
    note: "v2.2 baseline — always on for local challenge runs",
  },
  {
    key: "HARNESS_ROOT_ERROR_FIRST_V1",
    label: "Root-error-first",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP — compact root error first on FAIL",
  },
  {
    key: "HARNESS_VERIFY_RTL_EVIDENCE_V1",
    label: "RTL role+name evidence",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP — factual role/name candidates",
  },
  {
    key: "HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1",
    label: "RTL MULTIPLE evidence",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP as reporter fix — Ignored-nodes parse hygiene 2026-09-04 (no (none parsed) placeholder)",
  },
  {
    key: "HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1",
    label: "RTL text-miss evidence",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP — factual reporter + modest same-fail repair-tail win; not a general 26% claim",
  },
  {
    key: "HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1",
    label: "TEST CONTEXT evidence",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "REVERT — Dune seed cheaper (~294k→84k) but product filter auto-switch; test unchanged; default OFF",
  },
  {
    key: "HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1",
    label: "TYPECHECK on VERIFY FAIL",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP CLOSED — factual tsc on FAIL; default ON",
  },
  {
    key: "HARNESS_PRODUCT_QUALITY_CONTRACT_V1",
    label: "Product quality contract",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "REVERT — same rubric score, ~69% more cost; default OFF",
  },
  {
    key: "HARNESS_HARD_STOP_AFTER_GREEN_V1",
    label: "Hard-stop after green",
    decision: "PARKED",
    defaultValue: "0",
    launchToggle: true,
    note: "PARKED — VERIFY-only stop too early; prefer FULL_GREEN_GATE",
  },
  {
    key: "HARNESS_FULL_GREEN_GATE_V1",
    label: "Full-green gate",
    decision: "KEEP",
    defaultValue: "0",
    launchToggle: true,
    note: "KEEP — ship cohort 5/5 OK, median ~81k, post-green 0; prefer default ON for submit",
  },
  {
    key: "HARNESS_REPAIR_SURFACE_LOCK_V1",
    label: "Repair surface lock",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "REVERT — bait: control write src/books.ts was cheap fix; treatment ~58k→104k",
  },
  {
    key: "HARNESS_PRE_GREEN_SINGLE_TEST_V1",
    label: "Pre-green single test",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "REVERT — bait: blocked App.test after books.test latch; ~106k→227k thrash",
  },
  {
    key: "HARNESS_TAIL_SWEEP_V1",
    label: "Tail sweep",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "Orthogonal to hard-stop; leave OFF unless studying it",
  },
  {
    key: "HARNESS_ERROR_MEMORY_V1",
    label: "Error Memory",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "OFF — do not mix with repair-tail work",
  },
  {
    key: "HARNESS_VERIFY_REPAIR_V1",
    label: "Verify repair hints",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "OFF",
  },
  {
    key: "TEMPLATE_PERSISTENCE",
    label: "Template persistence",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP — localStorage persistence overlay",
  },
  {
    key: "TEMPLATE_TAILWIND",
    label: "Template Tailwind",
    decision: "KEEP",
    defaultValue: "1",
    launchToggle: true,
    note: "KEEP",
  },
  {
    key: "TEMPLATE_CSS_VOCABULARY",
    label: "CSS vocabulary",
    decision: "OFF",
    defaultValue: "0",
    launchToggle: true,
    note: "STOPPED / Tailwind KEEP path",
  },
];

export function defaultHarnessEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const flag of HARNESS_BOARD_FLAGS) {
    out[flag.key] = flag.defaultValue;
  }
  return out;
}

export function decisionBadgeClass(decision: BoardDecision): string {
  switch (decision) {
    case "KEEP":
      return "badge-keep";
    case "PARKED":
      return "badge-parked";
    case "OFF":
      return "badge-off";
    case "BASELINE":
      return "badge-baseline";
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}
