# Experiment Q2-B — VERIFY Repair v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `q2-verify-repair-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-q2-verify-repair-v1-preregistration.md](./experiment-q2-verify-repair-v1-preregistration.md) (Amendment 1)

**Export:** `artifacts/exports/cohort-q2-verify-repair-v1-2026-09-02.zip`  
**Run log:** `artifacts/experiments/q2-verify-repair-v1/2026-09-01T22-06-20Z.log`

> **Experiment: REVERT. Structured FAIL mechanism: PARTIAL PASS (deployed, not trajectory-compressive).**

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment** | **REVERT** (Primary A failed on all four gates; cost non-regression failed) |
| **Primary B (bash escape compliance)** | **PASS** — **0/5** piped; **0/5** non-canonical test bash before first green ([Amendment 1](./experiment-q2-verify-repair-v1-preregistration.md#amendment-1-2026-09-01-pre-run) — not comparative vs control) |
| **Structured FAIL + repair-first prompt** | **PARTIAL PASS** — `failure_class:` observed on suite-error FAIL; RTL FAIL summaries still dominated by `TestingLibraryElementError`; **no VERIFY→PASS compression** |
| **Human UX / quality overlay** | **Not required** for formal verdict |

**Causal treatment tested:** structured VERIFY FAIL output + repair-first-test orchestration prompt — **not** test-command blocking (already baseline).

**Root cause of VERIFY failures (unchanged):** `TestingLibraryElementError` / brittle journey selectors — repair orchestration did not shorten the loop.

---

## Formal result (frozen prereg gates)

| Metric | Control v2.2 | Q2-B | Gate |
|--------|-------------:|-----:|------|
| Median weighted | **60,852** | **79,317** | ❌ ≤70k |
| Runs **>140k** | **0/5** | **0/5** | ✅ |
| Median calls | **16** | **16** | same |
| Median `verify_fail_before_first_canonical_green` | **1** | **2** | ❌ ≤1 |
| VERIFY fails, distribution | **0, 1, 1, 2, 2** | **1, 1, 2, 2, 2** | ❌ worse (0 clean runs) |
| Runs with **0** VERIFY fails | **1/5** | **0/5** | ❌ needed ≥2/5 |
| Runs with **≥2** VERIFY fails | **2/5** | **3/5** | ❌ needed ≤1/5 |
| Median VERIFY → first canonical PASS | **12,400** | **27,089** | ❌ ≤12,400 (~2.2× worse) |
| Primary B piped / non-canonical bash | — | **0/5** | ✅ compliance only |

Primary **A** fails on **median verify-fail count**, **distribution shape**, and **VERIFY→PASS phase cost**. Cost guardrail fails on median weighted. Verdict is **REVERT** without quality overlay.

---

## Cohort table (5 reps)

| Rep | Run ID | Weighted | Calls | VERIFY fails | VERIFY tools | VERIFY→PASS | piped | Harness `result.json` | Journeys |
|-----|--------|----------:|------:|-------------:|-------------:|------------:|------:|----------------------|----------|
| 1 | `2026-09-01T22-06-25-887Z` | 73,742 | 13 | 1 | 2 | 26,793 | 0 | **failed** | 0 |
| 2 | `2026-09-01T22-08-29-987Z` | 79,317 | 16 | 2 | 3 | 23,037 | 0 | **failed** | 0 |
| 3 | `2026-09-01T22-11-08-817Z` | 86,771 | 19 | 2 | 3 | 41,620 | 0 | **success** | 8 |
| 4 | `2026-09-01T22-13-29-071Z` | 101,312 | 14 | 1 | 2 | 27,089 | 0 | **failed** | 0 |
| 5 | `2026-09-01T22-16-29-462Z` | 59,644 | 11 | 2 | 3 | 27,161 | 0 | **failed** | 0 |

**Experiment script:** 1/5 OK (rep 3 only)  
**Harness vitest/build/dev:** 5/5 passed on all reps  
**Median weighted:** **79,317** (59,644 – 101,312)  
**VERIFY fail distribution:** `{1, 1, 2, 2, 2}`

---

## Comparison: v2.2 control vs Q2-B vs Q2 test-isolation

| Metric | v2.2 | Q2 test-isolation | Q2-B |
|--------|-----:|------------------:|-----:|
| Median weighted | 60,852 | 89,832 | **79,317** |
| Median VERIFY fails | 1 | 1 | **2** |
| VERIFY fail distribution | 0,1,1,2,2 | 1,1,1,2,3 | **1,1,2,2,2** |
| 0-fail reps | 1/5 | 0/5 | **0/5** |
| ≥2-fail reps | 2/5 | 2/5 | **3/5** |
| Median VERIFY→PASS | **12,400** | 30,600 | **27,089** |
| Median calls | 16 | 23 | **16** |

Q2-B is **cheaper than Q2 test-isolation** on median weighted but **still worse than v2.2** on repair phase and verify-fail shape. VERIFY→PASS sits between control and test-isolation — **no improvement** over baseline.

---

## Primary A — trajectory deep dive

### VERIFY sequences (canonical)

| Rep | Sequence | Failure mode |
|-----|----------|--------------|
| 1 | FAIL 5/7 → PASS 7/7 | RTL (`TestingLibraryElementError`) — one repair cycle |
| 2 | FAIL 5/8 → FAIL 6/8 → PASS 8/8 | RTL — two FAIL cycles before green |
| 3 | FAIL 3/8 → **FAIL 0/0 suite_error** → PASS 8/8 | RTL then **transform/syntax** break mid-repair, then green |
| 4 | FAIL 15/17 → PASS 17/17 | RTL — large suite, one repair cycle |
| 5 | FAIL 4/6 → FAIL 5/6 → PASS 6/6 | RTL — two FAIL cycles |

All reps reached canonical PASS via the `verify` tool only (**0/5** piped or partial vitest bash — Primary B compliance).

### Phase split (ledger median)

| Phase | v2.2 median | Q2-B median |
|-------|------------:|------------:|
| Before first VERIFY | ~36,200 | ~42,062 |
| VERIFY → first canonical PASS | **~12,400** | **~27,089** |
| Total weighted | ~60,852 | ~79,317 |

The treatment **did not compress bucket 2**. Pre-VERIFY spend is slightly higher but not the primary gate failure.

### Why structured FAIL did not help

| Observation | Implication |
|-------------|-------------|
| `failure_class:` prefix visible on rep 3 **suite_error** FAIL only | Formatter deploys for some classes; trajectory `raw_summary` for RTL FAILs often starts at `verify exit_code=1` without prefix |
| Failures remain `TestingLibraryElementError` | Pi still writes/fixes brittle queries; hints did not change authoring or repair strategy enough |
| Rep 3 mid-repair **suite_error** (0/0) | Repair-first-test policy did not prevent a bad edit that broke the suite — extra VERIFY cycle (+ cost) |
| No `≥2/5` clean runs | Distribution **worse** than control on zero-fail count; **worse** on ≥2 tail (3/5 vs 2/5) |

**Conclusion:** Better FAIL *labels* without upstream test-quality intervention do not reduce repair spirals at n=5.

---

## Primary B — compliance (Amendment 1)

Per Amendment 1, Primary B is **treatment-compliance only**.

| Criterion | Result |
|-----------|--------|
| Non-canonical test bash before first green | **0/5** |
| Piped test bash before first green | **0/5** |

This was **expected** — v2.2 harness-owned VERIFY already blocks these paths. **Do not cite 0/5 as evidence of improvement over control.**

---

## Secondary: report contract failure (4/5 reps)

Four reps ended `result.json` **failed** with `tests_run: []` despite harness vitest/build/dev **passing**.

| Signal | Value |
|--------|-------|
| `summary` | `"The harness did not produce a valid report.partial.json file."` |
| `report.partial.json` in run snapshot | **absent** on reps 1, 2, 4, 5 |
| Rep 3 | Wrote valid `report.partial.json` with 8 `tests_run` entries → **success** |

**Classification:** **Harness completion / report-contract failure** — orthogonal to VERIFY repair hypothesis. Pi reached green VERIFY and passed independent harness checks but **did not emit** `report.partial.json` before session end on 4/5 runs.

This does **not** change the formal REVERT (Primary A and cost already fail). It **does** reduce usable journey-quality signal from this cohort and should be tracked as a separate observability issue.

---

## Cost deep dive

| Rep | Dominant activity (weighted share) | Notes |
|-----|-----------------------------------|-------|
| 1 | mixed 51%, source 19% | Pre-VERIFY heavy; 1 VERIFY repair cycle |
| 2 | mixed 46%, source 20%, css 15% | Two VERIFY fails |
| 3 | mixed 37%, other 21%, css 12% | Longest run (19 calls); suite_error detour |
| 4 | mixed 42%, source 19%, finalize 16% | 17-journey suite; highest weighted (101k) |
| 5 | mixed 67%, other 23% | Shortest weighted (60k) but 2 VERIFY fails |

No rep >140k. Tail rep 4 (101k) is **large journey suite + pre-VERIFY build**, not a VERIFY-only spiral.

---

## What Q2-B proved vs did not prove

| Claim | Evidence |
|-------|----------|
| Structured FAIL can be prepended to VERIFY output | **Yes** — `failure_class: suite_error` on rep 3 |
| Structured FAIL + repair prompt reduces VERIFY→PASS vs v2.2 | **No** — median **27,089** vs **12,400** |
| VERIFY-fail distribution improves | **No** — 0/5 clean; 3/5 ≥2 fails |
| Median weighted improves vs v2.2 | **No** — +30% |
| Bash escape blocking adds value over baseline | **No** — Amendment 1; already baseline |
| Test-command blocking was the active lever | **No** — causal lever was feedback + prompt |
| Upstream test authoring fixed | **No** — RTL errors persist; **test-authoring-v1** still needed |

---

## Engineering conclusions (frozen)

1. **Formal experiment: REVERT** on frozen prereg (Primary A + cost).
2. **Do not promote** `HARNESS_VERIFY_REPAIR_V1` to default floor.
3. **Do not** run another repair-orchestration-only arm without a new hypothesis (structured hints alone insufficient).
4. **Next Q2 candidate:** **`test-authoring-v1`** template overlay (AGENTS + query helpers) — separate prereg; addresses upstream selector quality, not post-fail coaching.
5. **Preserve** `verify-repair-v1` code as optional experiment toggle; consider fixing trajectory capture so `failure_class:` appears consistently in `raw_summary` for post-hoc analysis.
6. **Track** `report.partial.json` omission rate — 4/5 is abnormally high for this cohort.

---

## References

- Preregistration: [experiment-q2-verify-repair-v1-preregistration.md](./experiment-q2-verify-repair-v1-preregistration.md)
- Prior Q2 arm: [experiment-q2-test-isolation-v1-analysis.md](./experiment-q2-test-isolation-v1-analysis.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Export: `artifacts/exports/cohort-q2-verify-repair-v1-2026-09-02.zip`
- Staging: `artifacts/exports/q2-verify-repair-v1-staging/`
