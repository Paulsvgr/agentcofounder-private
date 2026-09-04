# Experiment Q2-D — Early VERIFY v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `q2-early-verify-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-q2-early-verify-v1-preregistration.md](./experiment-q2-early-verify-v1-preregistration.md)

**Export:** `artifacts/exports/cohort-q2-early-verify-v1-2026-09-02.zip`  
**Official run log:** `artifacts/experiments/q2-early-verify-v1/2026-09-02T07-43-17Z.log`  
**Excluded preflight (audit only):** `2026-09-02T07-42-*` ×5 — extension JSDoc parse error, 0 calls each

> **Experiment: REVERT. Early VERIFY mechanism: PASS.**

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment** | **REVERT** (Primary **A**, **D**, and **E** failed; Primary **B** and **C** passed) |
| **Early VERIFY mechanism (Primary C)** | **PASS** — auto VERIFY fired **5/5**; exactly one `auto_early_v1` per run; first post-mutation canonical VERIFY on **5/5**; **0/5** harness errors |
| **`early-verify-v1` extension** | **Validated experiment toggle — NOT promoted to default floor** |
| **Human UX / quality overlay** | **Not scored** (`app_rating` / `ux_rating` absent on all reps) |

**Causal treatment tested:** one automatic canonical VERIFY immediately after first filesystem test mutation — **timing only**; no test caps, guards, scaffolding, or harness-owned test structure.

**Root diagnosis:** The timing mechanism works exactly as designed (zero call span between mutation and feedback), but Pi writes the **whole test suite in the first monolithic `App.test.tsx` write**. Auto VERIFY therefore fires **after** the large suite already exists and cannot compress suite size or total cost versus v2.2.

**Not authorized by this document:** promoting `HARNESS_EARLY_VERIFY_V1` default-on, or rerunning “earlier timing” variants. **Next lever (separate prereg):** control the first monolithic test write / harness-owned test structure — not more feedback-timing experiments.

---

## Formal result (frozen prereg gates)

| Gate | Metric | v2.2 control (retro) | Q2-D | Threshold | Result |
|------|--------|----------------------:|-----:|-----------|--------|
| **A** | Median `authored_test_count_at_first_post_mutation_verify` | **8** | **10** | **≤ 6** and ≤ control | ❌ |
| **A** | Median `test_loc_at_first_post_mutation_verify` | **171** | **189** | **≤ 120** and ≤ control | ❌ |
| **B** | Median `weighted_mutation_to_first_post_mutation_verify` | **~8,929** | **0** | **≤ 5,000** | ✅ |
| **B** | Median call span (mutation → post-mutation VERIFY) | **1** | **0** | **≤ 1** | ✅ |
| **C** | Mechanism (5 criteria) | — | **5/5** | all pass | ✅ |
| **D** | Median weighted | **60,852** | **97,328** | **≤ 70,000** | ❌ |
| **D** | Runs **> 140k** | **0/5** | **2/5** (reps 2, 3) | **0/5** | ❌ |
| **E** | Median post-mutation VERIFY → first canonical PASS | **12,400** | **43,203** | **≤ 18,600** | ❌ |

Primary **A**, **D**, and **E** fail. Primary **B** and **C** pass. Verdict is **REVERT** per frozen verdict table.

Control anchor metrics reconstructed from events replay (source-derived parser; see prereg Amendment / retro script).

---

## Cohort table (official 5 reps)

| Rep | Run ID | Weighted | Calls | Authored @ anchor | LOC @ anchor | Span | Auto outcome | VERIFY fails → green | Post-mut → PASS wt | Canon. after mut | Journeys | Harness |
|-----|--------|----------:|------:|------------------:|-------------:|-----:|--------------|---------------------:|-------------------:|-----------------:|---------:|---------|
| 1 | `2026-09-02T07-43-21-803Z` | 91,076 | 18 | 10 | 179 | 0 | FAIL (suite_error) | 2 | 36,489 | 4 | 11 | success |
| 2 | `2026-09-02T07-48-39-238Z` | **246,673** | **37** | 11 | 241 | 0 | FAIL (11/11) | **9** | **177,762** | **11** | 11 | success |
| 3 | `2026-09-02T07-55-36-143Z` | **207,133** | 27 | 13 | 231 | 0 | FAIL (4/13) | 2 | 112,361 | 5 | 13 | success |
| 4 | `2026-09-02T08-00-40-390Z` | 97,328 | 16 | 10 | 189 | 0 | FAIL (3/10) | 0 | 43,203 | 2 | 10 | success |
| 5 | `2026-09-02T08-04-39-535Z` | 65,199 | 14 | 7 | 170 | 0 | FAIL (1/7) | 0 | 25,954 | 2 | 7 | success |

**Experiment script:** 5/5 OK (official re-run after comment-only parser fix)  
**Invalid preflight:** 0/5 OK (extension load failure — excluded from statistics)  
**Median weighted:** **97,328** (65,199 – 246,673)  
**VERIFY fail before green distribution:** `{2, 9, 2, 0, 0}` vs v2.2 `{0, 1, 1, 2, 2}`

---

## Key result — monolithic first write defeats timing-only intervention

Pi's first test-file write authored:

```text
10 / 11 / 13 / 10 / 7 tests  (source-derived at anchor)
          ↓
automatic VERIFY fires immediately (call span 0)
          ↓
BUT the large suite already exists
```

Auto VERIFY delivered real vitest output with **zero model calls** between mutation and feedback (Gate **B** pass). It did **not** reduce authored-test count or LOC at the anchor versus v2.2 (Gate **A** fail). Moving VERIFY earlier cannot prevent a problem that is already committed in the first write.

---

## Mechanism deep dive (Primary C — PASS)

All five official reps satisfy every Primary **C** criterion:

| Criterion | Result |
|-----------|--------|
| `first_test_mutation_call` recorded | **5/5** |
| `auto_early_verify_fired` | **5/5** |
| Exactly one `verify_source: auto_early_v1` | **1** per run |
| Auto is first post-mutation canonical VERIFY | **`auto_early_v1` on 5/5** |
| `early_verify_error` | **0/5** |

**Auto VERIFY outcomes (all FAIL — valid per prereg F5; not a C failure):**

| Rep | First auto feedback |
|-----|---------------------|
| 1 | **SUITE_ERROR** — `await` outside async in test file |
| 2 | **11/11 failed** — `vi is not defined` |
| 3 | **4/13 failed** — RTL selector errors |
| 4 | **3/10 failed** — unscoped text collisions |
| 5 | **6/7 failed** — missing `[data-testid="book-list"]` |

Anchor call index **equals** mutation call index on all reps (span **0**): auto fires in the same ledger call as the completing write/edit tool.

---

## Primary A — suite size at first feedback (FAIL)

| Rep | Authored @ anchor | Run-end authored | Pattern |
|-----|------------------:|-----------------:|---------|
| 1 | 10 | 10 | Full suite in first write |
| 2 | 11 | 11 | Full suite in first write |
| 3 | 13 | 13 | Full suite in first write |
| 4 | 10 | 10 | Full suite in first write |
| 5 | 7 | 7 | Smallest; still above absolute cap (6) |

Treatment median **10** vs control **8** — worse on both absolute caps and relative gate.

---

## Primary B — mutation-to-feedback cost (PASS)

| Metric | Control | Treatment |
|--------|--------:|----------:|
| Median weighted mutation → post-mutation VERIFY | ~8,929 | **0** |
| Median call span | 1 | **0** |

Auto VERIFY is synchronous in the extension hook; no extra Pi turn between mutation and vitest output. Gate **B** passes decisively.

---

## Primary D & E — cost regression (FAIL)

### Total cost (D)

| | v2.2 | Q2-D |
|--|-----:|-----:|
| Median weighted | 60,852 | **97,328** (+60%) |
| Runs > 140k | 0/5 | **2/5** |

Rep 2 (246,673) and rep 3 (207,133) drive the >140k failure. Rep 2 also dominates repair blowup (37 calls, 11 post-mutation canonical VERIFYs).

### Repair phase (E)

| Rep | Post-mutation anchor → first canonical PASS (weighted) |
|-----|-------------------------------------------------------:|
| 1 | 36,489 |
| 2 | 177,762 |
| 3 | 112,361 |
| 4 | 43,203 |
| 5 | 25,954 |
| **Median** | **43,203** (gate ≤ 18,600; ~3.5× v2.2 ~12,400) |

Early FAIL feedback did not shorten the VERIFY repair loop; rep 2 suggests extended thrashing after a fixable first auto failure.

---

## Secondary outcomes (report only)

| Metric | v2.2 | Q2-D median | Notes |
|--------|-----:|------------:|-------|
| Run-end authored tests | 8 | **10** | No run-end compression |
| Run-end journeys | 8 | **11** | Slightly larger final suites |
| Canonical VERIFY after first mutation | — | **4** | Extra VERIFY tax on some reps |
| VERIFY fail before green | 1 | **2** | Worse; rep 2 = 9 |
| Median calls | 16 | **18** | +2 |

---

## Comparison: v2.2 vs Q2 arms

| Metric | v2.2 | Q2 test-isolation | Q2-B verify-repair | Q2-C test-authoring-guard | **Q2-D early-verify** |
|--------|-----:|------------------:|-------------------:|------------------------:|----------------------:|
| Median weighted | 60,852 | 89,832 | 79,317 | 132,778 | **97,328** |
| Mechanism layer | — | PASS | PARTIAL PASS | PASS | **PASS** |
| Experiment | baseline | REVERT | REVERT | REVERT | **REVERT** |

Q2-D **again shows a mechanism can work exactly as designed while failing to improve the experimental outcome** — same pattern as [Q2 test-isolation](./experiment-q2-test-isolation-v1-analysis.md) (mechanism PASS) and [Q2-C test-authoring-guard](./experiment-test-authoring-guard-v1-analysis.md) (mechanism PASS). Timing-only early VERIFY does not beat v2.2 on cost or suite-size gates.

---

## Harness success vs browser runtime crash (Rep 4 — report only)

Rep 4 (`2026-09-02T08-00-40-390Z`) can throw in the browser:

```text
Uncaught TypeError: Cannot read properties of undefined (reading 'trim')
```

**Cause:** `isLent()` checks `borrowedBy !== null` then calls `.trim()`. Persisted JSON with **missing** `borrowedBy` yields `undefined !== null → true` → crash on render.

**Why harness still reported success:** final `npm test` / build / dev run on the saved app; Vitest clears `localStorage` in `beforeEach` and never exercises malformed persisted state. Pi-declared journeys and harness checks can all pass while manual browsing with stale/corrupt localStorage crashes.

**Classification:** separate robustness / harness blind spot — **not** a reason to change the Q2-D verdict. Preserve for future floor hygiene (localStorage schema validation or runtime console gate).

---

## Invalid preflight batch (audit trail only)

| Run IDs | Cause | Calls |
|---------|-------|------:|
| `2026-09-02T07-42-13-311Z` … `2026-09-02T07-42-51-203Z` | JSDoc glob `**/` prematurely closed block comment; Pi could not load extension | 0 |

Included in export under `runs/q2-early-verify-v1-preflight-invalid/`. **Excluded** from all treatment statistics.

---

## Interpretation (frozen prereg guide)

| Pattern | Implication |
|---------|-------------|
| **C PASS, A/D/E fail → experiment REVERT** | Timing lever validated; stop investing in timing alone; publish mechanism evidence; **do not promote** |
| Monolithic first write + immediate auto FAIL | Early feedback arrives too late to cap suite size |
| Rep 2 repair blowup after `vi is not defined` | Early signal did not prevent expensive VERIFY spirals |
| Rep 4 trim crash + harness success | Orthogonal validation gap |

**Deferred (separate preregs):** test-count cap at first write, harness-owned test structure, localStorage parse hardening.

---

## Q2 program status (after Q2-D close)

| Arm | Mechanism | Experiment |
|-----|-----------|------------|
| Q2 test-isolation | PASS | REVERT |
| Q2-B verify-repair | PARTIAL PASS | REVERT |
| Q2-C test-authoring-guard | PASS | REVERT |
| **Q2-D early-verify** | **PASS** | **REVERT** |

**Q2-D is closed.**
