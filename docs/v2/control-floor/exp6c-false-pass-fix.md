# Exp6c — False PASS on suite/transform failure (frozen bug)

**Status:** IMPLEMENTED + **relocked** (control floor v2.1, 2026-08-31)  
**Type:** test tooling correctness (domain-neutral)  
**Parent:** [exp6-compact-reporter.md](./exp6-compact-reporter.md) (Exp6b)

---

## Implementation (2026-08-31)

`compactFailureReporter.ts` now:

1. Collects suite-level errors via `TestModule.errors()` (transform/collection failures).
2. Emits **PASS** only when `counts.total > 0` and no failures.
3. Emits **FAIL** with `SUITE_ERROR` + `FAILURES N` when `counts.total === 0` or module errors exist.

Verified locally: transform failure → `❌ FAIL 0/0 · suite did not run` (not `PASS 0/0`).

**Next:** ~~relock 5 control reps~~ **done** → [control-floor-v2.1-analysis.md](./control-floor-v2.1-analysis.md).

---

## Observed bug (rep 5)

**Run:** control floor v2 rep 5 — `2026-08-30T20-49-19-145Z` (232k weighted, 55 calls)  
**Artifact:** `artifacts/runs/2026-08-30T20-49-19-145Z/sessions/…jsonl`

Pi introduced a syntax error in `App.tsx` (duplicate `export function App()`). Vitest could not transform the suite.

Compact reporter output:

```text
✅ PASS 0/0 tests · 0 failed
PASS 0/0
```

That is **not** green. Pi became suspicious and re-ran with `--reporter=default`, which showed the real failure:

```text
FAIL src/App.test.tsx [ src/App.test.tsx ]
Error: Transform failed with 1 error:
  …/App.tsx:15:0: ERROR: Unexpected "export"
 Tests  no tests
```

**Root cause in reporter logic:** `onTestRunEnd` treats `failures.length === 0` as PASS, without checking that any tests actually completed. Transform/collection/suite errors produce **zero test cases** — none failed, none passed — so the reporter emits a false green line.

Relevant code today (`app-template/compactFailureReporter.ts`):

```typescript
if (failures.length === 0) {
  process.stdout.write(
    `\n✅ PASS ${counts.passed}/${counts.total} tests · 0 failed\n…`,
  );
  return;
}
```

When `counts.total === 0`, this must **never** be PASS.

---

## Expected semantics

**PASS** only when **all** of:

1. `completed tests > 0` (at least one test ran to completion)
2. `failed tests === 0`
3. No suite/collection/transform error prevented the run

**FAIL** when **any** of:

- `failed tests > 0` (existing Exp6 behaviour)
- `completed tests === 0` while tests are required (`passWithNoTests: false`)
- Suite failed to load, collect, or transform (module-level error)

Suggested FAIL output shape (design only — not implemented):

```text
❌ FAIL 0/0 tests · suite did not run
SUITE_ERROR Transform failed: Unexpected "export" at App.tsx:15
```

Or equivalent: emit `FAILURES 1` with a synthetic failure block describing the suite error, so Pi and harness parsers stay consistent.

---

## What Exp6b fixed vs what Exp6c must fix

| Scenario | Exp6 (FAIL only) | Exp6b (+ PASS line) | Exp6c (required) |
|----------|------------------|---------------------|------------------|
| N/N tests pass | silent | ✅ `PASS N/N` | ✅ unchanged |
| Test assertion fails | compact FAIL | compact FAIL | unchanged |
| Transform/suite failure | unclear / silent | ❌ **`PASS 0/0`** | ❌ → **FAIL** |

Exp6b solved **silent green on real pass**. Exp6c must solve **false green on zero tests**.

---

## Impact on control floor v2 interpretation

Rep 5 (`232k`, 55 calls) included extra repair cost partly because Pi trusted `PASS 0/0`, continued, and only discovered the syntax error after switching reporters. The run still ended success (harness 3/3), but the **feedback loop was wrong**.

Do **not** start Experiment B against control v2 until Exp6c is fixed and a new control cohort is locked — otherwise treatment effects are confounded with verifier correctness.

---

## Recommended path (decision pending)

```text
Option A — Experiment B now
  Compare vs control v2 @ 106k median
  Risk: known false-green verifier

Option B — Harness v2.1 first (recommended)
  1. Implement Exp6c
  2. Relock control cohort (v2.1)
  3. Experiment B vs v2.1 control
```

---

## What this does **not** do

- Does not fix piped `vitest | tail` masking exit codes (separate harness-owned VERIFY item).
- Does not classify TEST QUERY vs REAL BUG (Exp4 territory).
- Does not enforce mechanical stop-after-green (Exp2 harness enforcement).

---

## Implementation notes (done)

Reporter uses `TestModule.errors()` and `TestModule.state()` for suite-level failures. Files changed:

| File | Role |
|------|------|
| `app-template/compactFailureReporter.ts` | Guard: no PASS when `total === 0`; surface suite errors |

After relock: **control floor v2.1**.

---

## References

- Control floor v2 analysis: [control-floor-v2-analysis.md](./control-floor-v2-analysis.md)
- Rep 5 run: `artifacts/runs/2026-08-30T20-49-19-145Z/`
- Exp6b doc: [exp6-compact-reporter.md](./exp6-compact-reporter.md)
