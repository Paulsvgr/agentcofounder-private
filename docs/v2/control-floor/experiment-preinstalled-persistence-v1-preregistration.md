# Experiment P1 — Preinstalled Persistence v1 — preregistration

**Status:** PREREGISTERED — treatment frozen (2026-09-01); **Amendment 1** (2026-09-01, pre-run)  
**Experiment ID:** `preinstalled-persistence-v1`  
**Short label:** **P1**  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)  
**Prior related work:** [Experiment B v1 verdict](../resources/experiment-b-v1-verdict.md) — registry delivery, cost REJECT; [CSS Vocabulary v1.1 analysis](./experiment-css-vocabulary-v1.1-analysis.md) — 3/5 refresh failures with hand-rolled storage

> **Relationship to open questions.** P1 is **not** Q1 (reduce pre-VERIFY work) and **not** Q2 (improve self-test quality). Both remain open and untouched. P1 targets **runtime persistence correctness** only.

---

## Hypothesis

When Pi implements durable browser state for a flat keyed collection, it **systematically converges** on a broken pattern:

```text
useState([])
→ useEffect load from localStorage
→ useEffect save on every state change
→ empty array written before load commits → data lost on refresh
```

Observed at **3/5** in CSS Vocabulary v1.1 (reps 3–5) and **1/5** in the v2.2 baseline (rep 4). VERIFY passes anyway because Pi-written “refresh” journeys typically **remount** rather than perform a real browser reload.

**Modest claim for KEEP** (see [Amendment 1](#amendment-1-2026-09-01-pre-run)):

> Preinstalling the known-safe `local-storage-collection` runtime primitive in the app template — with a minimal AGENTS contract — yields **0/5 real browser refresh persistence failures** with **≥4/5 adoption**.

We do **not** preregister a primary cost-reduction claim. Experiment B showed optional RESOURCES.md delivery can **increase** weighted cost while improving adoption.

**Delivery difference from Experiment B:** files ship in `app-template/` at seed time (same delivery model as CSS Vocabulary v1.1), not discovered via generated `RESOURCES.md`.

---

## Treatment (frozen — not yet implemented)

**v2.2 + preinstalled persistence primitive only.** Nothing else changes.

| Component | v2.2 control | P1 treatment |
|-----------|--------------|--------------|
| VERIFY v1.1 / harness toggles | unchanged | **unchanged** |
| CSS | Pi authors CSS (~300 lines) | **unchanged — no CSS vocabulary** |
| Persistence | Pi hand-rolls localStorage | **Preinstalled runtime primitive** |
| `RESOURCES.md` injection | none | **none** |
| Test-authoring guidance | unchanged | **unchanged (explicitly out of scope)** |
| Anti-pattern scanner / lint | none | **none** |
| Harness reload semantics | unchanged | **unchanged** |

### Files preinstalled (runtime only — three files)

Copy from `resources/files/data-patterns/local-storage-collection/` **without modification**:

| Source | Target |
|--------|--------|
| `src/lib/collectionStore.ts` | `app-template/src/lib/collectionStore.ts` |
| `src/lib/useCollection.ts` | `app-template/src/lib/useCollection.ts` |
| `src/lib/text.ts` | `app-template/src/lib/text.ts` |

**Explicitly excluded from P1:**

| File | Reason |
|------|--------|
| `src/test/memoryStorage.ts` | Test-isolation helper — belongs in a **future Q2 candidate**, not P1. Shipping an undocumented helper repeats the CSS v1 shadow-API failure mode. |

**Do not modify `collectionStore.ts` before this experiment.** The registry copy is the same artifact validated in Experiment B v1 (5/5 adoption, 44/44 journeys). Any “hardening” change would invalidate that evidence base.

**Import path:** `@/lib/collectionStore`, `@/lib/useCollection`, `@/lib/text` — verified safe via existing `tsconfig.json` paths and matching `@` aliases in `vite.config.ts` and `vitest.config.ts`. No config changes required for the treatment.

### AGENTS.md addition (minimal runtime contract)

Scope is **runtime persistence only**:

- For **flat keyed collections** that must survive browser refresh, use `createCollectionStore` + `useCollection` from `@/lib/`.
- Do **not** hand-roll `localStorage` load/save with separate `useEffect`s.
- Pi still writes: entity type, `parse` function, domain validation, UI, and journey tests.

**Not in contract:**

- How Pi writes or isolates tests (Q2 scope).
- Non-collection state (wizards, timers, nested trees) — Pi chooses freely.

### Non-treatment hygiene (repo docs only)

The registry doc and `local-storage-collection.json` constraints claim storage resolves **lazily on each load/save**. The implementation captures storage **once at construction** — sufficient for browser and jsdom (both expose `localStorage` before module evaluation). Correct the misleading wording in repo docs/registry **separately**; do **not** change the primitive as part of P1 implementation.

---

## Control

Frozen v2.2 baseline cohort (5 runs). No preinstalled persistence primitive.

| Rep | Run ID | Weighted | Persistence (overlay) |
|-----|--------|----------:|----------------------|
| 1 | `2026-08-31T21-16-45-263Z` | 78,009 | pass |
| 2 | `2026-08-31T21-19-44-728Z` | 60,852 | pass |
| 3 | `2026-08-31T21-22-09-667Z` | 49,449 | pass |
| 4 | `2026-08-31T21-24-11-541Z` | 108,708 | **fail** |
| 5 | `2026-08-31T21-28-10-966Z` | 50,364 | pass |

**Baseline persistence failures:** **1/5**  
**Baseline median weighted:** 60,852

---

## Frozen persistence protocol (primary outcome)

Defined **before** treatment runs. Authoritative for all 5 treatment reps.

### Manual hard-refresh check

After harness success, for each run:

1. `npm run dev` in generated `app/`
2. Create at least one durable entity through the UI
3. Confirm it renders in the list
4. **Hard browser refresh** (F5 / reload — not React remount, not vitest-only)
5. Entity must still be present with the same identifying fields

**Pass:** data survives step 5. **Fail:** list empty or entity missing.

Recorded as `data_state_persistence` (0 or 20) in human overlay — same rubric as baseline.

### Supporting classifiers (explanatory — never override manual refresh)

| Metric | Definition |
|--------|------------|
| `persistence_adopted` | Final `app/src/**` imports `createCollectionStore` or `useCollection` from `@/lib/` for primary collection state |
| `hand_rolled_localStorage` | Pi-written files (excluding preinstalled `src/lib/collectionStore.ts`, `useCollection.ts`, `text.ts`) call `localStorage.getItem` / `setItem` inside hooks or components |
| `startup_race_pattern` | Post-run scan: `useState([])` + `useEffect` calling `localStorage.setItem` without a `loaded` guard — reporting only |
| `test_storage_strategy` | How Pi isolated storage in tests (jsdom `localStorage`, hand-rolled mock, etc.) — **reporting only; Q2 evidence, not a P1 gate** |

**Known Q2 confound (not a P1 blocker):** template vitest setup runs `cleanup()` after each test but does **not** clear `localStorage`, so state can bleed across `it` blocks within a file. Without `memoryStorage.ts`, Pi must handle test isolation itself. Any repair spirals from that are Q2 evidence, not P1 failures.

---

## Success criteria

### 1. Persistence + adoption (co-primary — both required for KEEP)

Per [Amendment 1](#amendment-1-2026-09-01-pre-run). Neither alone is sufficient.

| Criterion | Threshold |
|-----------|-----------|
| Refresh persistence failures | **0/5** |
| Manual refresh performed | **5/5 runs** |
| Primary collection uses primitive | **≥ 4/5** runs |
| Hand-rolled localStorage for primary collection | **≤ 1/5** runs |

Adoption 2–3/5 with 0/5 persistence failures → **RELOCATED**, not KEEP.

### 2. Cost (regression guard only — not primary)

| Criterion | Threshold |
|-----------|-----------|
| Median weighted total | **≤ 80,000** |
| Hard regression tripwire | **0/5 runs > 140,000** |

**Not a KEEP condition:** beating v2.2 median (underpowered at n=5; Experiment B v1 failed cost despite strong adoption).

### 3. Quality floors (must not regress)

| Criterion | Threshold |
|-----------|-----------|
| Median `app_rating` | **≥ 68** |
| Median `usability_ux` | **≥ 28** |
| Individual UX floor | **no run < 27** |
| Robustness failures | **0/5** |

Persistence scored in §1.

### 4. Contract tripwires

| Tripwire | Threshold |
|----------|-----------|
| Primary flat collection persisted without primitive | **> 1/5 runs = contract concern** (paired with §2) |
| Pi edits preinstalled `collectionStore.ts` / `useCollection.ts` / `text.ts` | Reporting only; not auto-REVERT unless persistence fails |

Wrapper layers (e.g. `useBooks.ts` over the store) are **allowed** — Experiment B saw 2/5 do this without breaking adoption.

---

## Verdict table

Per [Amendment 1](#amendment-1-2026-09-01-pre-run). Evaluated after cost/quality guards; persistence rows take precedence over cost-only RELOCATED.

| Failures | Adoption | Cost / quality | Verdict |
|----------|----------|----------------|---------|
| **0/5** | **≥4/5** | guards pass | **KEEP → promote as v2.3 = v2.2 + persistence** |
| **0/5** | 2–3/5 | any | **RELOCATED** (works when used; Pi often ignores it) |
| **1/5**, failing run did **not** adopt | ≥4/5 | any | **INCONCLUSIVE** — adoption gap; diagnose before re-run |
| **≥1/5**, any failing run **did** adopt | any | any | **REVERT** (mechanism or contract failed — triage misuse vs defect in analysis) |
| **≥2/5** | any | any | **REVERT** |
| any | any | quality ❌ | **REVERT** |
| any | any | cost guard ❌ only | **RELOCATED** |

### Adopter-failure triage (analysis only — experiment result still REVERT)

If a run **adopted** the primitive but failed manual refresh, classify post-run:

| Class | Examples | Follow-up (outside P1 verdict) |
|-------|----------|--------------------------------|
| **API misuse** | Store recreated every render; state mutated outside `commit`; parallel hand-rolled `localStorage` for same key | Contract wording fix |
| **Primitive defect** | Correct usage per AGENTS still loses data on refresh | Primitive or implementation fix |

Either class → **REVERT** for P1 (contract did not produce reliable persistence).

### Verdict meanings

- **KEEP** — 0/5 refresh failures with ≥4/5 adoption. Ship primitive into control floor (without CSS).
- **RELOCATED** — Persistence OK but adoption partial, or cost guard failed without persistence failure.
- **INCONCLUSIVE** — Single non-adopter failure with otherwise strong adoption; do not promote; diagnose.
- **REVERT** — Adopter failure, ≥2/5 failures, quality regression, or mechanism/contract failure.

**Post-KEEP:** CSS vocabulary stacking is a **separate preregistered experiment** (v2.3 combo), not part of P1.

---

## Future Q2 candidate (not P1)

A separate test-quality experiment may preinstall and document `memoryStorage.ts` to test whether Pi writes **better persistence tests** (isolation, remount vs reload semantics) — without changing the runtime persistence implementation. That arm belongs under Q2, preregistered after P1 closes.

---

## Protocol

1. **This prereg is frozen** — [Amendment 1](#amendment-1-2026-09-01-pre-run) applied pre-run; no further threshold changes without a dated amendment.
2. Implement treatment: copy three runtime files + AGENTS section; **revert CSS v1.1 template changes** so treatment = v2.2 + persistence only.
3. Optionally correct doc/registry lazy-storage wording (hygiene only; no primitive code change).
4. Run **5 treatment reps**: `npm run experiment:preinstalled-persistence-v1 -- 5` (script added at implementation).
5. Post-run: adoption classifiers + startup-race scan on all 5 runs.
6. Human overlay: manual hard refresh on all 5 + standard rubric.
7. Apply verdict table. Write analysis doc.

---

## What P1 does not test

- CSS vocabulary or combined v2.3 floor
- Test-authoring quality or test storage isolation (**Q2**)
- Pre-VERIFY cost reduction (**Q1**)
- Harness reload semantics or static anti-pattern lint
- Cross-app generality (single home-library prompt)
- Recipe-tier scaffolds (pre-wired domain module)
- Cost reduction as primary outcome
- `memoryStorage.ts` or documented test helpers

---

## Distinction from Experiment B v1

| | Experiment B v1 | P1 |
|--|-----------------|----|
| Baseline | v2.1 (~78k median) | **v2.2 (~61k median)** |
| Delivery | optional `RESOURCES.md` slice | **preinstalled in template** |
| Primary metric | cost (failed) | **refresh persistence** |
| Files shipped | 4 (incl. `memoryStorage.ts`) | **3 runtime only** |
| Test guidance in contract | mandated `createMemoryStorage()` | **none** |
| Manual refresh scoring | not primary | **primary gate** |

Do not compare P1 weighted totals directly to Experiment B v1 cohorts.

---

## Pre-implementation checklist

- [x] Experiment ID `preinstalled-persistence-v1` (lowercase/hyphen — no dots)
- [x] Three-file runtime-only preinstall confirmed
- [x] `memoryStorage.ts` excluded; future Q2 candidate noted
- [x] `@/lib/` import path verified (tsconfig + vite + vitest)
- [x] `collectionStore.ts` left unchanged (Experiment B validated)
- [ ] Revert CSS v1.1 template to v2.2 CSS at implementation time (byte-verify: `styles.css` = **966 B**, `AGENTS.md` = **1,581 B** vs `artifacts/runs/2026-08-31T21-16-45-263Z/app-template/`)
- [ ] Run script wired at implementation time

---

## Amendment 1 (2026-09-01, pre-run)

**Reason:** Original primary gate **≤1/5 refresh failures** was carried from the CSS prereg as a **non-regression floor**. v2.2 baseline is already **1/5** — the control satisfies the treatment success bar. Caught before any P1 reps ran.

**Primary outcome (co-primary, stricter):** KEEP requires **0/5 refresh failures** **and** **≥4/5 adoption**. Neither alone is sufficient.

**Mechanism expectation (softened):** An adopting run **should not hit the known startup race** (empty `useState` + save-before-load) **if the primitive is used as intended**. A run could still fail refresh through API misuse or a different persistence bug — not claimed impossible.

**Per-failure classification:** Tag each failure by adoption (`persistence_adopted`). Adopter failures are triaged in analysis as **API misuse** vs **primitive defect**; **either → REVERT** for the experiment result.

**Supporting context (not a gate):** Pooled hand-rolled failure rate **4/10** (v2.2 **1/5** + CSS v1.1 **3/5**) establishes the systematic problem independent of this experiment. Not used as a statistical control.

**CSS Vocabulary v1.1:** Remains a **separate validated candidate** (strong cost signal; formal REVERT on contract/quality). Not part of P1 treatment. Stack after P1 closes via separate prereg.

**Implementation revert check:** Restore template from archived v2.2 baseline run; verify byte counts match before adding persistence files.

---

## References

- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Cost decomposition (Q1/Q2 framing): [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Primitive source: [local-storage-collection.md](../../resources/docs/data-patterns/local-storage-collection.md)
- Experiment B: [experiment-b-v1-verdict.md](../resources/experiment-b-v1-verdict.md)
- Persistence signal: [experiment-css-vocabulary-v1.1-analysis.md](./experiment-css-vocabulary-v1.1-analysis.md)
- Deferred Exp5 rationale: [not-included-exp5-primitives.md](./not-included-exp5-primitives.md)
