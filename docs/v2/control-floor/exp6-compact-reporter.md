# Exp6b — Compact Vitest reporter (PASS + FAIL)

**Phase F verdict:** KEEP (extends Exp6)  
**Type:** test tooling (domain-neutral)

## Problem

Exp6 compact failure output helped on **FAIL**, but on **PASS** the reporter printed nothing. Pi re-ran `npm test`, switched to `--reporter=verbose`, or grepped output to confirm green — extra tool calls and tokens.

## Change

Extend `compactFailureReporter.ts` to emit one deterministic line on success:

```text
✅ PASS 7/7 tests · 0 failed
PASS 7/7
```

On failure, keep Exp6 compact blocks + `FAILURES N` marker.

**Exp6c (v2.1):** never emit PASS when zero tests completed; surface suite/transform errors via `TestModule.errors()`. See [exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md).

**Files:**

| File | Role |
|------|------|
| `app-template/compactFailureReporter.ts` | PASS + FAIL output |
| `app-template/vitest.config.ts` | Default reporter unless CLI overrides |

## What this does **not** do

- Does not classify failure types (TEST QUERY vs REAL BUG) — future Exp4 territory.
- Does not change pass/fail semantics — only stdout clarity.

## Control floor v2

After Exp6b + D1 smoke separation, relock 5 control reps. Compare Experiment B against **control floor v2**, not pre-Exp6b ~94k median.

## How to revert

Restore Exp6-only reporter (no PASS line) or delete custom reporter from `vitest.config.ts`.
