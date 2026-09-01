# Control Floor v2.2 — Cost Decomposition

**Status:** FROZEN ANALYSIS  
**Date:** 2026-08-31  
**Baseline:** Control Floor v2.2  
**Cohort:** VERIFY v1.1 / v2.2 locked cohort  
**Runs:** 5  
**Baseline median weighted cost:** ~60.9k

## Purpose

Understand where v2.2 still spends weighted tokens after Harness-owned VERIFY v1.1 was promoted to baseline.

This is an analysis of the existing frozen cohort only.

No new Pi runs.  
No treatment changes.  
No new experiment is selected here.

---

## Method

Cost is decomposed using:

- call-ledger weighted cost
- Metrics v2 trajectory boundaries
- raw session/event inspection where classification was needed

Primary phase boundaries:

1. before first canonical VERIFY
2. first VERIFY → first canonical PASS
3. PASS → valid full green
4. post-valid-full-green

Calls were additionally classified by the dominant work performed.

Classification is heuristic: a single model call can contain several tools. Categories are mutually exclusive and sum to the run total.

---

## Locked cohort (run IDs)

| Rep | Run ID | Weighted | Calls |
|-----|--------|----------|-------|
| 1 | `2026-08-31T21-16-45-263Z` | 78,009 | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | 60,852 | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | 49,449 | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | 108,708 | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | 50,364 | 12 |

**Log:** `artifacts/experiments/harness-owned-verify-v1.1/2026-08-31T21-16-39Z.log`

---

## Frozen cohort result

Median phase split:

| Phase | Median weighted |
|---|---:|
| Total | **60.9k** |
| Before first VERIFY | **36.2k** |
| First VERIFY → first PASS | **12.4k** |
| PASS → valid full green | **1.3k** |
| Post-valid-full-green | **7.1k** |

VERIFY materially reduced the old failure-repair tail.

The remaining cost is not dominated by repairing broken product code.

---

## Cohort-wide cost composition

Approximate share of total weighted spend across the five v2.2 runs:

| Bucket | Share |
|---|---:|
| Pre-VERIFY product/recon/styling work | **~45%** |
| Test authoring before VERIFY | **~13%** |
| Test / VERIFY loop | **~26%** |
| Actual product repair after VERIFY | **~1%** |
| Build after PASS | **~2%** |
| Post-green work | **~13%** |

Combined:

> **~39% of v2.2 spend is test authoring + test/VERIFY activity.**

Actual product repair after VERIFY accounts for only approximately **1%**.

Pre-VERIFY “core app work” subdivides roughly as:

| Sub-bucket | Share of cohort |
|---|---:|
| App/source implementation | ~24% |
| Styling | ~16% |
| Recon/setup | ~6% |

---

## Primary finding

The old mental model was:

```text
build
→ app fails
→ Pi struggles to understand failure
→ expensive product-repair spiral
```

The v2.2 data supports a more precise model:

```text
build product
→ Pi authors its own tests
→ brittle/ambiguous test fails
→ VERIFY provides authoritative failure
→ Pi repairs test
→ VERIFY again
```

Harness-owned VERIFY has therefore succeeded at its intended job:

**failure observability and feedback are no longer the dominant cost problem.**

The remaining cost is primarily:

1. producing the application before first VERIFY
2. authoring and repairing Pi's own tests

---

## Test brittleness

Across observed FAIL→repair windows, most repairs affected test code rather than product code.

Repeated failure classes included:

- ambiguous `getByText(...)`
- ambiguous `getByRole(...)`
- duplicate labels / duplicated visible values
- overly broad RTL queries
- test syntax/async mistakes

Example class:

```text
Found multiple elements with the text: Title
```

This means a significant part of the remaining VERIFY-loop cost is caused by tests Pi created itself.

---

## Tail behaviour

v2.2 no longer has the same single dominant repair-tail seen in v2.1.

The current tail is **multi-causal**.

### Tail class A — Pre-VERIFY cost

Cheap runs reach first VERIFY around ~30k weighted.

The 108.7k tail run spent approximately:

```text
61.4k before first VERIFY
```

This is now its largest individual phase.

### Tail class B — Test/VERIFY repair

The same tail run still spent approximately:

```text
32.9k from first VERIFY to PASS
```

VERIFY compressed this substantially relative to the old v2.1 repair tail, but did not eliminate it.

### Tail class C — Post-green waste

A different run (~60.9k total) had:

- no VERIFY failures before first PASS
- ~44.1k before VERIFY
- ~12.9k after valid full green

Therefore not every expensive trajectory is a test-repair spiral.

Post-green activity must remain a distinct tail category.

---

## What v2.2 established

### KEEP

Harness-owned VERIFY v1.1 remains **KEEP**.

It:

- removes piped test execution
- provides authoritative test exit/result
- compresses severe repair tails
- preserves quality
- reduced baseline median from ~78k (v2.1) to ~60.9k in the locked cohort

### Important consequence

VERIFY did not make Pi produce materially smaller applications.

The improvement came primarily from a shorter and cleaner trajectory.

---

## What this analysis rules out

Do not default back to:

```text
more low-level resources
more component slices
more generic scaffolding
```

Experiments B/C already showed that this class of intervention can increase integration and context cost.

Likewise, the evidence does not currently support failure interpretation as the primary remaining bottleneck.

VERIFY already provides sufficiently clear feedback for Pi to repair most failures correctly.

---

## Open question Q1 — Earlier first VERIFY

Can Pi reach its first authoritative VERIFY with less work while preserving final quality?

Potential cost surface:

```text
recon
planning
source creation
styling
test authoring
→ first VERIFY
```

The tail shows this phase can grow from roughly ~30k to >60k.

No treatment is selected yet.

---

## Open question Q2 — Prevent brittle tests

Can Pi author robust journey tests initially instead of writing tests that immediately require repair?

Current causal chain:

```text
test authoring
→ broad/ambiguous RTL selector
→ authoritative VERIFY FAIL
→ test inspection
→ test edit
→ VERIFY again
```

This is narrower than the rejected B/C resource approach.

The target would be **test-authoring behaviour**, not general UI scaffolding.

No treatment is selected yet.

---

## Baseline for next experiment

All future experiments compare against frozen v2.2:

```text
Median weighted: ~60.9k
Quality: 5/5
Tail >120k: 0/5
```

Useful decomposition reference:

```text
~45% pre-VERIFY product/recon/styling
~39% test authoring + test/VERIFY
~13% post-green
~2% build after PASS
~1% actual product repair
```

The next preregistration should state which of these cost surfaces the treatment is intended to change.

---

## Decision

**FREEZE THIS ANALYSIS.**

Do not modify v2.2.

Do not start another run.

Do not choose a treatment inside this document.

Next step:

```text
Q1 or Q2
→ candidate intervention
→ preregistration
→ review
→ implementation
→ 5-run experiment
→ KEEP / REVERT
```

---

## Related docs

- [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md) — active baseline definition
- [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md) — promotion verdict
- [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) — phase boundary spec
