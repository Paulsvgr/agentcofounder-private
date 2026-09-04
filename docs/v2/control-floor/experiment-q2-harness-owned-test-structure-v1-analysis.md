# Experiment Q2-E — Harness-owned test structure v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `q2-harness-owned-test-structure-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-q2-harness-owned-test-structure-v1-preregistration.md](./experiment-q2-harness-owned-test-structure-v1-preregistration.md)

**Export:** `artifacts/exports/cohort-q2-harness-owned-test-structure-v1-2026-09-02.zip`  
**Official run log:** `artifacts/experiments/q2-harness-owned-test-structure-v1/2026-09-02T09-33-38Z.log`  
**Quality scores:** control-app runs overlay (`artifacts/runs-overlay.json`), author **paul**, scored 2026-09-02

> **Experiment: REVERT. Test-structure mechanism: PASS.**

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment (Layer 2)** | **REVERT** — Primary **D** and **F** failed (F-journey); Primary **A** partially unevaluable (Rep 5 F5) |
| **Test-structure mechanism (Layer 1 / Primary C)** | **PASS** — 0-test skeleton seeded on **5/5**; guard active; **6/6** rejections restored; **0/5** harness errors |
| **`harness-owned-test-structure-v1` extension** | **Validated experiment toggle — NOT promoted to default floor** |
| **Human quality overlay (Gate F-quality)** | **PASS** — median `app_rating` **70**; all reps `usability_ux` **≥ 27** (does not overturn D / F-journey failures) |

**Causal treatment tested:** harness seeds `src/App.test.tsx` with **0** authored tests; post-tool filesystem guard enforces Δ ∈ {0, +1} and single qualifying file; no auto VERIFY; no Q2-B/C/D overlays.

**Root diagnosis:** E2 **successfully blocks** the initial 7–14-test monolithic first write on **5/5** reps, but Pi adapts via **heavy incremental authoring** (guard-rejection tax). Total cost **explodes** (median **148,748** weighted; **4/5** runs **>140k**) and journey coverage **regresses** (median **7** vs control **8**; Rep 5 = **1** Vitest journey). The monolith is replaced by call tax, not compressed early feedback.

**Rep 5 observability defect:** frozen brace-balanced parser failed to count one real `it()` test; anchor telemetry null (F5). Does **not** rescue the experiment — recorded on the scientific record.

**Not authorized by this document:** parser fix, cohort rerun, Rep 5 replacement, prereg amendment, or promoting `HARNESS_OWNED_TEST_STRUCTURE_V1` default-on.

---

## Formal result (frozen prereg gates)

| Gate | Metric | v2.2 control (frozen) | Q2-E (5-run cohort) | Threshold | Result |
|------|--------|----------------------:|--------------------:|-----------|--------|
| **A** | Median `authored_test_count_at_anchor` | **8** | **Partially unevaluable** — Rep 5 F5; 4/5 anchors defined | **≤ 6** and ≤ control | ⚠️ **Partially unevaluable** |
| **A** | Median `test_loc_at_anchor` | **171** | Same | **≤ 120** and ≤ control | ⚠️ **Partially unevaluable** |
| **B** | `max_accepted_single_step_delta` | — | **≤ 1 on 5/5** (0, 1, 1, 1, 0) | **≤ 1 on 5/5** | ✅ |
| **C** | Mechanism (5 criteria) | — | All met (see below) | all pass | ✅ |
| **D** | Median weighted | **60,852** | **148,748** | **≤ 70,000** | ❌ |
| **D** | Runs **> 140k** | **0/5** | **4/5** (reps 1, 2, 4, 5) | **0/5** | ❌ |
| **E** | Median `weighted_anchor_verify_to_first_canonical_pass` | **12,400** | **Partially unevaluable** — Rep 5 F5; 4/5: **0** | **≤ 18,600** | ⚠️ **Partially unevaluable** (4/5 provisional **PASS**) |
| **F-journey** | Median `run_end_journey_test_count` | **8** | **7** | **≥ 8** | ❌ |
| **F-journey** | Min per-rep `run_end_journey_test_count` | **6** | Rep 5 = **1** | **≥ 6 on 5/5** | ❌ |
| **F-quality** | Median `app_rating` | **≥ 68** | **70** | **≥ 68** | ✅ |
| **F-quality** | Per-rep `usability_ux` | **≥ 27** | **30 on 5/5** | **≥ 27 on 5/5** | ✅ |
| **F (combined)** | F-journey **and** F-quality | — | Journey fail, quality pass | both pass | ❌ |

Primary **D** and **F** fail. Primary **B** and **C** pass. Primary **A** and **E** partially unevaluable (Rep 5 F5). Verdict **REVERT** per frozen verdict table.

---

## Gate A / E — Rep 5 F5 and partial evaluability

Per frozen prereg **F5**: `first_successful_authored_test_addition_call = null` → protocol failure; anchor metrics **unevaluable**. Rep 5 **cannot be silently excluded** from the cohort record.

| Rep | `first_successful_authored_test_addition_call` | Primary anchor VERIFY | Gate A/E at rep |
|-----|--------------------------------------------------|----------------------|-----------------|
| 1 | 11 | 12 | Evaluable |
| 2 | 8 | 9 | Evaluable |
| 3 | 7 | 9 | Evaluable |
| 4 | 9 | 10 | Evaluable |
| 5 | **null** | **null** | **F5 — unevaluable** |

**Cohort-level F10 (null experiment, 0/5 successful +1):** **Does not apply** — reps 1–4 each recorded successful +1.

**4/5 provisional Gate E:** `weighted_anchor_verify_to_first_canonical_pass` = {23,973 · 0 · 0 · 0} → median **0** → would **PASS** vs **18,600** ceiling on evaluable subset only.

**4/5 provisional Gate A:** Primary anchor calls exist on reps 1–4. Guard-aware `authored_test_count_at_anchor` / `test_loc_at_anchor` are not populated in the analysis export (`null` in `test-structure.metrics.json`). Secondary indicator `run_end_authored_test_count` on reps 1–4 = {10, 8, 7, 6} → median **7.5**, above the **≤ 6** compression target — provisional **FAIL** on suite-size intent.

---

## Cohort table (official 5 reps)

| Rep | Run ID | Weighted | Calls | Journeys | Rejections | First +1 call | Anchor VERIFY | Max Δ accepted | Run-end authored† | app_rating | usability_ux |
|-----|--------|----------:|------:|---------:|-----------:|--------------:|--------------:|---------------:|------------------:|-----------:|---------------:|
| 1 | `2026-09-02T09-33-44-044Z` | **213,072** | 37 | 10 | 1 (Δ+14) | 11 | 12 (fail) | 1 | 10 | 30 | 30 |
| 2 | `2026-09-02T09-38-48-126Z` | **164,305** | 33 | 8 | 1 (Δ+13) | 8 | 9 (pass) | 1 | 8 | 50 | 30 |
| 3 | `2026-09-02T09-45-03-724Z` | 104,158 | 25 | 7 | 1 (Δ+7) | 7 | 9 (pass) | 1 | 7 | 70 | 30 |
| 4 | `2026-09-02T09-49-15-043Z` | **140,724** | 29 | 6 | 1 (Δ+14) | 9 | 10 (pass) | 1 | 6 | 70 | 30 |
| 5 | `2026-09-02T09-53-21-545Z` | **148,748** | 30 | **1** | 2 (Δ+8, extra file) | **null** | **null** | 0 | **0‡** | 70 | 30 |

**Experiment script:** 5/5 OK  
**Median weighted:** **148,748** (104,158 – 213,072)  
**Median calls:** **30** (vs v2.2 control **16**)  
**Median run-end journeys:** **7** (vs control **8**)  
**Median app_rating:** **70** (range 30 – 70)  
**Increment guard rejections (cohort):** **6** (5/5 reps fought monolith at least once)

† Source-derived parser count at run end. ‡ Rep 5: parser returned **0**; Vitest reported **PASS 1/1** — see Rep 5 diagnostic.

---

## Layer 1 — Mechanism (Primary C): PASS

| Criterion | Threshold | Observed |
|-----------|-----------|----------|
| **0-test skeleton seeded at run start** | `skeleton_authored_count_at_start = 0` on **5/5** | **5/5** ✅ |
| Single qualifying test file at run end | `src/App.test.tsx` only on **5/5** | **5/5** ✅ |
| Post-tool guard active | `test-structure.v1.json` sidecar on **5/5** | **5/5** ✅ |
| Restore on violation | Hash restore after rejection | **6/6** rejections restored ✅ |
| Harness errors | `test_structure_error` | **0/5** ✅ |

**Monolith blocking (observed behavior, all 5 reps):**

```text
Pi writes 7–14 tests in first qualifying mutation
          ↓
Guard: observed_count 7–14, accepted_count 0 → REJECT + restore
          ↓
Pi switches to incremental +1 authoring (reps 1–4) or alternative strategy (rep 5)
```

**Rep 5 parser/observability defect (documented, does not flip C):** After correct rejection of the 8-test monolith, Pi wrote one comprehensive `it(..., async () => {...})` that **remained on disk** and **passed Vitest 1/1**. The frozen parser counted **0** tests → guard saw **Δ+0** → accepted without recording `first_successful_authored_test_addition`. Mechanism **restore and rejection paths worked**; **counting/telemetry** failed on Rep 5. General enforcement observability is **imperfect** when the parser under-counts (see Gate B note).

---

## Gate B — Monolithic write prevention: PASS (with observability caveat)

| Criterion | Threshold | Observed |
|-----------|-----------|----------|
| `max_accepted_single_step_delta` | **≤ 1 on 5/5** | **5/5** ✅ (values: 1, 1, 1, 1, 0) |
| Accepted Δ ≥ 2 | **0/5** runs | **0/5** ✅ |

Under the **frozen preregistered metric**, no run **accepted** Δ ≥ 2. Gate B **PASS**.

**Caveat — Rep 5 enforcement observability:** Rep 5 proves the shared parser can **under-count** real tests. Pi's substantive change was **+1** `it()`, but the harness recorded **Δ+0** throughout. Gate B passes the letter of the frozen rule; it does **not** prove perfect increment enforcement in all source shapes. A file where the parser returns **0** for **N > 0** tests is a **permissive blind spot** (under-count), distinct from the monolith **over-count** path that worked on all 5 reps.

---

## Gate D — Total cost: FAIL

| Metric | v2.2 control | Q2-E | Threshold | Result |
|--------|-------------:|-----:|-----------|--------|
| Median weighted | **60,852** | **148,748** | **≤ 70,000** | ❌ (~**2.4×** control) |
| Runs **> 140k** | **0/5** | **4/5** | **0/5** | ❌ |

Failing Gate D → experiment **REVERT** regardless of A–C (frozen prereg).

**Q2 program context (median weighted / calls):**

| Arm | Median weighted | Median calls |
|-----|----------------:|-------------:|
| v2.2 control | 60,852 | 16 |
| Q2 isolation | 89,832 | 23 |
| Q2-B repair | 79,317 | 16 |
| Q2-C guard | 132,778 | 26 |
| Q2-D early verify | 97,328 | 18 |
| **Q2-E structure** | **148,748** | **30** |

Q2-E is the **most expensive** Q2 arm tested. Incremental +1 authoring after monolith rejection dominates cost.

---

## Gate F — journey coverage and quality

Gate **F** passes iff **both** F-journey **and** F-quality pass. F-journey failed post-cohort; F-quality scored 2026-09-02 on all 5 reps.

### F-journey: FAIL

| Metric | v2.2 control | Q2-E | Threshold | Result |
|--------|-------------:|-----:|-----------|--------|
| Median `run_end_journey_test_count` | **8** | **7** | **≥ 8** | ❌ |
| Minimum per rep | **6** | Rep 5 = **1** | **≥ 6 on 5/5** | ❌ |

Recorded post-cohort (**F11**). Rep 5's single comprehensive `it()` yields **1** Vitest-reported journey despite covering many flows in one test body — journey metric reflects **test block count**, not scenario depth.

### F-quality: PASS

Mandatory human scoring (`app_rating`, `usability_ux`) using the **same method as v2.2 control floor** — control-app runs overlay, rubric per `control-app/shared/app-rubric.ts`.

| Criterion | v2.2 floor | Q2-E | Result |
|-----------|----------:|------|--------|
| Median `app_rating` | **≥ 68** | **70** | ✅ |
| Per-rep `usability_ux` | **≥ 27** | **30 on 5/5** | ✅ |

Rep 1 scored **30** total (`usability_ux` 30, persistence 0) — low total driven by missing persistence points, not UX floor breach. Per-rep `usability_ux` **≥ 27** on all reps; median **70** clears the **≥ 68** bar.

### Gate F (combined): FAIL

F-journey **FAIL** + F-quality **PASS** → Gate **F FAIL** → Layer 2 **REVERT** (with Gate **D**).

---

## Rep 5 post-cohort diagnostic (frozen parser — no fix in this analysis)

**Run:** `2026-09-02T09-53-21-545Z`  
**Sidecar:** `artifacts/runs/2026-09-02T09-53-21-545Z/test-structure.v1.json`

**Sequence:**

1. Tool ~21: 8-test monolith → `observed_count: 8` → **REJECT** + restore ✅  
2. Tool ~26: `src/debug.test.tsx` → **REJECT** (`extra_test_file`) + restore ✅  
3. Subsequent write: one large `it(..., async () => {...})` in `src/App.test.tsx` → parser **0** → guard **Δ+0** → **ACCEPT**  
4. VERIFY cycles → eventual **PASS 1/1** (Vitest)  
5. Export: `first_successful_authored_test_addition_tool_result_index: null`, `run_end_authored_test_count: 0`, `max_accepted_single_step_delta: 0`

**Root cause:** ASCII apostrophe in a line comment inside the async callback body:

```tsx
    // Edit a book's details
```

(`artifacts/runs/2026-09-02T09-53-21-545Z/app/src/App.test.tsx`, line 90)

The frozen parser (`extractTestBlocks` → `extractBalancedBraceBody` in `solution/extensions/test-authoring-scan.ts`) tracks `'` / `"` / `` ` `` but **does not skip `//` comments**. The `'` in `book's` toggles string state mid-body; subsequent `{` / `}` in `getByRole(...)` calls are misclassified; brace extraction fails; count = **0**.

**Classification:** **Not measurement-only.** The same parser drives the post-tool guard via `authoredTestCountInSnapshot` → `countAuthoredTestsFromSources`. Rep 5 substance: **+1** real test (E2-compliant). Harness telemetry: **+0** throughout → **F5** per frozen prereg.

**Reproducibility:** Replacing the comment with `// Edit a book details` yields parser count **1** on the identical file.

---

## Scientific conclusion

| Question | Answer |
|----------|--------|
| Does E2 block the monolithic first write? | **Yes — 5/5** reps attempted 7–14 tests; **6/6** detections rejected and restored |
| Does Pi adapt to incremental authoring? | **Yes — reps 1–4**; Rep 5 used one comprehensive test after rejections |
| Does suite size at first VERIFY compress vs v2.2? | **No clear win**; secondary run-end counts remain near control; Gate A partially unevaluable |
| Does total cost stay within guardrails? | **No — Gate D FAIL** (median **148,748**, **4/5 >140k**) |
| Does journey coverage hold? | **No — Gate F-journey FAIL** (median **7**, Rep 5 = **1**) |
| Does app quality regress? | **No — Gate F-quality PASS** (median **70**, UX **30/30** on all reps) |
| Is the mechanism trustworthy for telemetry? | **Mostly, with Rep 5 blind spot** — comment-unaware parser affects both metrics and guard observability |

**Pattern match (prereg post-REVERT guide):** **C PASS, D fail, F fail (journey)** → structure guard works; incremental authoring insufficient for cost and coverage — **not a valid KEEP**. Consider deferred **E3** (journey stubs) or other structure variants in separate prereg; do **not** promote E2 to control floor.

---

## Appendix — cohort artifact index

| Artifact | Path |
|----------|------|
| Export ZIP | `artifacts/exports/cohort-q2-harness-owned-test-structure-v1-2026-09-02.zip` |
| Cohort summary JSON | `artifacts/exports/q2-harness-owned-test-structure-v1-staging/cohort-summary.json` |
| Official log | `artifacts/experiments/q2-harness-owned-test-structure-v1/2026-09-02T09-33-38Z.log` |
| Quality overlays | `artifacts/runs-overlay.json` (via control-app `/api/runs/{runId}/overlay`) |
| Rep 5 sidecar | `artifacts/runs/2026-09-02T09-53-21-545Z/test-structure.v1.json` |
| Rep 5 final test file | `artifacts/runs/2026-09-02T09-53-21-545Z/app/src/App.test.tsx` |
