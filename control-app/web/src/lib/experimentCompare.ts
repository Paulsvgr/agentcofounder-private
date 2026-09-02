/** Curated run sets for side-by-side action-flow comparison. */

export const STUDY_COMPARE: { label: string; run_id: string; notes: string }[] = [
  {
    label: "A-baseline-1",
    run_id: "2026-08-21T17-12-43-573Z",
    notes: "test-infra repair",
  },
  {
    label: "A-autotest-1 (floor)",
    run_id: "2026-08-21T17-41-28-455Z",
    notes: "clean trajectory ~54k",
  },
  {
    label: "A-prompt-3 (snowball)",
    run_id: "2026-08-21T17-33-44-063Z",
    notes: "~187k repair+verify tax",
  },
  {
    label: "autoverify-gated",
    run_id: "2026-08-22T00-48-30-278Z",
    notes: "harness tax, no in-session green",
  },
  {
    label: "autoverify-supplement",
    run_id: "2026-08-22T00-16-51-819Z",
    notes: "snowball ~182k",
  },
  {
    label: "A-prime timeout",
    run_id: "2026-08-20T19-13-05-181Z",
    notes: "mega-call + latency",
  },
  {
    label: "A-prime-zai",
    run_id: "2026-08-20T21-51-00-219Z",
    notes: "recoverable repair",
  },
];

/** Experiment 1 — RTL cleanup (5 control + 5 treatment at BASE_SHA). */
export const EXP1_RTL_COMPARE: { label: string; run_id: string; notes: string }[] = [
  {
    label: "rtl-control-1",
    run_id: "2026-08-22T11-17-34-089Z",
    notes: "snowball · ~69k · repair 5",
  },
  {
    label: "rtl-control-2",
    run_id: "2026-08-22T11-20-53-365Z",
    notes: "snowball · ~76k · repair 12",
  },
  {
    label: "rtl-control-3",
    run_id: "2026-08-22T11-24-02-704Z",
    notes: "snowball · ~96k · repair 10",
  },
  {
    label: "rtl-control-4",
    run_id: "2026-08-22T11-28-00-137Z",
    notes: "snowball · ~157k · repair 20",
  },
  {
    label: "rtl-control-5",
    run_id: "2026-08-22T11-33-28-491Z",
    notes: "snowball · ~144k · repair 25",
  },
  {
    label: "rtl-cleanup-1",
    run_id: "2026-08-22T11-39-27-224Z",
    notes: "snowball · ~101k · treatment",
  },
  {
    label: "rtl-cleanup-2",
    run_id: "2026-08-22T11-43-19-823Z",
    notes: "snowball · ~181k · repair 29",
  },
  {
    label: "rtl-cleanup-3",
    run_id: "2026-08-22T11-49-46-658Z",
    notes: "snowball · ~179k · repair 13",
  },
  {
    label: "rtl-cleanup-4",
    run_id: "2026-08-22T11-56-19-753Z",
    notes: "snowball · ~96k · treatment",
  },
  {
    label: "rtl-cleanup-5",
    run_id: "2026-08-22T12-00-02-941Z",
    notes: "snowball · ~183k · repair 14",
  },
];

export type ExperimentComparePreset = "study" | "exp1-rtl";

export const EXPERIMENT_COMPARE_PRESETS: Record<
  ExperimentComparePreset,
  { title: string; description: string; entries: typeof STUDY_COMPARE }
> = {
  study: {
    title: "7-run baseline study",
    description:
      "Baseline, auto-test floor, snowball runs, and prime/autoverify arms. Highlighted: repair loop + extra verify.",
    entries: STUDY_COMPARE,
  },
  "exp1-rtl": {
    title: "Experiment 1 — RTL cleanup",
    description:
      "Matched 5+5 at BASE_SHA. Verdict: KEEP cleanup; mechanism counter inconclusive (0 classified DOM leaks).",
    entries: EXP1_RTL_COMPARE,
  },
};

export function experimentCompareLabelMap(
  preset: ExperimentComparePreset = "study",
): Map<string, string> {
  return new Map(EXPERIMENT_COMPARE_PRESETS[preset].entries.map((c) => [c.run_id, c.label]));
}

export function experimentCompareRunIds(
  preset: ExperimentComparePreset = "study",
): Set<string> {
  return new Set(EXPERIMENT_COMPARE_PRESETS[preset].entries.map((c) => c.run_id));
}
