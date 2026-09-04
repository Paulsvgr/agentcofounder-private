# Experiment Q2-C — Test Authoring Guard v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `test-authoring-guard-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-test-authoring-guard-v1-preregistration.md](./experiment-test-authoring-guard-v1-preregistration.md) (Amendment 1)

**Export:** `artifacts/exports/cohort-test-authoring-guard-v1-2026-09-02.zip`  
**Staging:** `artifacts/exports/test-authoring-guard-v1-staging/`

> **Experiment: REVERT. Guard scanner mechanism: PASS.**

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment** | **REVERT** (Primary **A**, **B**, and **D** failed; Primary **C** passed) |
| **Guard scanner mechanism (Primary C)** | **PASS** — scanner executed on **5/5** runs; **0/5** scan errors; **100%** F1–F5 blocking coverage when present; **0/5** pathological >4-block spirals |
| **`test-authoring-guard-v1` extension** | **Validated experiment toggle — NOT promoted to default floor** |
| **Human UX / quality overlay** | **Not required** for formal verdict (Primary A, B, D already fail) |

**Causal treatment tested:** deterministic pre-VERIFY F1–F5 scanner blocking canonical `verify` until patterns clear — **not** template authoring, **not** post-VERIFY repair, **not** storage isolation.

**Root diagnosis:** The guard **fires mechanically** but **substantially increases pre-VERIFY cost** without improving **first-allowed canonical VERIFY** reliability. Blocking Pi before VERIFY triggers expensive context-heavy test rewrites; after paying that cost, **4/5** first allowed VERIFYs still failed.

**Not authorized by this document:** promoting F6 to blocking, expanding F1/F5 to cover domain literals or named-role ambiguity, or rerunning a “stricter guard” variant. **No next Q2 treatment is selected here.**

---

## Formal result (frozen prereg gates)

| Gate | Metric | v2.2 control | Q2-C | Threshold | Result |
|------|--------|-------------:|-----:|-----------|--------|
| **A** | `first_allowed_canonical_verify_pass` | **1/5** | **1/5** (rep 2 only) | **≥ 3/5** | ❌ |
| **A** | Median `guard_blocks_before_first_allowed_verify` | **0** | **2** | **≤ 2** | ✅ |
| **B** | `pre_verify_weighted_to_first_allowed` (median) | **~36,200** | **84,521** | **≤ 45,000** | ❌ (**5/5** over) |
| **C** | Scanner executes before first allowed VERIFY | — | **5/5** | **5/5** | ✅ |
| **C** | `guard_scan_error` | — | **0/5** | **0/5** | ✅ |
| **C** | F1–F5 blocking coverage when present | — | **100%** (8/8 blocks) | **100%** | ✅ |
| **C** | Reps with **> 4** guard blocks before first allowed | — | **0/5** | **≤ 1/5** | ✅ |
| **D** | Median weighted | **60,852** | **132,778** | **≤ 70,000** | ❌ |
| **D** | Runs **> 140k** | **0/5** | **2/5** (reps 1, 4) | **0/5** | ❌ |

Primary **A** fails on first-allowed pass rate. Primary **B** and **D** fail on cost. Primary **C** passes all four mechanism criteria. Verdict is **REVERT** per frozen verdict table.

---

## Cohort table (5 reps)

| Rep | Run ID | Weighted | Calls | Guard blocks (pre-allowed) | Patterns | First allowed VERIFY | Pre-VERIFY → allowed | VERIFY fails | Journeys | `result.json` |
|-----|--------|----------:|------:|-----------------------------:|----------|----------------------|----------------------:|-------------:|---------:|----------------|
| 1 | `2026-09-01T23-23-10-013Z` | 132,778 | 26 | 2 | F2, F5 | **FAIL** 8/9 | 95,221 | 1 | 9 | success |
| 2 | `2026-09-01T23-26-24-352Z` | 87,454 | 21 | 2 | F2×2 | **PASS** 8/8 | 60,903 | 0 | 8 | success |
| 3 | `2026-09-01T23-28-52-670Z` | 160,335 | 33 | 2 | F2×2 | **FAIL** 5/8 | 84,521 | 4 | 8 | success |
| 4 | `2026-09-01T23-33-08-008Z` | **257,897** | **47** | 1 | F2 | **FAIL** 13/21 | **162,787** | 1 | **21** | success |
| 5 | `2026-09-01T23-38-35-782Z` | 91,522 | 18 | 1 | F2 | **FAIL** 6/10 | 68,929 | 1 | 10 | success |

**Experiment script:** **5/5** OK  
**Harness vitest/build/dev:** **5/5** passed on all reps  
**Median weighted:** **132,778** (87,454 – 257,897)  
**Median calls:** **26** (18 – 47)  
**VERIFY fail before green distribution:** `{0, 1, 1, 1, 4}`  
**First allowed VERIFY pass:** **1/5** (rep 2 only — same rate as v2.2 control)

---

## Comparison: v2.2 control vs Q2-B vs Q2-C

| Metric | v2.2 | Q2 test-isolation | Q2-B verify-repair | **Q2-C guard** |
|--------|-----:|------------------:|-------------------:|---------------:|
| Median weighted | **60,852** | 89,832 | 79,317 | **132,778** |
| Median calls | **16** | 23 | 16 | **26** |
| Median pre-VERIFY to first allowed | **~36,200** | — | ~42,062 | **84,521** |
| First allowed / first VERIFY pass | **1/5** | — | ~1/5 | **1/5** |
| Median VERIFY fails before green | **1** | 1 | 2 | **1** |
| VERIFY fail distribution | 0,1,1,2,2 | 1,1,1,2,3 | 1,1,2,2,2 | **0,1,1,1,4** |
| Runs **> 140k** | **0/5** | 1/5 | 0/5 | **2/5** |
| `result.json` success | 5/5 | 5/5 | **1/5** | **5/5** |

Q2-C is the **most expensive** Q2 arm on median weighted (**+118%** vs v2.2, **+67%** vs Q2-B). It **did not improve** first-allowed VERIFY pass rate vs control. All five apps reached successful harness results — functionality was preserved, but the path there cost substantially more.

\* Q2-B failures were **report-contract** (`tests_run: []`), not app quality.

---

## Cost decomposition — why REVERT is clear

The guard did **not** fail from endless blocking spirals. It failed because **each block triggered expensive Pi repair behavior** before any real VERIFY feedback arrived.

### Pre-allowed spend split (ledger median)

| Phase | Median weighted | Notes |
|-------|----------------:|-------|
| Before first canonical verification attempt (trajectory) | **~42,140** | Comparable to v2.2 pre-VERIFY (~36.2k); modest bucket-1 overhead |
| Cumulative at **first guard BLOCK** | **~50,882** | First `verify` call hits scanner |
| **Guard/fix cycles** (first BLOCK → first allowed VERIFY) | **~33,640** | Pi rewrites tests after compact BLOCK messages |
| **Total** `pre_verify_weighted_to_first_allowed` | **84,521** | **5/5** reps exceed 45k gate |

```text
Run start
    ↓  ~42k median — product + test authoring (bucket 1)
First verify attempt → guard BLOCK
    ↓  ~34k median — guard/fix rewrite cycles (8 blocks total across cohort)
First allowed canonical VERIFY
    ↓  4/5 still FAIL (RTL / TestingLibraryElementError)
```

**Key finding:** Only **8 guard blocks** across the full cohort (**7× F2**, **1× F5**). The problem is **not** pathological block loops (0/5 reps with >4 blocks). The problem is that **each block buys expensive context-heavy rewriting** without reliably preventing the real VERIFY failures that follow.

### vs v2.2 control

| Metric | v2.2 | Q2-C | Δ |
|--------|-----:|-----:|--:|
| Median weighted | 60,852 | 132,778 | **+118%** |
| Median calls | 16 | 26 | **+63%** |
| Median pre-VERIFY to first allowed | ~36,200 | 84,521 | **+133%** |

---

## Primary A — first allowed VERIFY pass rate

### VERIFY sequences (first allowed canonical run)

| Rep | First allowed outcome | Failure mode |
|-----|----------------------|--------------|
| 1 | FAIL 8/9 | `TestingLibraryElementError` — one repair cycle to green |
| 2 | **PASS** 8/8 | Clean — only rep with first-allowed pass |
| 3 | FAIL 5/8 | `TestingLibraryElementError` — **4** VERIFY fails before green |
| 4 | FAIL 13/21 | `TestingLibraryElementError` — large suite, 8 failed tests |
| 5 | FAIL 6/10 | RTL / `document not to contain element` — 4 failed tests |

**Rep 2** is the sole success: guard blocked **2× F2**, Pi fixed, first allowed VERIFY passed with **0** subsequent VERIFY fails.

**Reps 1, 3, 5** follow the familiar Q2 pattern: guard clears F2/F5, first real VERIFY still hits brittle selectors.

**Gate A fails:** **1/5** first-allowed pass vs **≥3/5** required — **no improvement** over v2.2 control (**1/5**).

---

## Primary B — pre-VERIFY cost

| Rep | `pre_verify_weighted_to_first_allowed` | Guard blocks | Over 45k? |
|-----|----------------------------------------:|-------------:|:---------:|
| 1 | 95,221 | 2 | yes |
| 2 | 60,903 | 2 | yes |
| 3 | 84,521 | 2 | yes |
| 4 | 162,787 | 1 | yes |
| 5 | 68,929 | 1 | yes |

**Median:** **84,521** vs gate **≤ 45,000** — **5/5** reps fail.

Guard/fix cycles account for roughly **~34k** median incremental spend after the first BLOCK. That overhead alone nearly meets the entire pre-VERIFY budget gate — before counting bucket-1 product work.

---

## Primary C — guard scanner mechanism

| Criterion | Result |
|-----------|--------|
| Scanner executes on first `verify` per rep | **5/5** |
| `guard_scan_error` | **0/5** |
| F1–F5 hits blocked (no VERIFY bypass) | **100%** — 8 blocks for 8 blocking-pattern detections |
| Reps with **> 4** blocks before first allowed | **0/5** |
| BLOCK message bounded (≤512 chars) | **Yes** — compact `guard_result: BLOCKED` + violation + file:line + hint |

### Pattern distribution (cohort)

| Pattern | Blocks | Mode |
|---------|-------:|------|
| F2 (`bare_getByText_regex`) | **7** | blocking |
| F5 (`bare_getByRole_interactive`) | **1** | blocking |
| F1, F3, F4 | **0** | — |
| F6 (report-only) | **0** blocks; **3** hits in final app sources (reps 2, 5) | report-only |

F1/F3/F4 never fired — Pi already avoids the worst short literals, debug sidecars, and global text matchers in this cohort. F6 remained report-only per Amendment 1; it did not block patterns that still caused VERIFY failures.

**Primary C: PASS.** Mechanism works as designed. Experiment still **REVERT** because mechanism reliability does not compensate for A/B/D failures.

---

## Primary D — total cost non-regression

| Rep | Weighted | Over 70k? | Over 140k? |
|-----|----------:|:---------:|:----------:|
| 1 | 132,778 | yes | no |
| 2 | 87,454 | yes | no |
| 3 | 160,335 | yes | yes |
| 4 | 257,897 | yes | yes |
| 5 | 91,522 | yes | no |

**Median weighted:** **132,778** vs **≤ 70,000** — fail.  
**Runs > 140k:** **2/5** vs **0/5** — fail.

---

## Rep 4 post-mortem — second Q2 problem (bucket 1)

Rep 4 is the cohort tail and illustrates a **distinct failure mode** from guard spirals:

| Signal | Value |
|--------|------:|
| Weighted | **257,897** (highest in cohort) |
| Calls | **47** |
| Journey tests at first allowed VERIFY | **21** |
| Guard blocks before first allowed | **1** (F2 only) |
| Pre-VERIFY to first allowed | **162,787** |
| First allowed VERIFY | **FAIL** 13/21 (8 failed) |
| VERIFY fails before green | **1** |

**Classification:** **Bucket 1 — oversized test suite before any feedback.** Pi authored **21** journey tests across **47** model calls before the first allowed VERIFY ran. The guard intervened only once; the dominant cost is **unbounded pre-VERIFY product + test authoring**, not guard blocking loops.

This pattern may matter **more for what to test next** than tightening F2/F5/F6 rules. A guard that blocks on pattern violations does not cap suite size or force early VERIFY feedback when Pi never triggers a blockable pattern.

---

## What Q2-C proved vs did not prove

| Claim | Evidence |
|-------|----------|
| Deterministic F1–F5 scanner can intercept `verify` before vitest | **Yes** — 8 blocks, 0 crashes, compact messages |
| Guard reduces first-allowed VERIFY failure rate vs v2.2 | **No** — **1/5** vs **1/5** |
| Guard holds pre-VERIFY cost | **No** — median **84.5k** vs **36.2k** control (+133%) |
| Guard non-regresses total cost | **No** — median **132.8k** (+118% vs v2.2) |
| More pre-VERIFY blocking rules fix brittle tests | **No evidence** — blocks triggered expensive rewrites; 4/5 first allowed VERIFYs still failed |
| F6 report-only misses real failure modes | **Yes** — F6 hits present at run end (reps 2, 5); not blocking by design |
| All reps complete harness successfully | **Yes** — **5/5** `result.json` success (vs Q2-B **1/5**) |

---

## Q2 program conclusions (frozen)

Three Q2 harness arms are now **closed** with a converging diagnosis:

```text
Q2 test-isolation        → REVERT (storage not the bottleneck)
Q2-B verify-repair       → REVERT (post-failure coaching worsens cost)
Q2-C test-authoring-guard → REVERT (pre-VERIFY blocking worsens cost)
```

**What did not solve brittle journey tests:**

| Intervention | Arm | Outcome |
|--------------|-----|---------|
| Prompt RTL guidance (Exp3) | v2.2 baseline | insufficient alone |
| Storage isolation (`memoryStorage`) | Q2 test-isolation | mechanism PASS; no trajectory gain |
| Post-VERIFY structured FAIL + repair prompt | Q2-B | VERIFY→PASS ~2.2× worse |
| Static pre-VERIFY F1–F5 guard | Q2-C | fires; +118% median cost; same 1/5 first-allowed pass |

**Narrowed problem:** brittle RTL/test authoring before VERIFY — including **oversized suites written before any feedback** (rep 4) and **selector patterns outside F1–F5** (F6 report-only, domain literals, named-role ambiguity).

**Engineering actions from this document:**

1. **Formal experiment: REVERT** on frozen prereg (Primary A, B, D).
2. **Do not promote** `HARNESS_TEST_AUTHORING_GUARD_V1` to default floor.
3. **Do not authorize** F6 promotion to blocking, domain-literal expansion, or named-role F5 expansion based on this cohort — evidence points **against** more pre-VERIFY blocking as the architecture.
4. **Preserve** `test-authoring-guard-v1` code as optional experiment toggle for reproducibility.
5. **No next treatment selected** in this document. Future arms should consider **who controls the testing process** rather than additional static rules for Pi — but that direction is **not preregistered here**.

---

## Secondary outcomes (report only)

| Metric | v2.2 | Q2-C |
|--------|-----:|-----:|
| Median VERIFY fails before green | 1 | 1 |
| `report.partial.json` / `tests_run: []` rate | low | **0/5** omissions (all reps success) |
| Median VERIFY → first canonical PASS | ~12,400 | not computed as gate — rep 3 tail (4 fails) elevated |

Q2-C incidentally improved harness finalization vs Q2-B (5/5 success). That is **orthogonal** to the guard hypothesis and does not change REVERT.

---

## References

- Preregistration: [experiment-test-authoring-guard-v1-preregistration.md](./experiment-test-authoring-guard-v1-preregistration.md)
- Prior Q2 arms: [experiment-q2-test-isolation-v1-analysis.md](./experiment-q2-test-isolation-v1-analysis.md), [experiment-q2-verify-repair-v1-analysis.md](./experiment-q2-verify-repair-v1-analysis.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Cohort summary script: `scripts/summarize-test-authoring-guard-cohort.ts`
- Export: `artifacts/exports/cohort-test-authoring-guard-v1-2026-09-02.zip`

---

**STOP** — analysis frozen. No implementation changes. No new experiment preregistration in this document.
