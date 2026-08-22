# Frontend prompt: AgentCofounder run analysis UI

Copy everything below the line into a new chat / agent when building the runs app.

---

## Product

Build a small web app for a hackathon team to **log and compare AgentCofounder challenge runs**.

Users paste a JSON export produced by the harness repo (`npm run export:run`). The UI does **not** invent telemetry. After paste, the user adds **human-only** fields (who they are, app rating, comments). Persist runs in your backend/DB (or local storage for a prototype).

## Paste JSON contract (from the harness — do not invent fields)

- Schema id: `"agentcofounder.run_export.v1"`
- File comes from `artifacts/exports/<run_id>.json` after:
  - `npm run analyze -- <run-id>`
  - `npm run export:run -- <run-id> [--approach <name>]`
- **Reject** paste if `schema` ≠ `agentcofounder.run_export.v1`
- The paste payload has **exactly three top-level objects** besides `schema`: `meta`, `harness`, `efficiency`
- **Never expect** `human`, `app_rating`, `app_comment`, `run_comment`, `call_log`, or `events.jsonl` in the paste

### TypeScript shape

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

type RunExport = {
  schema: "agentcofounder.run_export.v1";
  meta: {
    run_id: string;              // e.g. "2026-08-21T17-12-43-573Z"
    recorded_at: string;         // ISO-8601
    git_branch: string | null;
    git_commit: string | null;   // full SHA
    approach: string | null;     // legacy label; e.g. "A-baseline-1", "base"
    classification: {
      line: string;              // harness family: A | A-prime | B-prime | C | C-prime | D | unknown
      experiment: string;          // tweak arm: baseline | no-dev-server-prompt | auto-test | autoverify-* | ...
      run_index: number | null;    // cohort repeat (1, 2, 3) when set at export
      display_label: string;     // UI method column, e.g. "A · baseline · run 1"
    };
    provider: string | null;     // e.g. "zai"
    model: string | null;        // e.g. "glm-5.2"
  };
  harness: {
    status: string;              // typically "success" | "partial" | "failed"
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
    weighted_total: number;      // SCOREBOARD: input + output*3 + cache_read*0.1
    wall_seconds: number;
    seconds_per_call: number | null;
    time_to_final_green_s: number | null;
    time_to_first_failing_test_s: number | null;
    npm_test_command_count: number;
    auto_test_trigger_hits: number;
    phase_heuristic: PhaseBucket[]; // heuristic only — label as such in UI
  };
};
```

### Efficiency note for UI copy

Official weighted cost ≈ `input_tokens + output_tokens * 3 + cache_read_tokens * 0.1`. Lower `efficiency.weighted_total` is better when `harness.status` is comparable. Show **median** across runs on the same `meta.classification.experiment` (or `meta.classification.line`) when comparing.

## Human fields (frontend / DB only — not in paste JSON)

Collected in the UI after a successful paste/parse:

| Field | Type | Notes |
|-------|------|--------|
| `author` | string | who ran / who is judging |
| `app_rating` | number 0–10 | product quality of the generated app |
| `app_comment` | string | free text about the app |
| `run_comment` | string | free text about the run/approach |

Store these **alongside** the pasted `RunExport` (same `run_id`). Do not write them back into the export file format.

## Core UX

1. **Add run**
   - Ask for `author` (required)
   - Large textarea: paste JSON
   - Validate schema + required numbers (`efficiency.weighted_total`, `harness.status`, `meta.run_id`)
   - Then: `app_rating` (0–10), `app_comment`, `run_comment`
   - Save

2. **List / compare**
   - Table columns at minimum: `run_id`, `author`, `approach` or `git_branch`, `provider`/`model`, `status`, `weighted_total`, `model_calls`, `wall_seconds`, `app_rating`
   - Filter by approach, branch, author, status
   - Sort by weighted_total (asc) and app_rating (desc)

3. **Detail**
   - Show summary, features, assumptions
   - tests_run / harness_checks pass-fail lists
   - phase_heuristic breakdown (clearly labeled heuristic)

## Out of scope for v1

- Parsing raw `events.jsonl`
- Storing full generated app source in the DB
- Changing the paste schema (harness owns `agentcofounder.run_export.v1`)

## Sample paste (truncated)

```json
{
  "schema": "agentcofounder.run_export.v1",
  "meta": {
    "run_id": "2026-08-21T17-12-43-573Z",
    "recorded_at": "2026-08-21T20:07:55.953Z",
    "git_branch": "setup/measure",
    "git_commit": "b7d488328c21f45eb3051f60a9c00fb65f79f3fe",
    "approach": "A-baseline-1",
    "classification": {
      "line": "A",
      "experiment": "baseline",
      "run_index": 1,
      "display_label": "A · baseline · run 1"
    },
    "provider": "zai",
    "model": "glm-5.2"
  },
  "harness": {
    "status": "success",
    "summary": "A simple single-user home book library…",
    "implemented_features": ["Add a book…"],
    "assumptions": ["…"],
    "tests_run": [
      { "command": "npm test", "journey": "Add a complete book…", "result": "passed" }
    ],
    "harness_checks": [
      { "command": "vitest…", "journey": "…", "result": "passed" }
    ],
    "model_calls": 24,
    "input_tokens": 19266,
    "output_tokens": 10187,
    "cache_read_tokens": 241152,
    "cache_write_tokens": 0,
    "total_tokens": 270605,
    "reasoning_tokens": 0,
    "cost_total": 0,
    "pi_exit_code": 0
  },
  "efficiency": {
    "weighted_total": 73942.2,
    "wall_seconds": 160.722,
    "seconds_per_call": 6.697,
    "time_to_final_green_s": 122.907,
    "time_to_first_failing_test_s": null,
    "npm_test_command_count": 4,
    "auto_test_trigger_hits": 4,
    "phase_heuristic": [
      { "phase": "build", "call_count": 8, "weighted_cost": 28847.8, "share_of_total": 0.39 }
    ]
  }
}
```
