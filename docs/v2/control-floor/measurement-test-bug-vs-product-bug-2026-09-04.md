# Measurement: TEST BUG vs PRODUCT BUG on natural first fails (2026-09-04)

**Status:** MEASURED  
**Question:** When VERIFY fails, how often was the **failing test itself wrong/brittle** vs the **product** missing required behavior?  
(This is *not* “did Pi edit the test?” — 74% of repair windows are test-only; this asks whether that edit was correcting a bad test.)

**Board context:** Wrong-locus DROP; test-weakening OBSERVE ONLY (`board-freeze-locus-2026-09-04.md`). Neither explains expensive repair tails — this measurement does.

Classification assist: [TEST vs PRODUCT bug pass](fc430657-4d7a-4f0c-bbea-228b9b136f3b).

---

## Rubric (closed)

| Label | Meaning |
|-------|---------|
| **TEST_BUG** | Query / assertion / journey step wrong or overly brittle vs a reasonable product (invented copy, wrong lent-state step, unscoped `MULTIPLE` needing `within`, text split across nodes). Correct repair is primarily **test-side**. |
| **PRODUCT_BUG** | Product missing/wrong required behavior; test demand reasonable. Correct repair primarily **product-side**. |
| **AMBIGUOUS** | Cannot tell / both sides / empty evidence. |
| **OTHER_HARNESS** | Typecheck, module resolve, transform, `vi` undefined, etc. — not a journey locus judgment. |

**Unit:** **First** VERIFY FAIL of each natural bookshelf run (same cost fork as call-count measurement).

**Samples:**
1. **Expensive tails:** first fail of runs with `verify_fail_before_green ≥ 3` (**n=36**).
2. **One-shot repairs:** first fail where the **next** VERIFY PASSes (**n=45**) — cleanest “what fixed it?” signal.

Corpus: 313 natural runs → 134 with a first VERIFY FAIL (179 first-VERIFY PASS / no usable fail).

---

## Headline

| Bucket | TEST_BUG | PRODUCT_BUG | AMBIGUOUS | OTHER_HARNESS | n |
|--------|--------:|------------:|----------:|--------------:|--:|
| **Expensive (vf≥3)** | **23 (64%)** | **1 (3%)** | 4 (11%) | 8 (22%) | 36 |
| **Next-green one-shot** | **39 (87%)** | **0 (0%)** | 3 (7%) | 3 (7%) | 45 |

### Answers

1. **Expensive multi-VERIFY tails are mostly bad/brittle tests** — **~64% TEST_BUG**, almost never clear PRODUCT_BUG (**1/36**).
2. **One-shot first repairs are even more test-sided** — **~87% TEST_BUG**.
3. **Yes: “the failing test was wrong/brittle” dominates expensive repair loops** — not missing product behavior. A large secondary slice on expensive runs is **OTHER_HARNESS (~22%)** (transform/`vi`/imports), which also is not “product incomplete.”

---

## How this sits next to prior facts

| Prior fact | How it fits |
|------------|-------------|
| 74% of FAIL→VERIFY windows are **test-only edits** | Consistent — Pi is usually fixing the oracle it wrote. |
| First-fail mix on ship-like stack: **MULTIPLE ~44%**, COPY ~22% | MULTIPLE ⊆ TEST_BUG (unscoped queries). COPY_NAME_MISS ⊆ TEST_BUG (invented wording). |
| Wrong-locus natural **0/90** | Consistent — Pi rarely deforms product to satisfy a bad test *in natural*; it edits the test. |
| Test-weakening **~2.2%** | Orthogonal: most TEST_BUG repairs are scoping/`within`/regex soften = **correct or brittle-harmless**, not coverage loss. |
| Cost ≈ calls × 4.6k; expensive = **repeated VERIFY after first FAIL** | Loops persist when the **first test repair fails again** (still wrong journey, still MULTIPLE, IGNORED_FACTS) — not when product is unfinished. |

### Canonical expensive TEST_BUG shapes

- **MULTIPLE** → needs `within(row)` / summary label scope (largest one-shot class).
- **Text split** across nodes → exact `getByText` fails; soft matcher or parent `toHaveTextContent`.
- **Invented copy** (`2 total books`, `0 of 0 books`, empty-state prose).
- **Wrong journey state** — e.g. `14-48-25`: QUERIED `Lend out` while BUTTONS PRESENT = `Mark returned` / `Edit` / `Remove`.

---

## What this does *not* authorize

- Not a license to auto-rewrite tests in the harness.
- Not “ban product edits.”
- Not another AGENTS one-liner (already killed as a lever).
- Does **not** by itself cut cost — knowing the disease is TEST_BUG explains **why** VERIFY loops, but the KEEP stack already supplies MULTIPLE/COPY evidence. Remaining waste is still **IGNORED_FACTS / failed first repair**, not missing reporters.

---

## Verdict

**Natural first-fail repair loops are overwhelmingly a test-oracle problem (brittle/wrong tests), not a missing-product problem.**

Next cost work should target **first test-repair success rate** under COMPLETE evidence — especially non-MULTIPLE TEST_BUG (COPY / journey-state). See `measurement-first-test-repair-miss-2026-09-04.md`: one-shots are **95% MULTIPLE**; still-red is mostly **TEXT/ROLE + off-target / partial invent / diagnosis-only** first repairs.

---

## Raw counts (corpus extraction)

| | n |
|--|--:|
| Natural runs | 313 |
| First VERIFY FAIL | 134 |
| First fail class MULTIPLE | 70 |
| TEXT_MISS | 24 |
| ROLE_NAME_MISS | 9 |
| OTHER / TYPECHECK / ASSERTION | 31 |
| Locus after first fail: test / both / prod / none | 100 / 22 / 8 / 4 |
| Next VERIFY PASS after first fail | 45 / 134 (≈34%) |
| vf≥3 tails classified | 36 |
