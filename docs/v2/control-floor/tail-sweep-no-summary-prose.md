# Tail sweep — no closing summary prose

**Status:** Documented change bundled with tail-sweep-v1 (2026-09-03)  
**Separate from:** harness sweep mechanics (test/build/server probe)

---

## What changed

Previously, Pi often ended successful runs with a long assistant message summarizing architecture and features **after** writing `report.partial.json`. Example pattern from v2.2 runs:

```text
Turn N-2: write report.partial.json
Turn N-1: bash npm run build (final confirmation)
Turn N:   "Done. Here's a summary of what I built: …" (1500+ chars)
```

The closing summary is **not required** by `contract-public/result.schema.json`. Required agent-owned fields live in `report.partial.json`:

- `summary`
- `implemented_features`
- `assumptions`
- `tests_run`

The harness composes the audited `result.json` from the partial report plus telemetry.

---

## What we removed (prompt-only)

When `HARNESS_TAIL_SWEEP_V1=1`, the tail-sweep extension appends:

- “After writing `report.partial.json`, stop immediately. Do not write a closing summary.”

No change to schema, `report.partial.json` shape, or harness result composition.

---

## Expected savings

Closing summary turns typically cost **~2.6k–3.5k weighted** (output tokens ×3). This is part of the overall tail reduction target (~9k weighted, ~10% of run) together with eliminated post-report build calls.

---

## What we did NOT change

- `report.partial.json` is still Pi-written (required for product metadata).
- Post-Pi harness verification (`verifyGeneratedApp`) still runs for audit.
- Base v2.2 system prompt / AGENTS.md unchanged when tail sweep flag is off.
