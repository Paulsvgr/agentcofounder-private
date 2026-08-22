# Frontend prompt: AgentCofounder run analysis UI

Copy everything below the line into a new chat / agent when building the runs app.

---

## Product

Build a small web app for a hackathon team to **log and compare AgentCofounder challenge runs**.

Users paste a JSON export produced by the harness repo (`npm run export:run`). The UI does **not** invent telemetry. After paste, the user adds **human-only** fields (who they are, app rating, comments). Persist runs in your backend/DB (or local storage for a prototype).

## Paste JSON contract (from the harness — do not invent fields)

- Primary schema: `"agentcofounder.run_export.v2"`
- Legacy schema: `"agentcofounder.run_export.v1"` — accept with a **legacy badge**; no action-flow charts
- File comes from `artifacts/exports/<run_id>.json` after:
  - `npm run analyze -- <run-id>`
  - `npm run export:run -- <run-id> [--approach <name>]`
- **Reject** paste if `schema` is not v1 or v2
- The paste payload has **exactly three top-level objects** besides `schema`: `meta`, `harness`, `efficiency`
- **Never expect** `human`, `app_rating`, `app_comment`, `run_comment`, `call_log`, or `events.jsonl` in the paste

### TypeScript shape (v2)

```ts
type TestRun = {
  command: string;
  journey: string;
  result: "passed" | "failed";
};

type PhaseBucket = {
  phase: "recon" | "build" | "test_debug" | "finalize" | "mixed" | "other";
  call_count: number;
  weighted_cost: number;
  share_of_total: number; // 0..1
};

type ActionStage =
  | "inspect"
  | "build_app"
  | "write_tests"
  | "diagnose"
  | "repair_loop"
  | "green_build"
  | "extra_verify"
  | "report_final";

type ActionSegment = {
  stage: ActionStage;
  call_count: number;
  call_indexes: number[];
  wall_seconds: number;
  raw_tokens: number;
  weighted_tokens: number;
  note: string | null; // e.g. mega-call override on Run 6
};

type RunExportV2 = {
  schema: "agentcofounder.run_export.v2";
  meta: {
    run_id: string;
    recorded_at: string;
    git_branch: string | null;
    git_commit: string | null;
    approach: string | null; // legacy; prefer classification.display_label
    classification: {
      line: string;
      experiment: string;
      run_index: number | null;
      display_label: string;
    };
    provider: string | null;
    model: string | null;
  };
  harness: {
    status: string;
    summary: string;
    implemented_features: string[];
    assumptions: string[];
    tests_run: TestRun[];
    harness_checks: TestRun[];
    model_calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
    cost_total: number;
    pi_exit_code: number;
  };
  efficiency: {
    weighted_total: number;
    wall_seconds: number;
    seconds_per_call: number | null;
    first_test_failure_s: number | null;
    first_green_s: number | null;
    last_green_s: number | null;
    green_to_exit_s: number | null;
    manual_test_calls: number;
    manual_build_calls: number;
    test_reinspection_calls: number;
    post_green_verification_calls: number;
    auto_test_candidate_events: number;
    auto_test_actual_runs: number;
    action_flow: ActionSegment[];
    action_flow_source: "derived" | "derived+override";
    phase_heuristic: PhaseBucket[]; // heuristic only
    // v1 aliases (same values, kept for old clients):
    time_to_first_failing_test_s: number | null;
    time_to_final_green_s: number | null;
    npm_test_command_count: number;
    auto_test_trigger_hits: number;
  };
};
```

### Efficiency note for UI copy

Official weighted cost ≈ `input_tokens + output_tokens * 3 + cache_read_tokens * 0.1`. Lower `efficiency.weighted_total` is better when `harness.status` is comparable.

**Three rulers** — the same `action_flow[]` segments can be stacked using any of:

| Ruler | Field per segment | Total line |
|-------|-------------------|------------|
| Wall time | `wall_seconds` | `efficiency.wall_seconds` |
| Raw tokens | `raw_tokens` | sum of segment raw (≈ harness token total) |
| Weighted cost | `weighted_tokens` | `efficiency.weighted_total` |

Segment `wall_seconds` sums to total wall time (gap-based). Use a toggle or tabs to switch ruler without recomputing segments.

Key timing chips on detail view: `first_green_s`, `green_to_exit_s`, `test_reinspection_calls`, `post_green_verification_calls`, `manual_build_calls`.

## Human fields (frontend / DB only — not in paste JSON)

| Field | Type | Notes |
|-------|------|--------|
| `author` | string | who ran / who is judging |
| `app_rating` | number 0–10 | product quality of the generated app |
| `app_comment` | string | free text about the app |
| `run_comment` | string | free text about the run/approach |

Store alongside the pasted export (same `run_id`). Do not write them back into the export file.

## Core UX

1. **Add run** — author + paste JSON + validate schema + human fields + save

2. **List / compare** — `run_id`, `author`, `classification.display_label`, `provider`/`model`, `status`, `weighted_total`, `model_calls`, `wall_seconds`, `app_rating`; filter/sort

3. **Detail (v2)**
   - Summary, features, assumptions, tests_run / harness_checks
   - **Action-flow stacked bar** from `efficiency.action_flow[]` with ruler toggle (time / raw / weighted)
   - Fixed stage order: inspect → build_app → write_tests → diagnose → repair_loop → green_build → extra_verify → report_final (omit empty stages)
   - Show segment `note` when present (tooltip or subtitle)
   - Timing chips listed above
   - `phase_heuristic` breakdown labeled **heuristic only** (secondary to action_flow)

4. **Cohort compare (7-run study set)** — small multiples or grouped bars comparing `repair_loop` and `extra_verify` across runs on the same ruler

## v1 legacy handling

If `schema === "agentcofounder.run_export.v1"`: ingest normally, show legacy badge, use `phase_heuristic` only (no action-flow chart). Map deprecated fields: `time_to_final_green_s` → treat as `last_green_s`, etc.

## Out of scope for v1 UI

- Parsing raw `events.jsonl`
- Storing full generated app source
- Changing the paste schema (harness owns export format)

## Sample paste (v2, truncated)

```json
{
  "schema": "agentcofounder.run_export.v2",
  "meta": {
    "run_id": "2026-08-21T17-41-28-455Z",
    "classification": {
      "line": "A",
      "experiment": "auto-test",
      "run_index": 1,
      "display_label": "A · auto-test · run 1"
    }
  },
  "efficiency": {
    "weighted_total": 54200,
    "wall_seconds": 133,
    "first_green_s": 104.14,
    "green_to_exit_s": 28.82,
    "manual_build_calls": 1,
    "test_reinspection_calls": 0,
    "action_flow_source": "derived",
    "action_flow": [
      { "stage": "inspect", "call_count": 2, "wall_seconds": 12, "weighted_tokens": 5378, "note": null },
      { "stage": "build_app", "call_count": 5, "wall_seconds": 45, "weighted_tokens": 25696, "note": null },
      { "stage": "write_tests", "call_count": 3, "wall_seconds": 28, "weighted_tokens": 12038, "note": null },
      { "stage": "green_build", "call_count": 2, "wall_seconds": 35, "weighted_tokens": 9325, "note": null },
      { "stage": "report_final", "call_count": 1, "wall_seconds": 13, "weighted_tokens": 7549, "note": null }
    ]
  }
}
```
