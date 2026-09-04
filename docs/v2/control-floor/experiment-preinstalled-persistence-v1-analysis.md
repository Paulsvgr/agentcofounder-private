# Experiment P1 — Preinstalled Persistence v1 — analysis & verdict

**Status:** CLOSED (2026-09-01)  
**Experiment:** `preinstalled-persistence-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)  
**Preregistration:** [experiment-preinstalled-persistence-v1-preregistration.md](./experiment-preinstalled-persistence-v1-preregistration.md) (Amendment 1)  
**Prior signal:** [CSS Vocabulary v1.1 analysis](./experiment-css-vocabulary-v1.1-analysis.md) — 3/5 refresh failures with hand-rolled storage

**Export:** `artifacts/exports/cohort-preinstalled-persistence-v1-2026-09-01.zip`  
**Run log:** `artifacts/experiments/preinstalled-persistence-v1/2026-09-01T08-20-13Z.log`

---

## Split verdict

| Layer | Verdict |
|-------|---------|
| **Persistence mechanism (manual hard refresh)** | **VERY STRONG PASS** — **0/5** failures |
| **Adoption** | **PASS** — **5/5** use `createCollectionStore` / `useCollection` |
| **Startup-race scan (final source)** | **PASS** — **0/5** hand-roll hook pattern |
| **Cost guardrails** | **FAIL** — median **81,839** (>80k); **1/5** >140k (rep 3 @ 303k) |
| **Quality floors** | **FAIL** — robustness **2/5** at 0; rep 4 UX **10/30** (<27) |
| **Formal preregistered experiment** | **REVERT** (quality regression) |

> **Engineering conclusion:** The preinstalled persistence primitive **solves the systematic refresh bug** (4/10 failures pooled on hand-rolled cohorts → **0/5** on P1). Formal KEEP is blocked by **quality guardrails**, not persistence. Do **not** conflate mechanism success with floor promotion without addressing rep 2/4 quality issues or accepting quality as out-of-scope in a future amendment.

---

## Formal verdict

**REVERT** — prereg [verdict table § quality row](./experiment-preinstalled-persistence-v1-preregistration.md#verdict-table): quality guardrails failed.

Persistence row would support **KEEP** (0/5 refresh failures, 5/5 adoption). Cost alone would yield **RELOCATED** (median slightly over guard; rep 3 tail). **Quality fails first** on formal protocol:

| Gate | Threshold | Result |
|------|-----------|--------|
| Refresh failures | 0/5 | **0/5** ✅ |
| Adoption | ≥4/5 | **5/5** ✅ |
| Median weighted | ≤80,000 | **81,839** ❌ |
| Hard cost tripwire | 0/5 >140k | **1/5** ❌ (rep 3) |
| Median `app_rating` | ≥68 | **70** ✅ |
| Median `usability_ux` | ≥28 | **30** ✅ |
| Individual UX floor | no run <27 | **1/5** ❌ (rep 4: 10) |
| Robustness failures | 0/5 | **2/5** ❌ (reps 2, 4) |

---

## Cohort table (5 reps)

Human overlay: `artifacts/runs-overlay.json` (author: paul). Manual hard refresh performed on all 5.

| Rep | Run ID | Weighted | Calls | Adopted via | Refresh | app_rating | UX | Persist | Robust |
|-----|--------|----------:|------:|-------------|---------|----------:|---:|--------:|-------:|
| 1 | `2026-09-01T08-20-18-997Z` | 81,839 | 15 | `lib/books.ts` | **pass** | 70 | 30 | 20 | 20 |
| 2 | `2026-09-01T08-23-08-128Z` | 72,711 | 14 | `lib/useBooks.ts` (wrapper) | **pass** | 50 | 30 | 20 | **0** |
| 3 | `2026-09-01T08-26-55-487Z` | 303,241 | 51 | `lib/books.ts` | **pass** | 70 | 30 | 20 | 20 |
| 4 | `2026-09-01T08-34-14-715Z` | 123,589 | 23 | `lib/bookStore.ts` | **pass** | 30 | **10** | 20 | **0** |
| 5 | `2026-09-01T08-37-50-619Z` | 52,418 | 11 | `lib/bookStore.ts` | **pass** | 70 | 30 | 20 | 20 |

**Harness success:** 5/5  
**Median weighted:** **81,839** (52k – 303k)  
**Persistence failures (manual refresh):** **0/5**

---

## Comparison: hand-rolled vs P1

| Cohort | Refresh failures | Adoption of safe primitive |
|--------|-----------------:|---------------------------|
| v2.2 baseline | 1/5 | 0/5 (hand-rolled) |
| CSS v1.1 | 3/5 | 0/5 (hand-rolled) |
| **Pooled hand-rolled** | **4/10** | — |
| **P1 treatment** | **0/5** | **5/5** |

The startup-race pattern (`useState([])` + save-before-load) that dominated CSS v1.1 reps 3–5 **did not appear** in any P1 final source. Pi routed durable collection state through the preinstalled hook in every run.

---

## Comparison: v2.2 vs P1 (cost)

| Metric | v2.2 baseline | P1 |
|--------|--------------:|---:|
| Median weighted | 60,852 | **81,839** (+34%) |
| Range | 49k – 109k | 52k – **303k** |
| Median calls | 16 | **15** |
| Tail >140k | 0/5 | **1/5** |
| Median before first VERIFY | 36,202 | **54,739** (rep 1 only comparable) |
| CSS lines written (median) | 299 | ~300 (Pi still authors CSS on v2.2 template) |

P1 did **not** reduce cost vs v2.2. Rep 3 (303k / 51 calls) is a test-repair spiral (2 piped test commands, 11 test-classified calls in trajectory) — same failure mode as prior expensive reps, unrelated to persistence plumbing.

Experiment B v1 caution remains: preinstalled storage alone does not cheapen runs when Pi still generates full product + tests.

---

## Preregistered scorecard detail

### 1. Persistence + adoption — **PASS**

Both co-primary gates met:

- **0/5** manual refresh failures (Amendment 1 strict gate)
- **5/5** adoption (`createCollectionStore` + `useCollection` in Pi-written modules)
- **0/5** hand-rolled `localStorage` hooks in runtime code (test-only `localStorage` in reps 2 & 4 — Q2 evidence)

No adopter-failure triage required — all adopting runs passed refresh.

### 2. Cost — **FAIL** (guardrails only)

| Criterion | Result |
|-----------|--------|
| Median ≤80k | **81,839** ❌ |
| 0/5 >140k | **1/5** ❌ |

Would be **RELOCATED** on cost alone per Amendment 1; superseded by quality REVERT.

### 3. Quality — **FAIL**

| Criterion | Result |
|-----------|--------|
| Median app_rating ≥68 | **70** ✅ |
| Median usability_ux ≥28 | **30** ✅ |
| No UX <27 | rep 4 **10** ❌ |
| Robustness 0/5 failures | reps **2, 4** ❌ |

Rep 4’s low scores reflect poor UI/validation UX, **not** persistence failure (refresh passed). Rep 2 persistence passed but robustness scored 0 (likely validation/edge-case UX).

---

## Per-rep notes

### Rep 1 — 81k

Clean adoption via `lib/books.ts` wrapping store + `parseBook`. One VERIFY repair cycle. Refresh **pass**. Strong rubric (70/100).

### Rep 2 — 73k

Wrapper `useBooks.ts` over primitive (allowed per prereg). Refresh **pass**. Robustness **0** — investigate validation/empty-input handling; app_rating 50.

### Rep 3 — 303k

Persistence **pass** despite 51-call test spiral. Dominant cost in mixed/test phases after early VERIFY failures. Confirms Q2 (test quality) remains the tail-risk lever, not persistence.

### Rep 4 — 124k

Refresh **pass** but worst UX (10/30) and robustness 0. Persistence mechanism worked; product polish did not.

### Rep 5 — 52k

Efficient run (11 calls). `lib/bookStore.ts` pattern. Refresh **pass**. Near-baseline cost profile.

---

## Engineering conclusions

1. **Preinstalled `useCollection` eliminates the systematic refresh bug** — 0/5 vs 4/10 pooled on hand-rolled cohorts.
2. **Adoption is automatic when the primitive is in-template** — 5/5 vs Experiment B’s RESOURCES.md delivery (also 5/5 adoption but different cost baseline).
3. **Formal KEEP blocked by quality guardrails**, not persistence — reps 2 and 4 scored robustness 0; rep 4 UX floor breach.
4. **Cost guardrails failed marginally** — median 1.8k over 80k; rep 3 tail dominates.
5. **CSS vocabulary remains a separate candidate** (`b3a2771`) for stacking after a quality-aware promotion path is chosen.

### Recommended next steps

1. **Mechanism promotion (engineering):** Treat persistence primitive as validated; consider v2.3 = v2.2 + preinstalled collection store **after** a quality decision (amend prereg, re-run with quality out-of-scope guard, or fix rep 2/4 failure modes in a narrow follow-up).
2. **Q2:** Test isolation (`memoryStorage.ts`), remount-vs-reload journey tests — rep 3 tail + test-only localStorage patterns.
3. **CSS stack experiment:** Separate prereg — v2.3-persistence + CSS vocabulary; do not mix with this formal verdict.
4. **Overlay hygiene:** P1 runs logged under `css-vocabulary-v1` experiment_id in overlay — re-tag to `preinstalled-persistence-v1` for catalog accuracy.

---

## References

- Preregistration: [experiment-preinstalled-persistence-v1-preregistration.md](./experiment-preinstalled-persistence-v1-preregistration.md)
- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- CSS v1.1 persistence signal: [experiment-css-vocabulary-v1.1-analysis.md](./experiment-css-vocabulary-v1.1-analysis.md)
- Experiment B: [experiment-b-v1-verdict.md](../resources/experiment-b-v1-verdict.md)
- Export: `artifacts/exports/cohort-preinstalled-persistence-v1-2026-09-01.zip`
