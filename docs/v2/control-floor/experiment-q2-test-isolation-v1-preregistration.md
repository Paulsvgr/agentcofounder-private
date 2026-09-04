# Experiment Q2 — Test Isolation v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-01)  
**Experiment ID:** `q2-test-isolation-v1`  
**Short label:** Q2 (narrow arm — **not** the full Q2 program)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))

> **Scope boundary.** This experiment tests **one narrow hypothesis**: whether preinstalled **deterministic test storage isolation** (`memoryStorage.ts` + AGENTS guidance) reduces isolation-related test problems and VERIFY/test-repair cost.  
> **It does NOT claim** to solve real browser reload testing, selector quality, suite-error repair, or hollow refresh journeys. Those remain open for a **later, stronger Q2 intervention** (likely harness-owned test orchestration / stronger deterministic verification).

> **Relationship to prior work.** P1 rep 3 (303k) and CSS rep 3 (68k) show **broader** test-repair spirals than isolation alone explains. P1 deliberately excluded `memoryStorage.ts`. Hollow refresh failures (remount ≠ reload) are **documented evidence** motivating a future arm — **not** a claim this treatment fixes.

---

## Problem statement

### What the evidence actually shows

| Signal | Source | What it implies |
|--------|--------|-----------------|
| **303k / 51 calls** with persistence passing refresh | P1 rep 3 | Test/VERIFY repair spiral — **not** runtime persistence failure |
| **4 VERIFY fails** before green, mostly `App.test.tsx` | CSS rep 3 | Selector/suite repair loop — **broader than isolation** |
| **3/5 refresh fail** while VERIFY green | CSS v1.1 | Hollow reload coverage — **remount ≠ reload**; **not fixed by `memoryStorage`** |
| **localStorage bleeds across tests** | P1 prereg confound | Vitest `cleanup()` without clearing storage — **directly addressable by this treatment** |
| Test-only hand-rolled `localStorage` | P1 reps 2 & 4 | Inconsistent isolation patterns |

### Known isolation gap (what this treatment targets)

From P1 preregistration: template vitest setup runs `cleanup()` but **does not clear `localStorage`**. Pi hand-rolls mocks inconsistently. Registry ships `createMemoryStorage()` — excluded from P1 as a Q2 candidate.

**This experiment targets that gap only.**

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF), preinstalling `memoryStorage.ts` plus minimal AGENTS test-isolation guidance will:

1. **Reduce VERIFY/test-repair trajectory cost** — fewer canonical failures before first green and less weighted spend in the VERIFY loop.
2. **Improve test isolation behavior** — fewer cross-test storage leaks and less ad hoc test `localStorage` mocking.

**Out of scope for this hypothesis:** real browser reload semantics, journey test authoring quality (selectors, suite structure), hollow refresh rate as a primary outcome.

---

## Treatment (single bundle — frozen at implementation)

**v2.2 + test-isolation overlay only.**

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=1    # new overlay at implementation time
```

| Component | v2.2 OFF/OFF | Q2 treatment |
|-----------|--------------|--------------|
| Base | `app-template-base` | **same** |
| CSS vocabulary | off | **off** |
| Persistence primitive | off | **off** |
| Runtime collection store | Pi hand-rolls | **unchanged** |
| VERIFY / harness | v2.2 | **unchanged** |
| Exp3 test policy (prompt) | in baseline | **unchanged** |
| **`src/test/memoryStorage.ts`** | absent | **preinstalled** |
| **AGENTS test section** | absent | **added (below)** |

### File preinstalled (test only)

| Source | Target |
|--------|--------|
| `resources/files/data-patterns/local-storage-collection/src/test/memoryStorage.ts` | `src/test/memoryStorage.ts` |

**Excluded:** runtime `collectionStore` / `useCollection` / `text` (P1); CSS; VERIFY changes; vitest setup auto-clear (confounds attribution).

### AGENTS.md addition

**Marker:** `## Test isolation (preinstalled)`

- For tests touching durable storage, prefer `createMemoryStorage()` from `@/test/memoryStorage` so storage **does not leak between tests**.
- Reset or inject isolated storage in `beforeEach` when tests mutate persisted state.
- Do not hand-roll ad hoc `localStorage` mocks when the preinstalled helper suffices.

**Explicitly NOT in contract:**

- Real browser reload testing instructions (future arm).
- Remount-as-reload guidance (future arm / harness).
- Runtime persistence API mandates.

> **Treatment bundle note:** Success may come from AGENTS behavior change even if Pi never imports `memoryStorage`. Adoption is a **mechanism check**, not a co-primary gate.

---

## Control reference (v2.2 lock — locked numbers)

Historical cohort — **no re-run required** unless base hash drift detected.

### Cost (non-regression reference)

| Metric | v2.2 (5 reps) |
|--------|---------------|
| Median weighted | **60,852** |
| Range | 49,449 – 108,708 |
| Runs >140k | **0/5** |

### Trajectory (primary comparison — from `trajectory.v2.json`)

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
| Distribution | 0, 1, 1, 2, 2 |
| Reps with **0** verify fails before green | **1/5** |
| Reps with **≥2** verify fails before green | **2/5** |
| Median `verify_tool_count` | **2** |
| Median weighted before first VERIFY | **~36k** (cost decomposition) |
| Median weighted VERIFY → first PASS | **~12.4k** (cost decomposition) |

Metric definition: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) — `verify_fail_before_first_canonical_green`.

---

## Primary outcomes (co-primary — trajectory + isolation)

### A. VERIFY / test-repair trajectory (the actual intervention target)

Treatment **passes A** iff **all three**:

| Criterion | v2.2 control | Treatment threshold |
|-----------|--------------|---------------------|
| Median `verify_fail_before_first_canonical_green` | **1** | **≤ 1** |
| Reps with **0** verify fails before green | **1/5** | **≥ 2/5** |
| Reps with **≥ 2** verify fails before green | **2/5** | **≤ 1/5** |

Control distribution: `{0, 1, 1, 2, 2}` → median 1, 1/5 at 0, 2/5 at ≥2.

This allows KEEP when the median stays 1 but the **distribution** clearly improves (more clean runs, fewer heavy-repair tails).

**Optional aspirational note** (not a gate): median 0 (≥3/5 at 0) would be a strong signal beyond the frozen bar.

Also report (not additional gates):

- Median weighted VERIFY → first canonical PASS (~12.4k control)
- Tail post-mortem for any rep >120k (classify test-spiral vs pre-VERIFY, same method as P1 rep 3 / v2.2 rep 4)

### B. Test isolation behavior (mechanism-aligned)

Treatment **passes B** iff **both**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Cross-test storage bleed | Post-run review: tests that fail due to `localStorage` state from a prior `it` in the same file | **0/5 runs** with a **confirmed** bleed case |
| Hand-rolled test `localStorage` mocks | Final-source scan: ad hoc `localStorage` mock/spy patterns in `src/**/*.test.ts(x)` excluding use of `createMemoryStorage` | **≤ 2/5 runs** |

**Confirmed bleed case (frozen definition):** a test failure or flake attributable to persisted keys surviving `afterEach`/`cleanup` without intentional shared state — documented per run in analysis.

**`createMemoryStorage` adoption:** mechanism report only — **not** a KEEP gate.

---

## Secondary outcomes (important — not co-primary)

### Cost non-regression guard

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Median weighted | **≤ 70,000** | **Non-regression**, not “beat 60,852” |
| Runs >140k | **0/5** | Tail tripwire |

Failing non-regression → **REVERT** regardless of trajectory gains.

### Manual hard refresh (truthfulness — report only)

Human overlay: manual hard refresh on all 5 reps (same protocol as P1/CSS).

| Metric | Control (v2.2) | Role in this experiment |
|--------|----------------|-------------------------|
| Refresh failures | **1/5** (rep 4) | **Secondary report** — do not expect improvement from `memoryStorage` |
| Hollow refresh (VERIFY pass + refresh fail) | CSS/P1 evidence | **Track and report** — motivates **future Q2 arm**, not this KEEP gate |

> **`memoryStorage` does not simulate browser reload.** Do not interpret refresh outcomes as treatment success/failure for this prereg.

### Quality floors (regression guard)

Same family as P1: median `app_rating` ≥ 68, no UX < 27, robustness reporting — **regression → REVERT**.

---

## Verdict table

| Verdict | Conditions |
|---------|------------|
| **KEEP** | Primary **A** (trajectory) **and** **B** (isolation) pass **and** cost non-regression (≤70k median, 0/5 >140k) **and** no quality regression |
| **RELOCATED** | Mixed signal — partial trajectory or isolation improvement without full A+B — **do not promote**; publish partial mechanism evidence |
| **REVERT** | A or B fail, cost non-regression failed, or quality regression |

**Post-KEEP:** add `test_isolation` assembler overlay toggle. **Do not** amend the frozen [template-assembler-spec.md](./template-assembler-spec.md) until implementation — new overlay/toggle is an implementation detail.

**Post-KEEP next candidate (separate prereg):** harness-owned reload/remount orchestration or stronger VERIFY persistence semantics — addresses hollow refresh and broader repair spirals **beyond isolation**.

---

## Explicitly out of scope

- Runtime persistence primitive (P1)
- CSS / themes
- VERIFY tool or harness reload behavior changes
- Vitest setup auto-clearing `localStorage`
- Hollow refresh as co-primary success
- Combined integration cohort
- New Run UI / embedding selection
- Amending frozen assembler spec (implementation adds overlay only)

---

## Protocol

1. **This prereg is frozen** — no threshold changes without a dated amendment.
2. Implement one overlay + experiment script (`TEMPLATE_TEST_ISOLATION=1`) when authorized.
3. Run 5 reps: `npm run experiment:q2-test-isolation-v1 -- 5` (script added at implementation).
4. Post-run: trajectory v2 export, isolation scans, manual refresh overlay, mechanism adoption report.
5. Verdict + analysis doc.

---

## Future Q2 program (not this experiment)

```text
q2-test-isolation-v1     ← this prereg (narrow)
        ↓ if KEEP
q2-reload-verification   ← harness orchestration / real reload semantics (broader spiral + hollow tests)
        ↓
combined integration prereg (P1 + CSS + Q2 winners)
```

---

## References

- P1 analysis (rep 3 spiral): [experiment-preinstalled-persistence-v1-analysis.md](./experiment-preinstalled-persistence-v1-analysis.md)
- P1 Q2 candidate note: [experiment-preinstalled-persistence-v1-preregistration.md § Future Q2](./experiment-preinstalled-persistence-v1-preregistration.md)
- CSS v1.1 hollow persistence: [experiment-css-vocabulary-v1.1-analysis.md](./experiment-css-vocabulary-v1.1-analysis.md)
- Cost decomposition Q2: [control-floor-v2.2-cost-decomposition.md § Open question Q2](./control-floor-v2.2-cost-decomposition.md)
- Assembler + provenance: [template-assembler-spec.md](./template-assembler-spec.md), [template-base-provenance.json](./template-base-provenance.json)

---

**STOP** — prereg only, no Q2 implementation.
