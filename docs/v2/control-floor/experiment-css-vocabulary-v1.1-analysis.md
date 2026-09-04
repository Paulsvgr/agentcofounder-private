# Experiment CSS Vocabulary v1.1 — analysis & provisional verdict

**Status:** CLOSED (2026-09-01) — **formal verdict: REVERT**  
**Experiment:** `css-vocabulary-v1.1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)  
**Preregistration:** [experiment-css-vocabulary-v1.1-preregistration.md](./experiment-css-vocabulary-v1.1-preregistration.md)  
**Prior:** [CSS Vocabulary v1 analysis](./experiment-css-vocabulary-v1-analysis.md) — REVERT (mechanism PASS, contract FAIL on stylesheet read)

**Export:** `artifacts/exports/cohort-css-vocabulary-v1.1-2026-09-01.zip`  
**Run log:** `artifacts/experiments/css-vocabulary-v1.1/2026-09-01T00-36-18Z.log`

> **Do not promote to v2.3.** CSS-authoring mechanism validated; formal prereg fails on **contract** (inline styling 2/5) and **quality** (persistence 3/5). Next lever is Q2, not another CSS vocabulary rep.

---

## Formal verdict

**REVERT** — prereg [verdict table](./experiment-css-vocabulary-v1.1-preregistration.md#verdict-table) **row 6** (contract tripwire: substantive inline styling in 2/5 runs). Row 2 (quality fail) would also apply independently.

| Prereg row | CSS | Cost | Quality | Contract | Applies? |
|------------|-----|------|---------|----------|----------|
| 1 KEEP → v2.3 | ✅ | ✅ | ❌ | ❌ | No |
| 2 REVERT | ✅ | ✅ | ❌ | ❌ | Yes (quality) |
| 6 REVERT (contract) | any | any | any | ❌ | **Yes (primary)** |

---

## Split verdict (frozen engineering view)

| Layer | Verdict |
|-------|---------|
| CSS-authoring mechanism | **VERY STRONG PASS** |
| Stylesheet encapsulation (read/write/bash block) | **PASS** (0 successful reads, guards worked 5/5) |
| Vocabulary boundary (no inline styling) | **FAIL** (substantive inline styles in **2/5** final apps) |
| Cost guardrails | **PASS** (median 48.8k ≤ 80k; 0/5 > 140k) |
| Quality overlay | **FAIL** (persistence **3/5**; median app_rating **30**) |
| **Formal preregistered experiment** | **REVERT** |

---

## Corrected cohort table (5 reps)

Metrics below use the **corrected classifiers** documented in [§ Measurement corrections](#measurement-corrections). No new Pi runs.

| Rep | Run ID | Weighted | Calls | VERIFY fails | CSS lines | CSS read (success) | Blocked CSS inspect† | Inline styles (final)‡ | Persist (manual refresh) |
|-----|--------|----------:|------:|-------------:|----------:|-------------------:|---------------------:|------------------------:|-------------------------|
| 1 | `2026-09-01T00-36-23-545Z` | 41,017 | 11 | 0 | 0 | 0 | **3** | **10** | pass (lazy-init; refresh OK) |
| 2 | `2026-09-01T00-38-32-254Z` | 45,197 | 11 | 1 | 0 | 0 | **1** | 0 | pass (loaded-guard; refresh OK) |
| 3 | `2026-09-01T00-40-35-286Z` | 67,741 | 16 | 4 | 0 | 0 | **1** | **5** | **fail — books gone** |
| 4 | `2026-09-01T00-43-16-079Z` | 52,453 | 11 | 0 | 0 | 0 | **1** | 0 | **fail — books gone** |
| 5 | `2026-09-01T00-45-41-598Z` | 48,781 | 15 | 1 | 0 | 0 | **1** | 0 | **fail — books gone** |

† `blocked_css_read_attempts` — deduped by `toolCallId` on `tool_execution_start` where tool is `read`/`bash` targeting `styles.css`. Total **7** (not 35).  
‡ `inline_style_final_count` — `style={{…}}` occurrences in final `app/src/**/*.tsx`. Substantive = ≥2 occurrences (prereg: single trivial exception). **2/5 runs fail.**

**Distribution:** 41k · 45k · 49k · 52k · **68k**  
**Median weighted:** **48,781** (41k – 68k)  
**Harness success:** **5/5**

---

## Cohort comparison (v2.2 vs CSS v1 vs CSS v1.1)

| Metric | v2.2 baseline | CSS v1 | CSS v1.1 |
|--------|--------------:|-------:|---------:|
| Median weighted | 60,852 | 47,126 | **48,781** |
| Weighted range | 49k – 109k | 32k – 86k | **41k – 68k** |
| CoV (weighted) | ~36% | ~44% | **~20%** |
| Median calls | 16 | 17 | **11** |
| Median output tokens | 9,326 | 6,043 | **6,424** |
| Median cache read | 91,520 | 96,320 | **63,296** |
| Median before first VERIFY | 36,202 | 25,366 | **27,662** |
| Median VERIFY → canon green | 8,950 | 10,487 | **7,613** |
| CSS lines written (median) | 299 | 0 | **0** |
| Successful CSS reads | 966 (seed) | 0 (1 leak @ 24.5k) | **0** |
| Shadow API in final JSX | — | 1/5 | **0/5** |
| Substantive inline styles (final) | 0 | not measured | **2/5** |
| Agents tried stylesheet inspect | — | — | **5/5** (all blocked) |

v1.1 is ~**20% below v2.2 median** with a much tighter tail. Economic signal remains encouraging at n=5, not definitive proof.

---

## Phase split (Metrics v2)

| Phase | v2.2 median | CSS v1.1 median | Notes |
|-------|------------:|------------------:|-------|
| Before first VERIFY | 36,202 | **27,662** | **−24%** — predicted CSS win |
| VERIFY → canonical green | 8,950 | **7,613** | modest improvement (rep 3 tail dominates) |
| Post valid full green | ~7,100 | **~6,500** | ~same |

Lower median cache reads (63k vs 92k v2.2) suggest compounding context savings when the large stylesheet never enters the thread — including during test repair.

---

## Preregistered scorecard (corrected metrics)

### 1. CSS mechanism — **PASS**

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Median `css_lines_written` | ≤ 60 | **0** ✅ |
| Median `css_attributable_output` | ≤ 330 | **0** ✅ |
| Anti-bimodality | ≥ 4/5 ≤ 100 lines | **5/5** ✅ |

### 2. Cost guardrails — **PASS**

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Median weighted | ≤ 80,000 | **48,781** ✅ |
| Hard regression | 0/5 > 140,000 | **0/5** ✅ |

### 3. Contract tripwires — **FAIL**

| Tripwire | Threshold | Result |
|----------|-----------|--------|
| Successful CSS read (`css_read_bytes`) | > 0 any run | **0/5** ✅ |
| Shadow API in final JSX | any undocumented class / data-state / data-tone | **0/5** ✅ |
| CSS written | > 0 | **0/5** ✅ |
| **Substantive inline styling (final source)** | evasion = contract failure | **2/5** ❌ (reps 1, 3) |
| Stylesheet inspect blocked | reporting | **7 attempts / 5/5 agents tried** |

**Verdict table row 6 applies:** contract tripwire → formal **NOT KEEP**.

Ledger-only `inline_style_edits` (counting Pi write/edit tool output) reported **0/5** — that metric **missed** final-source inline styles. See measurement corrections below.

### 4. Quality floors — **FAIL**

Human overlay in `artifacts/runs-overlay.json` (author: paul). Manual browser refresh: reps **1–2** retained books; reps **3–5** lost books after refresh.

| Rep | Run ID | app_rating | usability_ux | data_state_persistence | robustness |
|-----|--------|----------:|-------------:|-----------------------:|-----------:|
| 1 | `2026-09-01T00-36-23-545Z` | 68 | 28 | **20** | 20 |
| 2 | `2026-09-01T00-38-32-254Z` | 70 | 30 | **20** | 20 |
| 3 | `2026-09-01T00-40-35-286Z` | 30 | 30 | **0** | 0 |
| 4 | `2026-09-01T00-43-16-079Z` | 28 | 28 | **0** | 0 |
| 5 | `2026-09-01T00-45-41-598Z` | 28 | 28 | **0** | 0 |

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Median `app_rating` | ≥ 68 | **30** ❌ |
| Median `usability_ux` | ≥ 28 | **28** ✅ |
| Individual UX floor | no run < 27 | **0/5 below** ✅ |
| Persistence failures | ≤ 1/5 | **3/5** ❌ (reps 3–5) |
| Robustness failures | 0/5 | **3/5 scored 0** ❌ |

Rep 3’s low app_rating (30) reflects the combination of test spiral + persistence failure, not CSS quality.

**Root cause (reps 3–5):** `useState([])` + separate load/save `useEffect`s without a `loaded` guard — initial empty array writes to `localStorage` before async load completes (worse under React StrictMode double-mount in dev).

---

## Per-rep notes

### Rep 1 — 41k

First VERIFY PASS 8/8. Pi tried compound bash including `cat src/styles.css` **twice**, then explicit `read src/styles.css` — **3 blocked inspect attempts** before proceeding. Final app has **10 inline `style={{…}}`** declarations (flexWrap, gap, alignItems, etc.) despite AGENTS.md prohibition. **Persistence pass** — books survived manual refresh (lazy-init in `useBooks.ts`).

### Rep 2 — 45k

One VERIFY failure (ambiguous `"Title"` query), repaired in tests. **1 blocked** stylesheet inspect. Zero inline styles. **Persistence pass** — books survived manual refresh (`loaded` guard before save).

### Rep 3 — 68k (test spiral, CSS innocent)

Four VERIFY failures: `FAIL 0/0` (suite error) → TL query failures → PASS @ call 13. ~34k weighted from first VERIFY to green; almost all edits in `App.test.tsx`. **5 inline styles** (flexWrap, justifyContent). **Persistence fail** — books lost on manual refresh.

### Rep 4 — 52k

Clean VERIFY PASS 8/8. **1 blocked** inspect. Zero inline styles. **Persistence fail** — books lost on manual refresh (effect-save race).

### Rep 5 — 49k

One VERIFY repair cycle. Pi ran `grep -n "style=" src/App.tsx` before verify; final app has **zero** inline styles — shows Pi *can* comply. **Persistence fail** — books lost on manual refresh (effect-save race).

---

## Measurement corrections

Two bugs were found in the initial export summary. Corrected definitions (applied in this document and export `MANIFEST.json`):

### 1. `blocked_css_read_attempts`

**Wrong:** count every event-line containing the block reason string (~5× inflation via `tool_execution_end`, `message_end`, `turn_end` duplicates).

**Correct:** dedupe by `toolCallId` on `tool_execution_start` where the tool is `read` with path `src/styles.css` or `bash` with command referencing `styles.css`.

| Rep | Old (wrong) | Corrected |
|-----|------------:|----------:|
| 1 | 15 | **3** |
| 2–5 | 5 each | **1 each** |
| **Total** | **35** | **7** |

Behavioral finding unchanged and strengthened: **every agent (5/5) attempted stylesheet inspection**; deterministic guards blocked all successful reads.

### 2. Inline style detection

**Wrong:** count `style={{` only in ledger write/edit tool output during the run (`inline_style_edits`).

**Correct:** scan **final** `app/src/**/*.tsx` on disk after the run. Pi may introduce inline styles in edits that the ledger classifier misses, or remove them later (rep 5).

| Rep | Ledger `inline_style_edits` | Final `inline_style_count` |
|-----|----------------------------:|---------------------------:|
| 1 | 0 | **10** |
| 2 | 0 | 0 |
| 3 | 0 | **5** |
| 4 | 0 | 0 |
| 5 | 0 | 0 |

---

## What v1.1 fixed vs v1

| Issue | v1 | v1.1 |
|-------|----|----|
| Full stylesheet read | rep 4 @ 24.5 KB | **0 bytes** |
| Shadow API usage | rep 4 | **0/5** |
| Stylesheet inspect | advisory only | **blocked** (read/write/bash) |
| Tail weighted | 86k max | **68k max** |
| Inline styling | not measured correctly | **2/5 substantive** (new finding) |

---

## Engineering conclusions

1. **Preinstalled 21-class CSS vocabulary removes stylesheet authoring** — zero CSS written, large pre-VERIFY savings, tighter cost distribution. Mechanism validated across v1 + v1.1.
2. **Deterministic enforcement works** — guards blocked all successful stylesheet reads; no shadow API in v1.1.
3. **Formal floor promotion blocked by two independent failures:** inline JSX styling (2/5) and persistence (3/5). Neither is fixed by another CSS vocabulary tweak alone.
4. **Rep 3 confirms Q2** — after CSS cost is removed, test-authoring/repair dominates expensive runs; hollow persistence tests let bad patterns pass VERIFY.
5. **Reps 1–2 show the treatment can ship usable apps** when Pi picks safe persistence patterns — but 3/5 failure rate is unacceptable for a control floor.

### Recommended next steps

1. **Do not promote CSS vocabulary to v2.3** on this cohort.
2. **Q2 next** — persistence test patterns, harness-owned collection store, or stricter VERIFY persistence checks — against v2.2 baseline.
3. If revisiting CSS mechanism later: separate preregistered experiment with inline-style final-source scan in export + optional theme file outside Pi-visible tree.
4. Carry forward the economic signal (~20% median savings) as engineering evidence, not as a formal KEEP claim.

---

## References

- Preregistration: [experiment-css-vocabulary-v1.1-preregistration.md](./experiment-css-vocabulary-v1.1-preregistration.md)
- v1 analysis: [experiment-css-vocabulary-v1-analysis.md](./experiment-css-vocabulary-v1-analysis.md)
- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Export: `artifacts/exports/cohort-css-vocabulary-v1.1-2026-09-01.zip`
