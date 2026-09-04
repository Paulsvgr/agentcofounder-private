# Experiment Q2-D — Early VERIFY v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02)  
**Experiment ID:** `q2-early-verify-v1`  
**Short label:** Q2-D (harness **automatic canonical VERIFY** immediately after first test-file mutation — timing only)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))  
**Prior confidence:** **Exploratory / low prior** — reasonable falsification arm, not an obvious winner (see [Epistemic prior](#epistemic-prior)).

> **Scope boundary.** This experiment tests **one harness-only hypothesis**: whether **one automatic canonical VERIFY immediately after Pi's first test-file mutation** — delivering real vitest output before Pi can compound a bad testing assumption — compresses the test-authoring window and non-regresses total cost.
>
> **It does NOT include** selector rules (F1–F6 / Q2-C guard), test-count caps, AGENTS.md / `queryHelpers.ts`, `memoryStorage`, CSS/persistence overlays, `HARNESS_VERIFY_REPAIR_V1`, harness test scaffolding, or harness report finalization.
>
> **It does NOT claim** to solve brittle selectors written **after** early feedback, expensive pre-test product work, or journey quality. A REVERT still yields a clean negative on **“timing alone.”**

---

## Epistemic prior

Q2-D asks only:

```text
Does ONE early real VERIFY prevent Pi from building too much
on top of a bad first testing assumption?
```

| Reason to run | Reason for skepticism |
|---------------|----------------------|
| Q2-C rep 4: huge suite before any feedback | First mutation may be incomplete → low-signal early FAIL |
| Bucket 1 is a real tail class | Pi can still write brittle tests **after** early VERIFY |
| Timing-only lever is cheap to falsify | Q2-B/Q2-C: “more feedback” often **increased** cost |
| REVERT cleanly closes “better timing” | Stronger long-term bet may be **harness-owned test structure** (deferred — see [Future arms](#future-arms-not-in-this-experiment)) |

**Expected outcome:** mechanism **PASS** plausible; formal **KEEP** low prior (~20–30%). Either outcome advances the program.

---

## Relationship to prior work

| Prior arm | Verdict | What it proved | Why this arm is next |
|-----------|---------|----------------|----------------------|
| [Q2 test-isolation v1](./experiment-q2-test-isolation-v1-analysis.md) | REVERT | Storage mechanism PASS; not the bottleneck | Test process, not storage |
| [Q2 verify-repair v1](./experiment-q2-verify-repair-v1-analysis.md) | REVERT | Post-failure coaching **worsens** VERIFY→PASS (~2.2×) | More feedback **after** a large suite does not help |
| [Q2 test-authoring-guard v1](./experiment-test-authoring-guard-v1-analysis.md) | REVERT | Pre-VERIFY **blocking** fires; +118% median cost; same 1/5 first-VERIFY pass | Static blocking is the wrong architecture |
| [Exp3](./exp3-test-policy.md) (prompt RTL guidance) | in v2.2 baseline | Prompt-only insufficient | No new prompt text |

**Cohort evidence motivating this arm** ([Q2-C analysis](./experiment-test-authoring-guard-v1-analysis.md)):

- Rep 4: **21** journey tests, **47** calls, **163k** weighted before first allowed VERIFY, **1** guard block — bucket 1 dominates tails.
- Median **84.5k** pre-allowed vs v2.2 **~36.2k** — test-phase blowups are costly without guard spirals.
- **8** guard blocks cohort-wide; blocking did not improve first-VERIFY reliability.

**Explicitly closed — not retried here:**

- F6 / domain-literal / named-role guard expansion (Q2-C analysis)
- Test-count caps (separate future arm if Q2-D partial-signals)
- `test-authoring-v1` template overlay (separate prereg)

---

## Problem statement

### Causal chain (v2.2 control — today)

```text
Pi builds product (may be large — out of scope)
    ↓
Pi mutates test files (any tool: write, edit, bash, patch, …)
    ↓
Pi may write many tests before calling verify
    ↓
First canonical VERIFY may arrive late (large suite)
    ↓
VERIFY fails → repair loop
```

On control, **first canonical VERIFY in the run** may occur **before** any test-file mutation (Pi calls `verify` on empty/minimal workspace). Metrics must anchor to **first canonical VERIFY at or after first test mutation**, not first VERIFY overall.

### Causal chain (Q2-D treatment)

```text
Pi builds product (unchanged)
    ↓
Filesystem detects first test-file mutation (tool-agnostic)
    ↓
Harness runs ONE automatic canonical VERIFY immediately
    ↓
Pi receives real PASS/FAIL (verify_source: auto_early_v1)
    ↓
Pi continues normally (manual verify unchanged)
```

**Out of scope:** product build before any test file exists; selector quality rules; post-VERIFY repair orchestration; caps; scaffolding.

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF, **no assembler overlays**), harness extension **`early-verify-v1`** will:

1. **Compress the post-mutation test-authoring window** — at **first post-mutation canonical VERIFY**, source-derived authored-test count and test LOC are materially smaller than v2.2 control.
2. **Deliver first post-mutation feedback with minimal extra model calls** — weighted cost from first test mutation through first post-mutation canonical VERIFY stays bounded.
3. **Non-regress total cost** — median weighted and tail bounds vs v2.2 guardrails.
4. **Hold VERIFY repair cost** — weighted span first post-mutation canonical VERIFY → first canonical PASS does not blow up like Q2-B.

**Not claimed:** first post-mutation VERIFY pass rate alone wins; median total must beat **60,852**.

---

## Treatment (harness-only — frozen at implementation)

**v2.2 + early-auto-VERIFY extension only.** Assembler remains **OFF/OFF**.

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_VERIFY_REPAIR_V1=0              # explicit off — Q2-B closed
HARNESS_TEST_AUTHORING_GUARD_V1=0       # explicit off — Q2-C closed
HARNESS_EARLY_VERIFY_V1=1               # new harness toggle at implementation
HARNESS_OWNED_VERIFY=1                  # unchanged v2.2 baseline
```

| Component | v2.2 OFF/OFF | Q2-D treatment |
|-----------|--------------|----------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Exp3 test policy (prompt) | in baseline | **unchanged** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| `verify-repair-v1` | off | **off** |
| `test-authoring-guard-v1` | off | **off** |
| **`early-verify-v1` extension** | absent | **on** |

### Frozen trigger — tool-agnostic filesystem detection

The trigger is detected from the **workspace filesystem**, not from Pi tool names. This is the **single causal lever**.

#### Definitions (frozen)

| Term | Definition |
|------|------------|
| **Qualifying test file** | Workspace-relative path under Pi app cwd matching `src/**/*.test.ts` or `src/**/*.test.tsx`. Seed ships **zero** product tests. |
| **Run-start baseline snapshot** | At session start (before first Pi tool call): map of `{ relativePath → contentHash }` for all existing qualifying test files (expected: **empty**). |
| **Filesystem test mutation** | After any Pi tool execution completes, rescan qualifying test files. A mutation occurred at call index **K** iff **any** of: (a) a qualifying file **exists** that was absent in baseline; (b) a qualifying file's **contentHash** differs from baseline **or** from the hash recorded at the previous scan. |
| **First test mutation event** | The **earliest** call index **K** where a filesystem test mutation is detected. Record: `first_test_mutation_call`, `first_test_mutation_paths[]`. |
| **Canonical VERIFY** | Full-suite run per [harness-owned-verify.md](./harness-owned-verify.md) — `npm test`, real exit code, compact reporter. No file-scoped vitest, pipes, or guard scan. |
| **Post-mutation canonical VERIFY** | A canonical VERIFY event whose call index **≥** `first_test_mutation_call`. |
| **First post-mutation canonical VERIFY** | Minimum call index among post-mutation canonical VERIFY events. |
| **Auto early VERIFY** | Harness-initiated canonical VERIFY triggered by the frozen rule below. Tagged `verify_source: auto_early_v1`. |

#### Trigger rule (frozen — one-shot per run)

```text
AFTER each Pi tool execution completes:
  rescan qualifying test files (contentHash)
  IF first_test_mutation_event not yet recorded AND filesystem test mutation detected:
    RECORD first_test_mutation_event at this call index
    IF auto_early_verify_fired == false:
      SET auto_early_verify_fired = true
      RUN canonical VERIFY immediately (before next Pi tool in same agent turn)
      INJECT result with first line: verify_source: auto_early_v1
```

| Property | Rule |
|----------|------|
| **Detection** | **Filesystem only** — works for `write`, `edit`, `apply_patch`, bash redirects, or any other mutation path |
| **Frequency** | **Exactly once** per run (`auto_early_verify_fired` latch) |
| **Timing** | **Immediately** after first filesystem test mutation — same agent turn, before subsequent Pi tools |
| **Subsequent Pi `verify` calls** | **Unchanged** |
| **Pi `verify` before any test mutation** | **Allowed** (v2.2 parity) — does **not** consume auto latch; does **not** count as post-mutation unless index ≥ mutation |
| **Incomplete first mutation** | Still triggers — immature tests are valid early feedback |
| **Sidecar / debug test files** | **Included** if path matches `src/**/*.test.ts(x)` — report in analysis; no exclusion in v1 |

#### Explicitly NOT in this treatment

- Max test count, max LOC, max calls before VERIFY.
- Blocking Pi `verify` or test-file writes.
- F1–F6 scanner / `HARNESS_TEST_AUTHORING_GUARD_V1`.
- Structured FAIL / repair-first prompt.
- Auto VERIFY on second or later filesystem mutations.
- AGENTS.md, `queryHelpers.ts`, `memoryStorage`, assembler overlays.
- Harness test scaffolding or harness-owned test structure.
- Harness-owned `report.partial.json` / report finalization.

---

## Control reference (v2.2 lock — locked numbers)

Historical cohort — **no re-run required** unless base hash drift detected.

### Cost (guardrail reference)

| Metric | v2.2 (5 reps) |
|--------|---------------|
| Median weighted | **60,852** |
| Range | 49,449 – 108,708 |
| Runs **> 140k** | **0/5** |
| Median calls | **16** |

### Trajectory (comparison context)

| Rep | Run ID | `verify_fail_before_first_canonical_green` | Weighted | Calls |
|-----|--------|---------------------------------------------|----------|------|
| 1 | `2026-08-31T21-16-45-263Z` | **2** | 78,009 | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | **0** | 60,852 | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | **1** | 49,449 | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | **2** | 108,708 | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | **1** | 50,364 | 12 |

**Locked control aggregates:**

| Metric | Value |
|--------|-------|
| Median `verify_fail_before_first_canonical_green` | **1** |
| Distribution | **0, 1, 1, 2, 2** |
| Median weighted VERIFY → first canonical PASS | **12,400** (~12.4k) |
| Median weighted before first canonical VERIFY (any) | **~36,200** (~36.2k) |

### Control retro (required before cohort — same definitions as treatment)

Before the treatment cohort, run a **retro script** on the five v2.2 run IDs above. Publish locked numbers in **Amendment 1** or an implementation appendix.

Retro reconstructs per rep:

1. **Filesystem timeline** — infer `first_test_mutation_call` from run snapshots / events (or end-state diff if intermediate snapshots unavailable; document method).
2. **First post-mutation canonical VERIFY** — earliest canonical VERIFY at index ≥ `first_test_mutation_call`.
3. **Source-derived metrics** at that VERIFY (definitions below).

| Retro metric | Role |
|--------------|------|
| Median `authored_test_count_at_first_post_mutation_verify` | Control baseline for Primary A |
| Median `test_loc_at_first_post_mutation_verify` | Control baseline for Primary A |
| Median `weighted_mutation_to_first_post_mutation_verify` | Control baseline for Primary B |
| Median `total_canonical_verify_count` | Secondary comparison |

If retro cannot reconstruct filesystem timeline for a control rep, exclude that rep from the affected median and document.

---

## Metric definitions (treatment cohort)

### Event anchors (frozen)

All primary metrics anchor to **first post-mutation canonical VERIFY**, not first VERIFY in run.

| Metric | Definition |
|--------|------------|
| `first_test_mutation_call` | Call index of first filesystem test mutation |
| `first_post_mutation_canonical_verify_call` | Call index of first canonical VERIFY with index ≥ `first_test_mutation_call` |
| `first_post_mutation_canonical_verify_source` | `auto_early_v1` \| `pi_verify` \| `bash` |
| `first_post_mutation_canonical_verify_outcome` | `pass` \| `fail` \| `unknown` per [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) |
| `auto_early_verify_fired` | Boolean — latch set per trigger rule |
| `auto_early_verify_call` | Call index of auto VERIFY (expect = `first_test_mutation_call`) |

### Source-derived authored-test count (frozen — not vitest output)

At a snapshot call index **K**, scan all qualifying test files on disk:

| Metric | Definition |
|--------|------------|
| `authored_test_count` | Sum over qualifying files of top-level `it(` and `test(` invocations counted by **brace-balanced parse** of each file (same block-boundary rules as [Q2-C Appendix A](./experiment-test-authoring-guard-v1-preregistration.md#appendix-a--forbidden-rtl-patterns-frozen-scan-definition): callback body of `it`/`test`; nested inner functions excluded). **Do not** use vitest-reported `total` — suite errors, skipped counts, and sidecars differ. |
| `test_loc` | Sum of line counts of all qualifying test files at snapshot **K** |
| `authored_test_count_at_first_post_mutation_verify` | `authored_test_count` at `first_post_mutation_canonical_verify_call` |
| `test_loc_at_first_post_mutation_verify` | `test_loc` at same anchor |

### Cost spans

| Metric | Definition |
|--------|------------|
| `weighted_mutation_to_first_post_mutation_verify` | Ledger cumulative at `first_post_mutation_canonical_verify_call` **minus** ledger cumulative at `first_test_mutation_call` (inclusive of mutation call's work + auto VERIFY) |
| `weighted_to_first_post_mutation_verify` | Ledger cumulative through `first_post_mutation_canonical_verify_call`, inclusive (includes all pre-mutation product work) |
| `weighted_post_mutation_verify_to_first_canonical_pass` | Ledger span `first_post_mutation_canonical_verify_call` → first canonical **pass** |
| `verify_fail_before_first_canonical_green` | Standard trajectory v2 |

### Secondary / report-only (required in analysis)

| Metric | Definition |
|--------|------------|
| `run_end_authored_test_count` | Source-derived `authored_test_count` at run end |
| `run_end_journey_test_count` | Count of entries in final `result.json` `tests_run` (harness journey contract) |
| `total_canonical_verify_count` | All canonical VERIFY events in run (auto + Pi + bash) |
| `canonical_verify_count_after_first_mutation` | Canonical VERIFY events with index ≥ `first_test_mutation_call` |
| `product_weighted_before_first_test_mutation` | Ledger cumulative at `first_test_mutation_call` |

Export in `trajectory.v2.json` extensions and/or companion `early-verify.v1.json`.

---

## Primary outcomes

### A. Post-mutation suite size at first feedback (co-primary)

Treatment **passes A** iff **both**:

| Criterion | v2.2 control (retro) | Treatment threshold |
|-----------|---------------------|---------------------|
| Median `authored_test_count_at_first_post_mutation_verify` | *retro-locked* | **≤ 6** **and** ≤ control median |
| Median `test_loc_at_first_post_mutation_verify` | *retro-locked* | **≤ 120** **and** ≤ control median |

**Rationale:** Absolute caps encode “early”; relative gate ensures improvement vs control at the **correct anchor**.

### B. Cost from mutation to first post-mutation feedback (co-primary)

Treatment **passes B** iff **both**:

| Criterion | v2.2 control (retro) | Treatment threshold |
|-----------|---------------------|---------------------|
| Median `weighted_mutation_to_first_post_mutation_verify` | *retro-locked* | **≤ 5,000** |
| Median call span (`first_post_mutation_canonical_verify_call` − `first_test_mutation_call`) | *retro-locked* | **≤ 1** |

**Rationale:** Auto VERIFY should fire in the **same agent turn** as first mutation — no extra model calls between mutation and real vitest output.

Also report (not gates): `weighted_to_first_post_mutation_verify`, `product_weighted_before_first_test_mutation`.

### C. Early VERIFY mechanism (co-primary — separate verdict layer)

Treatment **passes C** iff **all five**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Filesystem detects mutation when test files appear/change | `first_test_mutation_call` recorded | **5/5** runs |
| Auto latch fires on first mutation | `auto_early_verify_fired` | **5/5** runs |
| Exactly one auto VERIFY | count `verify_source: auto_early_v1` | **1** per run |
| Auto VERIFY is first post-mutation canonical VERIFY | `first_post_mutation_canonical_verify_source` | **`auto_early_v1` on 5/5** |
| Harness errors | `early_verify_error` | **0/5** |

**Not a gate:** auto VERIFY outcome (FAIL / suite_error on incomplete first write is valid feedback).

### D. Total cost non-regression (co-primary guardrail)

| Metric | Threshold |
|--------|-----------|
| Median weighted | **≤ 70,000** |
| Runs **> 140k** | **0/5** |

Failing → **REVERT** regardless of A–C.

### E. Post-mutation VERIFY repair ceiling (co-primary guardrail)

| Metric | v2.2 median | Treatment threshold |
|--------|------------:|---------------------|
| Median `weighted_post_mutation_verify_to_first_canonical_pass` | **12,400** | **≤ 18,600** (~1.5× headroom) |

Uses post-mutation anchor (not first VERIFY in run) for fair comparison when auto fires early.

---

## Secondary outcomes (report only — not KEEP gates)

| Metric | Role |
|--------|------|
| `run_end_journey_test_count` | Bucket-1 residual — did early VERIFY prevent large final suites? |
| `run_end_authored_test_count` | Source-derived final suite size |
| `total_canonical_verify_count` | Extra VERIFY tax — “more feedback” cost proxy |
| `canonical_verify_count_after_first_mutation` | Post-mutation VERIFY frequency |
| `first_post_mutation_canonical_verify_outcome` pass rate | Report — not sufficient alone for KEEP |
| `verify_fail_before_first_canonical_green` distribution | Compare to v2.2 `{0,1,1,2,2}` |
| Median calls | Context |
| `report.partial.json` / `tests_run: []` rate | Orthogonal — **not** in treatment |
| Quality floors | Median `app_rating` ≥ 68, no UX < 27 — regression → **REVERT** |

---

## Verdict table — two layers (frozen)

Analysis must report **mechanism** and **experiment** separately (same pattern as Q2 test-isolation and Q2-C).

### Layer 1 — Mechanism (Primary C)

| Verdict | Conditions |
|---------|------------|
| **PASS** | All five Primary **C** criteria met |
| **FAIL** | Any Primary **C** criterion failed |

Mechanism PASS with experiment REVERT → extension validated but **not promoted** (cf. Q2 test-isolation `memoryStorage`).

### Layer 2 — Formal experiment (Primary A, B, D, E + quality)

| Verdict | Conditions |
|---------|------------|
| **KEEP** | Primary **A**, **B**, **C**, **D**, **E** pass **and** no quality regression |
| **REVERT** | Any Primary **A**, **B**, **D**, or **E** fail; Primary **C** fail; or quality regression |

There is **no third experiment verdict**. Partial signal with mechanism PASS still yields experiment **REVERT** (cf. Q2 test-isolation, Q2-C).

**Post-KEEP:** promote `HARNESS_EARLY_VERIFY_V1` default-on — separate PR.

**Post-REVERT interpretation guide:**

| Pattern | Implication |
|---------|-------------|
| C PASS, A/B/D/E fail → experiment REVERT | Timing lever insufficient; stop investing in “better timing alone”; publish mechanism evidence, **do not promote** |
| High `run_end_journey_test_count` despite C PASS | Bucket-1 residual → future **test-count cap** arm (separate prereg) |
| High `total_canonical_verify_count` + D fail | Extra VERIFY tax dominates — early feedback too expensive |
| C PASS, E fail | Early assumption feedback worsens repair phase |

---

## Failure modes (pre-specified)

| Mode | Observable | Classification |
|------|------------|----------------|
| **F1 — No mutation detected** | Pi never creates/changes qualifying test file | Protocol failure (**F9**) |
| **F2 — Mutation missed** | Test files exist but `first_test_mutation_call` null | Primary **C** fail |
| **F3 — Auto not first post-mutation VERIFY** | Pi or bash VERIFY after mutation before auto fires | Primary **C** fail |
| **F4 — Double auto fire** | >1 `auto_early_v1` | Primary **C** fail |
| **F5 — Immature first mutation** | Auto VERIFY suite_error / FAIL 0/0 | Valid feedback — **not** C fail |
| **F6 — Pi ignores early FAIL** | High `run_end_authored_test_count` after early FAIL | Bucket-1 residual; report secondary metrics |
| **F7 — Product-only long runway** | High `product_weighted_before_first_test_mutation` | Out of scope |
| **F8 — VERIFY repair blowup** | `weighted_post_mutation_verify_to_first_canonical_pass` > gate | Primary **E** fail |
| **F9 — Null experiment** | No test mutation in **0/5** runs | Protocol failure |

---

## Future arms (NOT in this experiment)

The following are **preserved for separate preregs**. They must **not** be bundled into Q2-D — otherwise causal attribution is lost.

### Deferred — harness-owned test structure

**Hypothesis (design only):** Harness owns journey test **structure** (scaffold, slots, or file layout); Pi fills assertions — addressing brittle free-form authoring, not just feedback timing.

**Not in Q2-D:** any scaffolding, template test files, or harness-authored `it()` blocks.

### Deferred — harness-owned lifecycle pipeline

**Hypothesis (design only):**

```text
Harness-owned tests → Pi build → harness report/finalize → STOP
```

Harness owns test definitions and/or report emission end-to-end; Pi focuses on product implementation. Orthogonal to early VERIFY timing.

**Not in Q2-D:** harness-owned `report.partial.json`, `tests_run` finalization, or session STOP orchestration.

### Deferred — test-count cap v1

Only if Q2-D **REVERT** with mechanism PASS and high `run_end_journey_test_count` — separate arm.

### Deferred — test-authoring-v1 template overlay

AGENTS + `queryHelpers.ts` — separate prereg; weakened prior after Q2 sequence.

---

## Explicitly out of scope

- `HARNESS_TEST_AUTHORING_GUARD_V1` / F1–F6 (including F6 blocking)
- `HARNESS_VERIFY_REPAIR_V1`
- `TEMPLATE_TEST_ISOLATION` / `memoryStorage`
- CSS / persistence overlays
- Test-count cap, max LOC cap, max-calls cap
- Harness test scaffolding / harness-owned test structure
- Harness report finalization
- Auto VERIFY on every filesystem mutation (only **first**)
- Combined integration cohort

---

## Protocol

1. **This prereg is frozen** (2026-09-02) — no threshold or trigger changes without a dated amendment.
2. Run v2.2 retro script; lock control medians for A/B relative gates → **Amendment 1** or appendix.
3. Implement `early-verify-v1` extension + experiment script when authorized.
4. Run **5 reps:** `npm run experiment:q2-early-verify-v1 -- 5`.
5. Post-run: trajectory v2, `early-verify.v1.json`, retro comparison, secondary metrics table.
6. Analysis doc → **FINAL / FROZEN** with **dual verdict** (mechanism + experiment).

---

## Q2 program position

```text
q2-test-isolation-v1       ← CLOSED (REVERT)
q2-verify-repair-v1        ← CLOSED (REVERT)
test-authoring-guard-v1    ← CLOSED (REVERT)
q2-early-verify-v1         ← this prereg (Q2-D timing only)
        ↓ if REVERT (expected)
harness-owned-test-structure-v1   ← deferred (separate prereg)
harness-owned-lifecycle-v1        ← deferred (tests → build → finalize → STOP)
test-count-cap-v1                 ← optional if bucket-1 residual
        ↓
integration prereg
```

---

## References

- Q2-C verdict: [experiment-test-authoring-guard-v1-analysis.md](./experiment-test-authoring-guard-v1-analysis.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Trajectory metrics: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md)
- v2.2 baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Source parse reference: [experiment-test-authoring-guard-v1-preregistration.md](./experiment-test-authoring-guard-v1-preregistration.md) Appendix A (block boundaries)

---

**STOP** — prereg frozen. Implementation is the next separate step when authorized.
