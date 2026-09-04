# Experiment S1 — Convergence Intervention v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `s1-convergence-intervention-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-s1-convergence-intervention-v1-preregistration.md](./experiment-s1-convergence-intervention-v1-preregistration.md)

**Pinned treatment commit:** `ee9095f012bd2e63330f8840e54f1ac308fbceaa`  
**Export:** `artifacts/exports/cohort-s1-convergence-intervention-v1-2026-09-02.zip`  
**Official run log:** `artifacts/experiments/s1-convergence-intervention-v1/2026-09-02T13-21-19Z.log`

**Excluded (invalid infrastructure — audit only, not in gates):**

| Run ID | Reason |
|--------|--------|
| `2026-09-02T12-40-07-751Z` | VERIFY delivery broken (`status is not defined` on `aa100517`) |
| `2026-09-02T12-55-19-652Z` | Same bug; run interrupted before completion |

> **Experiment: REVERT. S1 mechanism (Gate C): PASS.**

---

## Official conclusion (locked)

| Layer | Verdict | Meaning |
|-------|---------|---------|
| **Formal experiment** | **REVERT** | Median cost and cheap-run gates failed (A ❌, B ❌) |
| **Mechanism (Gate C)** | **PASS** | Classifier correct; delivery confirmed on `ee9095f`; zero false positives; Rep 1 stalled → Tier 1 → green |
| **S1 efficacy** | **Unknown** | Only one delivered intervention in cohort — insufficient exposure to prove snowball prevention |
| **Active baseline** | **Not promoted** | Code preserved; toggle remains experiment-only (default **off** on v2.2) |
| **S2 / Error Memory** | **Not authorized** | Forensic Phase 2 closed; see [SS1 prereg](./experiment-scope-sequence-v1-preregistration.md) |

**Preserved finding:** S1 may be useful as a **snowball safety mechanism** (0/5 ≥120k), but the 89–105k runs were expensive **without S1 firing** — S1 did not cause that middle. Forensic Phase 2 ([closure doc](./forensic-phase-2-trajectory-fork.md)) located the fork at calls 4–6 (pre-VERIFY strategy). Next experiment design: [SS1 scope-sequence v1](./experiment-scope-sequence-v1-preregistration.md) — prereg only, not implemented.

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment** | **REVERT** — Gate **A** and **B** failed; Gate **C** passed |
| **S1 mechanism (Gate C)** | **PASS** — classifier correct; one Tier 1 delivered; zero false positives on converging; zero Tier 2 (no debug sidecars); piggyback delivery confirmed in `events.jsonl` |
| **`convergence-intervention-v1` extension** | **Validated experiment toggle — NOT promoted to default floor** |
| **S2 / Error Memory** | **Not authorized** by this result |

**Causal treatment tested:** after each canonical VERIFY, classify convergence vs previous; append Tier 1/2 to existing VERIFY result text only when stalled/regressing (or signature-repeat fallback). No Error Memory, no tool blocks, no extra VERIFY/LLM calls.

**Root diagnosis:** The convergence classifier and delivery path work as designed on `ee9095f`, but this 5-run cohort did not meet v2.2 cost gates. Median weighted rose to **93,354** (control **60,852**). Only **1/5** reps ≤70k (control **3/5**). S1 had **almost no opportunity to act**: one delivered Tier 1 in the entire cohort, on the **cheapest** run (64.5k). The expensive middle (89–105k) occurred primarily in runs where S1 stayed silent.

**Not authorized by this document:** promoting `HARNESS_CONVERGENCE_INTERVENTION_V1` default-on, or proceeding to S2/Error Memory without a new experiment design that yields enough stalled/regressing events to test efficacy.

---

## Formal result (frozen prereg gates)

| Gate | Metric | v2.2 control | S1 (`ee9095f`) | Threshold | Result |
|------|--------|-------------:|---------------:|-----------|--------|
| **A — tails** | Runs weighted **≥ 120k** | **0/5** | **0/5** | **≤ 1/5** | ✅ |
| **A — median** | Median weighted total | **60,852** | **93,354** | **≤ 60,852** | ❌ |
| **Gate A overall** | Both required | — | — | A tails **and** A median | **FAIL** |
| **B — cheap reps** | Reps **≤ 70k** | **3/5** | **1/5** | **≥ 2/5** | ❌ |
| **B — best rep** | Best weighted | **49,449** | **64,512** | **≤ 55k** | ❌ |
| **Gate B overall** | Both required | — | — | B cheap **and** B best | **FAIL** |
| **C — mechanism** | Classifier + **confirmed delivery** | — | all criteria | all pass | ✅ |

**Formal verdict:** **REVERT** (A ❌ + B ❌ + C ✅ → requires **A AND B AND C**).

Per prereg partial-signal rules: **B fails, A tails pass** → intervention may not tax cheap runs catastrophically, but median/cheap-path gates failed — not KEEP; redesign before S2.

---

## Cohort table (official 5 reps on `ee9095f`)

| Rep | Run ID | Weighted | Calls | VERIFY fail path | Tier 1 | Tier 2 | Debug sidecar | Journeys | Harness |
|-----|--------|----------:|------:|------------------|-------:|-------:|:-------------:|---------:|---------|
| 1 | `2026-09-02T13-21-24-620Z` | **64,512** | 16 | 1 → 1 → 0 | **1** | 0 | 0 | 6 | success |
| 2 | `2026-09-02T13-24-00-401Z` | 100,435 | 15 | 1 → 0 | 0 | 0 | 0 | 7 | success |
| 3 | `2026-09-02T13-26-56-008Z` | 89,545 | 18 | 1 → 0 | 0 | 0 | 0 | 8 | success |
| 4 | `2026-09-02T13-30-04-976Z` | 93,354 | 17 | 8 → 3 → 0 | 0 | 0 | 0 | 14 | success |
| 5 | `2026-09-02T13-34-28-334Z` | 105,193 | 20 | 8 → 4 → 0 (+ re-verify) | 0 | 0 | 0 | 9 | success |

**Experiment script:** 5/5 OK  
**Median weighted:** **93,354** (64,512 – 105,193)  
**Median calls:** **17** (15 – 20)  
**Runs ≥ 120k:** **0/5** (no snowball tail)  
**VERIFY fail before green:** `{2, 1, 1, 2, 2}` vs v2.2 `{0, 1, 1, 2, 2}`

Distribution shape: **expensive middle**, not 150–300k snowball pathology.

---

## Gate C — mechanism (PASS)

### Classifier compliance

| Criterion | Result |
|-----------|--------|
| Tier 1/2 on strictly **converging** transitions | **0** (`false_positive_converging_interventions: 0` on all reps) |
| Tier 1 on observable **stalled/regressing** | **1/1** cohort-wide (Rep 1 ordinal 2: `1 → 1` stalled) |
| **Unknown** silent unless signature fallback | ✅ no inappropriate unknown interventions |
| Tier 2 only with debug sidecar + non-convergence | ✅ **0** Tier 2 (no debug sidecars in valid cohort) |
| Extra LLM / VERIFY / tool call for delivery | ✅ none |

### Delivery compliance (events.jsonl — not export field alone)

Export `delivery: "appended_to_verify_result"` records **message_composed** only. Gate C requires **message_delivered** in the verify tool result Pi received.

| Rep | Canonical `verify` with `verify exit_code=` | `[harness]` in verify result | Export tier1 |
|-----|--------------------------------------------:|-----------------------------:|-------------:|
| 1 | 3 | **1** | 1 |
| 2 | 2 | 0 | 0 |
| 3 | 2 | 0 | 0 |
| 4 | 3 | 0 | 0 |
| 5 | 4 | 0 | 0 |

**Rep 1 VERIFY 2** (delivered): normal `verify exit_code=1 (FAIL)` body **plus** frozen Tier 1 text appended. VERIFY 3: `verify exit_code=0 (PASS)`.

No `status is not defined` errors on valid cohort (`ee9095f` fix confirmed).

---

## Post-intervention behavior (Rep 1 — only delivered Tier 1)

```text
VERIFY 1:  1 fail  (converging — first verify, no message)
       ↓
Pi edits App.test.tsx directly
       ↓
VERIFY 2:  1 fail  (stalled — Tier 1 DELIVERED)
       ↓
Pi fixes stale DOM-row reference in App.test.tsx (in-place)
       ↓
VERIFY 3:  PASS 6/6
```

- No new test file, no `debug.test.*`, no debug sidecar  
- Rep 1 finished at **64.5k** — cheapest run in cohort  
- Pi was already doing direct in-place repair **before** Tier 1; **n = 1** delivered event → positive mechanism observation, **not** causal proof Tier 1 caused recovery

---

## Cost interpretation — why formal gates failed

### Not a snowball cohort

- **0/5** ≥120k (Gate A tails ✅)  
- **0/5** debug test files  
- Calls **15–20** — far below 150–300k snowball call counts  

### Expensive middle without S1 exposure

**4/5 runs received zero S1 messages.** Those four silent runs are **89–105k**. The only run that received Tier 1 was **64k**.

It would be incorrect to conclude *“Tier 1 made runs expensive.”* The formal cost failure occurred primarily in runs where S1 **never intervened**.

### Pre-first-VERIFY cost (S1 out of scope)

Weighted cost accumulated **before** first canonical VERIFY (S1 cannot act on this bucket):

| Rep | Pre-first-VERIFY weighted |
|-----|--------------------------:|
| 1 | 38,176 |
| 2 | 49,233 |
| 3 | 61,974 |
| 4 | 48,074 |
| 5 | 42,185 |
| **Median** | **48,074** |

Median ~**48k** already spent before any convergence classification. v2.2 cheap-path reps (~50–70k total) require most of the budget **after** first VERIFY feedback — this cohort front-loaded cost in product/test authoring.

### Heavy turns without call snowball

Rep 2: **15 calls**, **100k** weighted — large late-turn input (~12–13k fresh tokens) without repair spiral or debug expansion. High cost ≠ high call count in this sample.

---

## Invalid runs (aa100517) — forensic note only

Two pre-fix runs on `aa100517` are **excluded** from all gates. They demonstrate:

- S1 classifier could run while VERIFY return object crashed  
- Export `delivery` field **overstated** actual delivery  
- **Feedback-starvation snowball** (Rep 1: 679k, 103 calls) when Pi never saw real PASS/FAIL  

See `cohort-protocol.v1.json` and invalid run folder in export. **Not counted** toward S1 verdict.

---

## Summary judgment

```text
Classifier           ✅ works
Actual delivery      ✅ fixed and verified (ee9095f)
Cheap-path silence   ✅ appropriate (4/5 silent)
One stalled repair   ✅ Tier 1 delivered → next VERIFY green (Rep 1)

Snowball tails       ✅ 0/5 ≥120k
Median cost gate     ❌ 93,354 vs 60,852
Cheap-path gate      ❌ 1/5 ≤70k vs 3/5

Formal S1 result     REVERT
S1 efficacy          unknown (insufficient intervention exposure)
S2 / Error Memory    not authorized
```

**S1 fails the preregistered experiment, but not because the convergence mechanism malfunctioned.** It fails because this treatment cohort did not reproduce the v2.2 cheap 50–70k distribution, while S1 had almost no stalled/regressing events to evaluate whether redirect messages change repair behavior at scale.

**Next scientific fork (not executed here):** accept formal REVERT; optionally design a cohort or arm with higher stalled/regressing incidence **or** address pre-first-VERIFY cost separately — before attributing failure to “S1 message ignored.”

---

## References

- [S1 preregistration](./experiment-s1-convergence-intervention-v1-preregistration.md)  
- [Failure implementation study](../../artifacts/forensic/failure-implementation-study-v1.json) (motivation)  
- Export manifest: `artifacts/exports/s1-convergence-intervention-v1-staging/MANIFEST.json`  
- Cohort protocol: `artifacts/experiments/s1-convergence-intervention-v1/cohort-protocol.v1.json`
