# Experiment SS2b — Scope & Sequence v2b — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-02)  
**Experiment:** `ss2b-scope-sequence-v2b`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-scope-sequence-v2b-preregistration.md](./experiment-scope-sequence-v2b-preregistration.md)

**Pinned treatment commit:** `1622482e2cf756b9de5d3d032e642e3d8e55d650`  
**Export:** `artifacts/exports/cohort-ss2b-scope-sequence-v2b-2026-09-02.zip`  
**Official run logs:**

- Reps 1–3: `artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T20-42-04Z.log`
- Reps 4–5 retake: `artifacts/experiments/ss2b-scope-sequence-v2b/2026-09-02T21-04-rep4-5-retake-balance.log` (API balance recharge; original reps 4–5 were 429 failures, not treatment)

> **Experiment: REVERT. SS2b mechanism (Gate D): PASS.**

---

## Official conclusion (locked)

| Layer | Verdict | Meaning |
|-------|---------|---------|
| **Formal experiment** | **REVERT** | Economics failed all co-primary cost gates (A ❌, B ❌, C ❌); scope gate **E ✅** |
| **Mechanism (Gate D)** | **PASS** | 5/5 steer delivery on first qualifying src product-code tool_call; export + session confirmed |
| **Scope (Gate E)** | **PASS** | **0/5** invented-scope flags (`search_ui`, `sort_alpha`, `undo_redo`) in final App + tests; whole-src scan also clean |
| **Active baseline** | **Not promoted** | Toggle remains experiment-only (`HARNESS_SCOPE_SEQUENCE_V2B`, default off) |
| **Next fork (per prereg)** | **Investigate steer/delivery side-effects** | Scope good + cost bad → not SS3 wording yet |

**Preserved finding:** Broadening the anchor to **`src/types.ts` and other early product files** fixes SS2’s hook miss (Rep 3 `useLibrary.ts` case) and preserves SS2’s scope win — but **does not restore SS1 economics**. SS2b sits between SS1 and SS2 on cost (~99k median vs SS1 ~60k, SS2 ~126k), with **0/5 ≤70k** and steer channel still dominant.

---

## Cohort integrity note

| Rep | Run ID | Notes |
|-----|--------|-------|
| 1–3 | Original log | Completed in first session |
| 4–5 | Retaken | Original attempts (`2026-09-02T20-56-*`) failed with **429 insufficient balance** — excluded from official cohort; retaken after recharge |

Official analysis cohort: **5/5 harness success** on pinned commit `1622482`.

---

## Three-arm comparison (frozen comparators)

| Metric | SS1 (frozen) | SS2 (frozen) | **SS2b (official 5/5)** |
|--------|-------------:|-------------:|------------------------:|
| Median weighted total | **60,051** | **125,684** | **99,384** |
| Median pre-VERIFY | **37,607** | **50,958** | **42,599** |
| Median mut→VERIFY | **8,385** | **2,815** | **9,485** |
| Reps ≤ 70k | **4/5** | **1/5** | **0/5** ❌ |
| Reps ≥ 120k | **0/5** | **3/5** | **1/5** ❌ |
| Invented scope @ 1st VERIFY (formal) | **4/5** | **0/5** | **0/5** ✅ |
| Mechanism delivered | **5/5** | **5/5** | **5/5** ✅ |
| Typical anchor path | post-`App.tsx` result | pre-`App.tsx` steer | pre-first product `.ts(x)` steer |

**Reading:** SS2b **preserves scope improvement** (SS2-like **0/5**) but **does not achieve the prereg success condition** — economics remain far from SS1 (~60k) and only modestly better than SS2 median.

---

## Formal result (frozen prereg gates)

| Gate | Metric | SS2b | Threshold | Result |
|------|--------|-----:|-----------|--------|
| **A — pre-VERIFY** | Median weighted before 1st canonical VERIFY | **42,599** | ≤ 40,000 | ❌ |
| **A — mut→VERIFY** | Median weighted mutation→VERIFY | **9,485** | ≤ 8,000 (informational) | ❌ |
| **B — median total** | Median weighted total | **99,384** | ≤ 60,852 | ❌ |
| **B — tails** | Runs ≥ 120k | **1/5** | **0/5** | ❌ |
| **C — cheap path** | Reps ≤ 70k | **0/5** | ≥ 4/5 | ❌ |
| **C — best rep** | Best weighted | **87,306** | ≤ 55,000 | ❌ |
| **D — mechanism** | All D criteria | 5/5 | all pass | ✅ |
| **E — invented scope** | Any flag at 1st VERIFY | **0/5** | ≤ 1/5 | ✅ |

**Formal verdict:** **REVERT** (requires **A AND B AND C AND D AND E**).

**Prereg decision tree outcome:** Scope good + cost bad → **investigate steer/delivery side-effects** (not SS3 wording).

---

## Cohort table (official 5 reps)

| Rep | Run ID | Weighted | Calls | Pre-VERIFY | Mut→VERIFY | VERIFY @ | Journeys | Anchor path | Anchor call |
|-----|--------|----------:|------:|-----------:|-----------:|---------:|---------:|-------------|------------:|
| 1 | `2026-09-02T20-42-09-965Z` | **97,151** | 16 | 49,312 | 4,319 | 9 | 8 | `src/types.ts` | 12 |
| 2 | `2026-09-02T20-46-32-277Z` | **109,340** | 21 | 34,440 | 9,485 | 9 | 9 | `src/types.ts` | 9 |
| 3 | `2026-09-02T20-50-34-924Z` | **125,720** | 14 | 49,845 | 10,315 | 7 | 7 | `src/App.tsx` | 13 |
| 4 | `2026-09-02T21-04-40-061Z` | **87,306** | 19 | 42,599 | 19,937 | 8 | 7 | `src/App.tsx` | 10 |
| 5 | `2026-09-02T21-08-50-360Z` | **99,384** | 18 | 18,576 | 5,930 | 6 | 6 | `src/types.ts` | 8 |

**Experiment script:** 5/5 OK (3 + 2 retake)  
**Median weighted:** **99,384** (87,306 – 125,720)  
**Median calls:** **18** (14 – 21)  
**Runs ≥ 120k:** **1/5** (Rep 3)  
**VERIFY fail before green:** `{1, 1, 1, 2, 3}`

---

## Gate D — mechanism (PASS)

| Criterion | Result |
|-----------|--------|
| Qualifying src product-code write/edit tool_call | **5/5** |
| Message delivered exactly once via steer | **5/5** (`scope-sequence.v2b.json`) |
| Session steer confirmed (`customType: harness_scope_sequence_v2b`, verbatim 354-byte text) | **5/5** (pi-session.jsonl) |
| Zero tool blocks / auto-VERIFY / extra LLM calls from SS2b | **0** |
| Export present with `anchor: before_first_src_product_code_mutation` | **5/5** |

### Anchor path distribution (frozen SS2b anchor)

| Path | Reps | Notes |
|------|------|-------|
| `src/types.ts` | **3/5** (1, 2, 5) | Earliest product-code write — **fixes SS2 hook miss** |
| `src/App.tsx` | **2/5** (3, 4) | Pi wrote types/hooks inline or skipped separate types file |

**Rep 1 forensic (reference):** Pi generated `src/types.ts` + `src/hooks/useLocalStorage.ts` in one turn; steer fired after **`types.ts` write** (tool_call_index 12), **before** `useLibrary.ts` and `App.tsx`. Session shows `custom_message` with frozen text between tool results — steer in context for all subsequent product code.

---

## Gate E — invented scope (PASS)

Formal detector: `search_ui`, `sort_alpha`, `undo_redo` in **`src/App.tsx` or test files** at cohort end.

| Rep | Formal flags | Whole-`src/` flags | App.tsx LOC |
|-----|-------------|-------------------|------------:|
| 1 | none | none | 319 |
| 2 | none | none | 359 |
| 3 | none | none | 464 |
| 4 | none | none | 89 |
| 5 | none | none | 242 |

**0/5** invented scope — matches SS2 (**0/5**), vs SS1 (**4/5**).

Rep 4’s minimal App (89 LOC) reflects componentized architecture (logic in hooks/components) rather than scope stripping after steer.

---

## Cost diagnosis — why SS2b did not restore SS1 economics

### 1. Steer channel co-varies with SS2 (unchanged)

SS2b uses the same **`sendMessage` + `deliverAs: "steer"`** on `tool_call` as SS2. Median total **99k** is **~21% below SS2** but **~65% above SS1** — steer-associated cost pathology persists.

### 2. Early anchor did not shorten trajectories

| Arm | Median calls | Median pre-VERIFY |
|-----|-------------:|------------------:|
| SS1 | ~14 | 37,607 |
| SS2 | ~15 | 50,958 |
| SS2b | **18** | **42,599** |

Earlier steer on `types.ts` did **not** produce cheaper runs; Rep 2 (21 calls, 109k) and Rep 3 (125k) remain expensive despite scope compliance.

### 3. Test verbosity persists

Journey counts **6–9** vs idea-minimal ~6–7. Rep 2 authored **9** journeys; several reps ran **2–4** canonical VERIFY rounds before green. Message says “compact tests” but steer does not enforce caps.

### 4. SS2b vs SS2 cost mix

SS2b improved the **worst tail** (1/5 ≥120k vs SS2 3/5) and lowered median (~99k vs ~126k), but **eliminated the cheap path entirely** (0/5 ≤70k vs SS1 4/5, SS2 1/5). Net: still **REVERT** on prereg economics.

---

## Behavioral synthesis

```text
SS1:  message after bad App write     → scope bad (4/5), cost OK (~60k)
SS2:  steer before App.tsx only       → scope good (0/5), cost bad (~126k)
SS2b: steer before first product .ts  → scope good (0/5), cost still bad (~99k)
```

**What SS2b proved:**

- Broad anchor **works mechanically** — catches `types.ts` before hooks/App (SS2 Rep 3 miss fixed).
- Scope message **still read and obeyed** when steer fires early — no search/sort/undo in any run.
- **Earlier anchor alone is insufficient** to recover SS1 cost band while keeping steer delivery.

**What SS2b did not prove:**

- That true **pre-decision** delivery (before Pi generates the tool call) helps — steer still fires **after** tool_call generation, same epistemic caveat as SS2.
- That SS3 wording would help — cost failure points to **delivery channel**, not message strength.

---

## Per-rep notes (forensic)

| Rep | Strategy sketch | Cost driver |
|-----|-----------------|-------------|
| **1** | types → hooks → large App → 8 tests → VERIFY×2 | Heavy App write post-steer; 97k |
| **2** | types early → verbose test suite (9 journeys) | Most calls (21); 109k |
| **3** | Inline types in App (464 LOC) → VERIFY×2 | Worst total 125k |
| **4** | Small App, componentized → VERIFY×3, mut span 3 | High mut→VERIFY (19.9k) despite 87k total |
| **5** | types @ call 8 → fast VERIFY @6 but 3 fails before green | Best pre-VERIFY (18.6k) but still 99k total |

---

## Relationship to prior arms

| Arm | Verdict | SS2b adds |
|-----|---------|-----------|
| SS1 | REVERT (mechanism PASS) | SS2b confirms scope fix requires **earlier** delivery; SS1 append was too late |
| SS2 | REVERT (scope win, cost fail) | SS2b confirms **broader anchor** helps tail/median slightly; **does not fix steer economics** |
| S1 | REVERT | Independent; SS2b did not combine |

**Not authorized:** promoting `HARNESS_SCOPE_SEQUENCE_V2B` default-on; SS3 without new prereg; S2 Error Memory.

---

## Recommended next fork (frozen prereg tree)

Per prereg:

> Scope good + cost bad → investigate **steer/delivery side-effects**

Concrete options (design only — not implemented):

1. **SS2c:** Same broad anchor, **SS1-style append on tool_result** (no steer) — isolates channel from timing.
2. **SS2d:** Same message, inject **before model turn** after recon (if harness supports) — tests true pre-decision.
3. **Do not** jump to SS3 wording until channel is isolated.

---

## Document history

| Date | Event |
|------|-------|
| 2026-09-02 | SS2b 5/5 cohort complete (reps 4–5 retaken after balance recharge); analysis FINAL / FROZEN — **REVERT** |
