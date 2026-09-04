# Next lever: VERIFY must not treat a bad test as proof the product is wrong

**Status:** OPEN — styling frozen; **207k forensic complete** ([forensic-207k-verify-oracle.md](./forensic-207k-verify-oracle.md)); no treatment selected yet  
**Default stack:** Tailwind KEEP ([tailwind A/B analysis](./experiment-tailwind-ab-persist-v1-analysis.md))  
**Canonical example:** A′ rep 4 — `2026-09-03T20-49-19-219Z` (**207k**, 45 calls)

## Problem (one sentence)

Pi authors the tests that VERIFY grades; when a brittle test FAILs, Pi often treats that as evidence the **product** is wrong, changes a fine UI to satisfy the test, and burns a long repair tail.

## Why this is now #1

- Styling: CSS vocabulary GOES; Tailwind KEEP. Closed.
- Cost decomp ([v2.2](./control-floor-v2.2-cost-decomposition.md)): ~39% test authoring + VERIFY loop; ~**1%** real product repair after VERIFY.
- 207k run: product/design largely early; first VERIFY already FAIL; **6** VERIFY fails / **7** canonical fails before first green (call 34); debug sidecar; post-green churn. Trajectory shape matches **test-as-oracle** more than “broken app.”

## Exact question to answer

> How do we stop VERIFY from making Pi treat a bad test as proof that the product is wrong?

Not: “clearer FAIL text” alone (Q2-B did that).  
Not: “block bad patterns before VERIFY” alone (Q2-C did that).  
Not: “earlier VERIFY” (Q2-D — suite already huge on first write).

## Already tried (do not re-run as-is)

| Experiment | Mechanism | Outcome | Lesson |
|------------|-----------|---------|--------|
| Q2-B verify-repair | Structured FAIL + repair-first prompt | **REVERT** | Prompt to prefer test repair did not compress VERIFY→PASS |
| Q2-C authoring-guard | Pre-VERIFY F1–F5 scanner | **REVERT** | Mechanism works; inflates pre-VERIFY cost; first allowed VERIFY still fails |
| Q2-D early-verify | Auto VERIFY after first test mutation | **REVERT** | Timing OK; first write is already a full brittle suite |
| Root-error-first | Prefer runtime/import over RTL in FAIL order | **KEEP** (narrow) | Helps true roots; RTL-only tails remain |
| Error Memory v1 | Catalog hints on FAIL families | **Deferred** | Safe only after root-first; may help diagnosis, does **not** by itself invert “FAIL ⇒ product wrong” |

## Audit

**207k forensic:** [forensic-207k-verify-oracle.md](./forensic-207k-verify-oracle.md) — COMPLETE.  
**Sibling forensics:** 112k (name mismatch), 247k (label on region), 258k (role absent) — mixed causes; reporter still hides evidence in all.  
**Mechanism:** [experiment-verify-rtl-evidence-v1-preregistration.md](./experiment-verify-rtl-evidence-v1-preregistration.md) — relevance-preserving VERIFY implemented; offline 207k unit proof green; cohort pending.

Headline: FAIL #1 was already a test accessible-name miss (`"Add book"` vs product `"+ Add book"`). Compact reporter truncated roles to `main`/`banner`, so Pi diagnosed a missing toolbar, burned ~87k, then **WRONG_PRODUCT**-edited the label. Zero `PRODUCT_FIX` in the spiral. Fix: preserve queried-role `Name "..."` candidates in FAIL MESSAGE (no advice).

## Candidate directions (not selected yet)

Only after the audit; pick at most one:

1. **Epistemic dual-hypothesis on FAIL** — harness appends a fixed two-branch check: (A) test query/setup wrong vs (B) product missing behavior — without Q2-B’s failed “always repair test first” framing.
2. **RTL-only ⇒ prefer test edit** — if FAIL class is solely `TestingLibraryElementError` / query mismatch and suite loaded, steer hard to test; leave product alone unless behavior gap is explicit.
3. **Product freeze window** — after N successful journeys or after first near-green, block App mutations until tests pass (high risk; needs careful definition).
4. **Harness-owned / contracted journeys** — reduce Pi’s freedom to invent brittle selectors (overlaps prior Q2 structure work; only if audit says authoring is the root).

Error Memory remains a **secondary** tool (family hints), not the answer to oracle inversion.

## Non-goals

- More styling experiments
- Re-promoting REVERT’d Q2-B/C/D without a new causal claim
- Expanding Error Memory before this audit lands
