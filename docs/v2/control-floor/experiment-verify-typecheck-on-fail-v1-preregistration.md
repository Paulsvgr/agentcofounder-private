# Experiment: factual TYPECHECK on VERIFY FAIL (257k startEdit seed)

**ID:** `verify-typecheck-on-fail-v1`  
**Status:** **KEEP** (2026-09-04) — see [keep doc](./experiment-verify-typecheck-on-fail-v1-keep.md)  
**Depends on:** default stack (VERIFY + root-error-first + persistence + Tailwind + RTL evidence KEEPs)  
**Offline signal:** [offline-257k-startedit-signal.md](./offline-257k-startedit-signal.md)  
**Flag:** `HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1` — default **ON** when unset  

## Causal story

Historical ~257k run: product bug was `startEdit(book.id)` where `startEdit` expects `Book`. VERIFY only showed:

```text
Unable to find an element with the display value: Dune.
```

Pi chased React / timing / debug sidecars. `tsc --noEmit` would have shown:

```text
error TS2345: Argument of type 'string' is not assignable to parameter of type 'Book'.
```

## Treatment (mechanism only)

On harness-owned VERIFY **FAIL**, if typecheck has errors, prepend factual block after the status line:

```text
verify exit_code=1 (FAIL)

TYPECHECK
src/App.tsx(…): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Book'.

…
Unable to find an element with the display value: Dune.
```

**No advice.** No `rg`. No Error Memory. No repair prompts. Control arm leaves VERIFY unchanged (flag `0`).

**Code:** `solution/extensions/verify-typecheck-on-fail-core.ts`  
**Wired:** `harness-owned-verify.ts` → `processCanonicalVerifyForTypecheckOnFail`  
**Forwarded:** `src/v2/challenge-prompt.ts`

## Hard 257k seed (current)

```text
fixtures/verify-typecheck-257k-hard/   # src from 2026-09-04T09-25-09-799Z + startEdit(book.id)
```

Constraints: identical fail surface both arms; no harness self-tests; no BUG/answer-key comments; only `TYPECHECK=0/1`.

```bash
npm run prove:verify-typecheck-257k-hard-messages   # Layer A
npm run experiment:verify-typecheck-257k-hard-repair -- both 1
```

**KEEP only if** treatment clearly shortens diagnosis (`TS2345 → startEdit(book) → PASS`) while control spends materially more on the secondary “Dune” symptom.

---

## Toy seed (superseded for KEEP — answer-key fixture)

Layer A / B already run; behavioral benefit **not** proven. See [results](./experiment-verify-typecheck-on-fail-v1-results.md).

```bash
npm run prove:verify-typecheck-startedit-seeded-messages
npx vitest run test/verify-typecheck-on-fail-v1.test.ts
```

| Gate | Control | Treatment |
|------|---------|-----------|
| display value Dune | yes | yes |
| `TYPECHECK` / `TS2345` | no | yes |

## Layer B — seeded Pi repair (1+1)

```bash
npm run experiment:verify-typecheck-startedit-seeded-repair -- both 1
```

Arms differ **only** on `HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1` (0 vs 1).

### Primary measures

| Measure | Why |
|---------|-----|
| First diagnosis | Mentions type / Book / TS2345 vs timing / React |
| First edit | `startEdit(book)` vs debug / test thrash |
| Calls to correct fix | Index of `startEdit(book.id)` → `startEdit(book)` |
| Repeated VERIFYs | FAIL streak before PASS |
| Weighted repair cost | First FAIL → first PASS |
| Unrelated product/test edits | Touch surface outside the one-line bug |

### Success shape (treatment)

```text
FAIL → sees TS2345 → startEdit(book.id) → startEdit(book) → PASS
```

If treatment shows that cleanly vs control thrash → strong KEEP candidate for factual `tsc` on VERIFY FAIL.

## Explicit non-goals

- Natural cohort before seeded proof  
- Advice / “fix by changing…”  
- `rg` enrichment  
- Mixing with Error Memory / repair-v1  
- Hard-stop-after-green (separate seed next)
