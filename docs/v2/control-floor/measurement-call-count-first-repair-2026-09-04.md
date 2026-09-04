# Measurement lock: call-count cost + first-repair fork (2026-09-04)

**Status:** FROZEN  
**Mode:** ship + observe — **no new VERIFY / gate / coaching / scaffold experiment tonight**

This note locks findings from the call-taxonomy and evidence-completeness audits so we do not re-open dead levers.

---

## Locked model

```text
cost ≈ model_calls × ~4.6k weighted
```

Per-call weighted cost is essentially flat across run length and stack era (~4.3–4.7k). Long runs are expensive because Pi takes more turns, not because turns inflate.

| Run length (calls) | n | median cost | cost/call |
|--------------------|--:|------------:|----------:|
| 0–12 | 23 | 50.4k | ~4.7k |
| 13–17 | 61 | 70.2k | ~4.6k |
| 18–24 | 44 | 87.0k | ~4.4k |
| 25+ | 65 | 155.7k | ~4.3k |

First-green call index correlates with weighted cost at **r ≈ 0.88** (r² ≈ 0.78).

One avoided call ≈ **4.6k** weighted.

---

## Where expensive runs diverge

Not during the initial build. **After the first VERIFY FAIL.**

| Band | first VERIFY | first FAIL | green | repair window |
|------|-------------:|-----------:|------:|--------------:|
| ≤60k | ~7 | ~8 | ~9 | ~2 calls |
| >100k | ~10 | ~10 | ~22 | ~7 calls |

Post-green work is flat (~3–4 calls) across bands once FULL_GREEN is active.

---

## Main expensive loop

```text
VERIFY FAIL
  → TEST_FIX
  → VERIFY FAIL again    ← expensive fork
  → DIAGNOSE / rewrite / retry
  → …
```

Cheap repair is typically one shot: `TEST_FIX → VERIFY_PASS`.

Corpus transition signal (repair window):

- ≤60k top transition: `TEST_FIX → VERIFY_PASS`
- >100k top transition: `TEST_FIX → VERIFY_FAIL`

`prod/test ≈ 1.0` on expensive runs is a **late outcome** of that loop, not an early predictor. Do not gate on it.

`POST_RTL_PRODUCT_EDIT` (RTL-looking fail → product edit) is a **neutral observable only**. Manual spot-check showed mixed locus (true wrong-locus, legitimate a11y, ambiguous). Do **not** treat it as `WRONG_PRODUCT` rate.

---

## VERIFY evidence is mostly sufficient

Corpus-wide first-failure evidence classes (natural runs, n=124 first FAIL):

| Class | Share |
|-------|------:|
| `EVIDENCE_COMPLETE` | ~74% |
| `EVIDENCE_MISSING_INVENTORY` | **~2%** |
| `EVIDENCE_TRUNCATED / PARSE_FAILED` | ~2% |
| `NOT_APPLICABLE` (typecheck / runtime / suite / assertion) | ~23% |

Among >100k runs with a failed first repair: missing inventory ≈ **3%**.

Evidence completeness **does not** predict first-repair success (~56% fail rate even when complete).

Failure-class repairability (first repair):

| Kind | first-repair fail rate |
|------|-----------------------:|
| `multiple` (structural) | ~39% |
| `text_miss` | ~77% |
| assertion mismatch | ~86% |

**Decision:** stop expanding VERIFY reporters / TEST CONTEXT / coaching. Headroom is too small to move the median; TEST CONTEXT already showed cheaper-via-wrong-locus risk.

---

## Hygiene (not an experiment)

**MULTIPLE `(none parsed)` parser defect — FIXED 2026-09-04.**

Root cause: live Testing Library dumps prefix each match with `Ignored nodes: …`. An earlier extractor required blocks to start with `<`, dropped every live chunk, and emitted:

```text
MATCHES PRESENT
(none parsed)
```

even when matches existed (~48% of `MATCHES PRESENT` blocks in the Sep-4 MULTIPLE surface).

Fix (KEEP path, no new flag):

- Split on `Ignored nodes:` boundaries when present
- Strip the prefix before requiring a tag
- Never emit `(none parsed)`; return `null` and fall through if no candidates

Locked by unit + live tests in `test/compact-failure-message.test.ts` and `app-template/test/compact-failure-multiple-live.test.ts`.

---

## Closed / do-not-revive tonight

```text
semantic scaffold / starter shell     — needs shape signal; planner = LLM call; A v2 rejected component APIs
planner for scaffold                  — ~4.6k/call; out of scope
new reporter / TEST CONTEXT / inventory overlay
gates / cadence / abort-restart
repair-surface lock / pre-green test budget / quality contract
test_isolation revival                — already REVERT (mechanism PASS, cost worse)
```

---

## Ship stance

```text
SHIP STACK unchanged
  MULTIPLE + role/name + rtl_text + TYPECHECK + persistence + Tailwind + FULL_GREEN

HYGIENE
  self-tests stripped ✅
  MULTIPLE (none parsed) fixed ✅

NEXT
  run natural ship-stack reps and observe
  do not invent another feature unless a new measurement unlocks one
```

Natural ship cohort reference: [ship-keep-full-green-cohort-2026-09-04.md](./ship-keep-full-green-cohort-2026-09-04.md)  
Board: [board-lock-ship-observe-2026-09-04.md](./board-lock-ship-observe-2026-09-04.md)
