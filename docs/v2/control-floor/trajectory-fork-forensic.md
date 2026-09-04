# Trajectory Fork Forensic — Cheap vs Expensive to First VERIFY

**Status:** FINAL / FROZEN (2026-09-02)  
**Phase closure:** [forensic-phase-2-trajectory-fork.md](./forensic-phase-2-trajectory-fork.md)  
**Question:** Where does the fork happen between cheap (~50–65k) and expensive (~90–109k) trajectories, and is it prompt pressure, Pi scope expansion, or model variance?

**Runs compared:**

| Label | Run ID | Total | VERIFY @ |
|---|---|---:|---:|
| v2.2 Rep3 49k | `2026-08-31T21-22-09-667Z` | 49,449 | 8 |
| v2.2 Rep5 50k | `2026-08-31T21-28-10-966Z` | 50,364 | 7 |
| v2.2 Rep2 61k | `2026-08-31T21-19-44-728Z` | 60,852 | 11 |
| v2.2 Rep4 109k (bridge) | `2026-08-31T21-24-11-541Z` | 108,708 | 14 |
| S1 Rep1 65k | `2026-09-02T13-21-24-620Z` | 64,512 | 9 |
| S1 Rep2 100k | `2026-09-02T13-24-00-401Z` | 100,435 | 10 |
| S1 Rep3 90k | `2026-09-02T13-26-56-008Z` | 89,545 | 12 |
| S1 Rep4 93k | `2026-09-02T13-30-04-976Z` | 93,354 | 10 |
| S1 Rep5 105k | `2026-09-02T13-34-28-334Z` | 105,193 | 9 |

**Data:** `artifacts/forensic/trajectory-fork-analysis.v1.json`, events replay, assistant text through first VERIFY.

No code or prompt changes. No intervention recommendation.

---

## Executive summary — where the fork happens

All runs share the same product idea, v2.2 environment (S1 toggle does not alter prompt), and GLM-5.2. The fork is **not one event** — it is **which strategy Pi commits to at call 4–6**:

```text
Calls 1–3: recon (cheap ≈ expensive)

Call 4–6: STRATEGY FORK
  ├─ CHEAP: "build core → CSS → tests → VERIFY" (same/next call)
  └─ EXPENSIVE: "build ALL functionality + polish → maybe refine tests → VERIFY later"

Post-fork:
  cheap  → 6–8 consolidated journeys, span 1, ~31k pre-VERIFY
  expensive → optional scope + verbose tests + preflight, span 2–3, ~49–62k pre-VERIFY
```

**Attribution mix (cohort level, not per-run binary):**

| Cause | Verdict |
|---|---|
| **Prompt/contract pressure** | **Partial** — empty states, validation, and “comprehensive journeys” are prompt-supported; prompt also says “smallest sufficient suite” which expensive runs violate |
| **Pi scope expansion** | **Strong for tail runs** — search (Rep5), sort (Rep3/4), undo (Rep2 v2.2), cancel flows — **no prompt support** |
| **Model variance** | **Strong for timing/verbosity** — same optional features appear in cheap Rep5 (cancel lend) at 50k; expensive path = deferred VERIFY + heavier calls + granular tests stacking |

---

## Required vs optional behaviors (product idea authority)

From `contract-public/development-idea.txt`:

| Behavior | Required / implied | Present in all runs |
|---|---|---|
| Add book (title, author, category) | ✅ Required | ✅ |
| Lend with borrower name | ✅ Required | ✅ |
| Clear borrower on return | ✅ Required | ✅ |
| Filter to lent-out only | ✅ Required | ✅ |
| Lent-out count | ✅ Implied (“nice to see how many”) | ✅ |
| Edit / delete mistaken book | ✅ Required | ✅ |
| localStorage persistence | ✅ Implied (single-user own computer) | ✅ |

| Behavior | Required? | Who invented it | First introduced @ |
|---|---|---|---|
| Empty-state UI copy | Implied by prompt boundary handling, not idea | Most runs | App write call 5–6 |
| Empty title/author validation | Implied by prompt + skill | Most runs | App write call 4–6 |
| Cancel lend without recording | ❌ Optional | v2.2 Rep5, S1 Rep3/4, v2.2 Rep4 | call 4–6 |
| Cancel edit | ❌ Optional | v2.2 Rep2/4, S1 Rep3/4/5 | call 5–8 |
| Undo/redo | ❌ **Not in idea** | **v2.2 Rep2 only** | **call 4** |
| Alphabetical sort | ❌ **Not in idea** | S1 Rep3, S1 Rep4 | **call 6** |
| Search box | ❌ **Not in idea** | **S1 Rep5 only** | **call 6** (542 LOC App) |
| Confirm-delete banner | ❌ Optional UX | S1 Rep5, S1 Rep3 (partial) | call 5–6 |
| Separate empty-title AND empty-author tests | ❌ Speculative granularity | S1 Rep4, v2.2 Rep5 | first test write |
| Stats bar (distinct from header count) | ❌ Optional chrome | S1 Rep1/5, v2.2 Rep4 | call 6–8 |

**Cost after first optional scope (weighted, through first VERIFY):**

| Run | First optional @ | Feature | Cost accumulated after |
|---|---:|---|---:|
| v2.2 Rep3 49k | 5 | empty_state UI | 20,152 |
| v2.2 Rep5 50k | 4 | empty_state UI | 17,877 |
| v2.2 Rep2 61k | 4 | **undo/redo** | **36,998** |
| v2.2 Rep4 109k | 5 | cancel_edit | 46,227 |
| S1 Rep1 65k | 6 | empty_state UI | 20,559 |
| S1 Rep2 100k | 5 | empty_state UI | 40,372 |
| S1 Rep3 90k | 6 | **sort_alpha** | **42,702** |
| S1 Rep4 93k | 6 | **sort_alpha** | 32,199 |
| S1 Rep5 105k | 6 | **search_ui** | **35,398** |

Optional UI alone does not deterministically cause expense (Rep5 v2.2 has cancel_lend at 50k). Expense correlates when optional scope **stacks with** deferred VERIFY and granular tests.

---

## A. Scope expansion — per run

### v2.2 cheap

**Rep3 49k** — minimal scope  
- Optional in app: empty_state, validation (prompt-driven)  
- No search, sort, undo, cancel flows in tests  
- **6 consolidated journeys** — each maps 1:1 to idea  

**Rep5 50k** — prompt-driven extras, still cheap  
- App: cancel_lend flow, validation  
- Tests: separate empty-title test, cancel-lend test (8 total)  
- **Still cheap** because tests @5, VERIFY @7 (span 2), no post-test preflight  

**Rep2 61k** — scope expansion in cheap cohort  
- **undo/redo @ call 4** — pure Pi invention (no idea/prompt support)  
- Extra refactor call @6 (“undo integration is clumsy”)  
- App write deferred to @8; tests @10; VERIFY @11  
- **61k not 49k** because of undo scope + late test, not test count (9 tests)

### v2.2 Rep4 109k (bridge)

- Cancel edit/lend, empty state, stats bar @ call 5 App write (401 LOC)  
- CSS @9, HTML title @10, tests @11  
- **Test refinement @12–13** (label scoping) before VERIFY @14  
- 10 tests, 3 failures @ first VERIFY → tail repair  
- **Same shape as S1 expensive:** build-complete → granular tests → refine → late VERIFY  

### S1 Rep1 65k (near-parity)

- Optional: empty_state, stats_bar only  
- **6 consolidated tests**, span 1, VERIFY @9  
- Behaves like cheap Rep3 with +1 extra CSS/App call  

### S1 expensive

**Rep2 100k** — verbosity not scope  
- No major invented features (search/sort/undo absent)  
- **First test write: 258 LOC for 7 tests** (37 LOC/test vs cheap ~25)  
- Post-test: index.html polish @8, **tsc preflight @9**, VERIFY @10  
- Fork: **deferred VERIFY + verbose tests**, not feature invention  

**Rep3 90k** — sort + deferred VERIFY  
- **sort_alpha, cancel_edit, cancel_lend @ call 6** App write  
- Tests @9 (222 LOC first write), **refinement @10**, **tsc @11**, VERIFY @12  
- Pi @8: “update page title **and** write tests” but splits across 9–12  

**Rep4 93k** — granular test explosion  
- sort + cancel flows @ call 6 (367 LOC App — moderate)  
- **First test write @9: 285 LOC, 15 tests** — all granular edge cases in one call  
- VERIFY @10 immediately — but **8 failures** drive repair tail  
- Fork @9: **consolidated-vs-granular testing strategy**  

**Rep5 105k** — major scope + heavy App  
- confirm_delete @5, **search_ui @6** in **542 LOC App**  
- 9 tests including search + confirm-delete journey  
- VERIFY @9 with **8 failures**  
- Fork @6: **search feature invention**  

---

## B. Why tests were delayed

### After minimally functional app (first App.tsx write)

| Run | App first written @ | Calls before first test | What Pi did instead of testing |
|---|---:|---:|---|
| v2.2 Rep3 | 5 | 2 | CSS @6 only |
| v2.2 Rep5 | 4 | 1 | (tests immediately @5) |
| v2.2 Rep2 | 8 | 2 | undo refactor @6, CSS @9 |
| v2.2 Rep4 | 5 | 6 | refactor @6–7, CSS @9, HTML @10 |
| S1 Rep1 | 6 | 2 | CSS @7 |
| S1 Rep2 | 5 | 2 | CSS @6 |
| S1 Rep3 | 6 | 3 | CSS @7, index.html @8 |
| S1 Rep4 | 6 | 3 | CSS @7, index.html @8 |
| S1 Rep5 | 6 | 2 | CSS @5 (early), index.html @7 |

**Classification of pre-test calls (expensive pattern):**

| Class | Examples | Necessary? |
|---|---|---|
| styling | CSS write 9–13k wt | Debatably — prompt says responsive/accessible; cheap runs also do CSS |
| product_polish | index.html title | Optional — not needed before first test |
| extra feature | sort, search, cancel UX in App | Optional — Pi-invented or prompt-stretched |
| recon | extra reads, bash | Sometimes unnecessary re-reads (S1 Rep3 @3) |

**Pi explicit text on delaying tests:**

| Run | Call | Quote |
|---|---|---|
| v2.2 Rep3 | 6 | “Now the stylesheet:” → then call 7 tests |
| v2.2 Rep2 | 3 | “I'll create the App with localStorage persistence, **then write tests**” — but inserts undo work first |
| v2.2 Rep4 | 5 | “build the main App component with **all the functionality**” |
| S1 Rep2 | 4 | Plans “4. **Comprehensive tests**” but sequences App → CSS → tests → title → tsc |
| S1 Rep4 | 9 | “I'll cover **every critical user journey**” — writes 15 tests before VERIFY |
| S1 Rep5 | 5 | “styles, App component, and tests” — does CSS @5, **542 LOC App @6**, tests @8 |

Pi **never explicitly says** “I am deferring tests for correctness.” Delay is implicit in **build-complete-first planning**.

### After first test mutation, before VERIFY

| Run | Span | Between-test calls | Classification |
|---|---:|---|---|
| v2.2 Rep3 | 1 | VERIFY only | ✅ ideal |
| v2.2 Rep5 | 2 | index.html title | product_polish |
| S1 Rep1 | 1 | VERIFY only | ✅ ideal |
| S1 Rep2 | 3 | index.html, **tsc preflight** | polish + preflight |
| S1 Rep3 | 3 | test cleanup, **tsc**, VERIFY | test_refinement + preflight |
| S1 Rep4 | 1 | VERIFY only | ✅ (but 15 tests caused 8 failures) |
| S1 Rep5 | 1 | VERIFY only | ✅ (but 8 failures) |
| v2.2 Rep4 | 3 | test label scoping ×2 | test_refinement |

**Preflight tsc before first VERIFY** appears only in S1 Rep2/3 — Pi text: “check TypeScript before running tests” / “verify build compiles”. Not required by prompt before first VERIFY (harness owns verify).

---

## C. Granular vs consolidated testing

| Run | First test LOC | `it/test` blocks | Helpers | Granular flags | Fail @ 1st VERIFY | Could consolidate? |
|---|---:|---:|---:|---|---:|---|
| v2.2 Rep3 49k | 149 | 6 | 1 | none | 0 (SUITE) | — |
| v2.2 Rep5 50k | 171 | 8 | 0 | empty-title, cancel-lend | 2 | marginally |
| v2.2 Rep2 61k | 171 | 9 | 0 | empty-title | 0 | yes (9 journeys) |
| v2.2 Rep4 109k | 179 | 10 | 1 | empty-title | 3 | yes |
| S1 Rep1 65k | 132 | 6 | 2 | none | 1 | — |
| S1 Rep2 100k | **258** | 7 | 1 | empty-title | 1 | yes (verbose bodies) |
| S1 Rep3 90k | 222 | 8 | 3 | cancel-lend | 1 | marginally |
| S1 Rep4 93k | **285** | **15** | 4 | **all granular flags** | **8** | **strongly yes** |
| S1 Rep5 105k | 202 | 9 | 1 | empty-title, confirm-delete | **8** | yes |

**Consolidation examples (Rep4 — could be 6–8 journeys):**

| Granular test | Could merge into |
|---|---|
| empty title + empty author (separate) | single “rejects invalid add” |
| cancel edit | edit journey |
| cancel lend | lend journey |
| empty state before books / empty lent filter | filter journey |
| sort alphabetically | **not in idea — omit** |

---

## D. Prompt pressure map

Sources: `solution/system-prompt.md`, `contract-public/journeys.md`, `app-template/AGENTS.md`, `solution/skills/mvp-builder/SKILL.md`.

| Extra behavior | Prompt citation | Causality tag |
|---|---|---|
| Empty-state UI | system L11 “boundary cases”; skill step 4 “empty states” | **supported** |
| Validation (empty title/author) | system L11 “invalid input”; skill step 4 “validation” | **supported** |
| Separate empty-title test | skill step 7 “no speculative edge cases” | **possible** — validation supported, separate test is Pi choice |
| “Comprehensive” / “every journey” tests | AGENTS “critical user journeys”; skill step 7 “every applicable observable behavior” | **possible** — encourages breadth, conflicts with “smallest sufficient” |
| Cancel lend / cancel edit flows | — | **no prompt support** (idea doesn't mention cancel) |
| Undo/redo | — | **no prompt support** |
| Search | — | **no prompt support** |
| Alphabetical sort | — | **no prompt support** |
| Confirm-delete dialog | system L11 “duplicate or repeated actions” | **possible** stretch — not clearly implied |
| CSS before tests | skill step 4 “responsive layout” | **possible** — layout yes, ordering not specified |
| tsc before first VERIFY | — | **no prompt support** (verify tool exists) |
| Test label scoping refinement | skill step 7 scoped queries preference | **supported** as quality, not as pre-VERIFY delay |

**Internal prompt tension (important):**

```text
system-prompt L12 + skill step 7:
  “smallest sufficient suite… no duplicate or speculative cases”

system-prompt L11 + skill step 4:
  “Handle empty and invalid input, boundary cases… empty states”
```

Expensive runs **follow the second line** and **ignore the first**. Rep4 (15 tests) is the clearest violation of “smallest sufficient suite.”

---

## E. Residual model variance

After accounting for prompt, environment, scope, and structure:

| Divergence | External cause? | Variance candidate? |
|---|---|---|
| Rep5 search feature | ❌ no prompt | **yes** — pure Pi invention |
| Rep2 undo/redo (v2.2) | ❌ no prompt | **yes** |
| Rep3/4 sort | ❌ no prompt | **yes** |
| CSS-before-tests ordering | possible prompt | **yes** — cheap Rep3 also does CSS @6 but tests @7 immediately |
| 542 LOC single App write (Rep5) | ❌ | **yes** — same features could be ~360 LOC |
| tsc preflight before VERIFY (Rep2/3) | ❌ | **yes** |
| 258 LOC test file for 7 tests (Rep2) | partial (scoped queries skill) | **yes** — verbosity choice |
| 15 tests in one write (Rep4) | conflicts with prompt | **yes** — granularity choice |
| v2.2 Rep5 cancel-lend at 50k vs S1 Rep3 cancel-lend at 90k | same optional feature | **yes** — timing/stacking, not feature presence |

**Conclusion:** Model variance manifests primarily as **strategy selection** (build-complete vs test-soon) and **call weight**, not as different prompts or environments. Same optional feature + immediate VERIFY (Rep5 v2.2) → cheap. Same environment + deferred VERIFY + granular tests → expensive.

---

## Per-run decision trees (through first VERIFY)

### Cheap archetype — v2.2 Rep3 49k ✅

```text
1 recon ──→ 2 read docs ──→ 3 read src ──→ 4 types/hook
                                              │
5 App.tsx (344 LOC) ──→ 6 CSS ──→ 7 tests (6 journeys, 149 LOC)
                                      │
                                      └──→ 8 VERIFY (SUITE_ERROR → later cheap repair)
```

**Fork point:** none — stayed on cheap path throughout.

---

### Cheap-with-scope — v2.2 Rep5 50k ✅

```text
1 recon ──→ 2 read ──→ 3 plan ──→ 4 App+hook (285 LOC, cancel_lend, validation)
                                        │
                                   5 tests (8 journeys) ──→ 6 title ──→ 7 VERIFY (2 fail)
```

**Fork point:** call 4 adds cancel_lend — **scope fork**, but **no timing fork** (tests @5).

---

### Scope-expansion cheap — v2.2 Rep2 61k ⚠️

```text
1 recon ──→ 2 read ──→ 3 plan ──→ 4 hook w/ UNDO ←── SCOPE FORK (no prompt support)
                                      │
                                 5 refactor ──→ 6 undo simplify ──→ 7 recon
                                                                        │
                                   8 App (360 LOC) ──→ 9 CSS ──→ 10 tests ──→ 11 VERIFY ✓
```

**First divergence @4:** undo/redo invention. Cost: 61k (not 49k) despite VERIFY @11 with 0 failures.

---

### Bridge tail — v2.2 Rep4 109k 🔴

```text
1-3 recon ──→ 4 plan "all functionality" ──→ 5 App (401 LOC, cancel/empty/stats)
                                                  │
                                             6 refactor ──→ 7 fix ──→ 8 fix stray
                                                                        │
                              9 CSS ──→ 10 HTML ──→ 11 tests (10) ──→ 12 refine labels
                                                              │
                                                         13 refine edit test
                                                              │
                                                         14 VERIFY (3 fail)
```

**First divergence @5:** build-complete strategy + optional cancel/stats.  
**Second divergence @12:** test refinement before VERIFY (timing fork).

---

### Near-parity — S1 Rep1 65k ✅

```text
1-3 recon ──→ 4 plan ──→ 5-6 types/App ──→ 7 CSS ──→ 8 tests (6) ──→ 9 VERIFY (1 fail, Tier-1 later)
```

Same shape as Rep3. Minor extra CSS/App weight.

---

### Verbose-not-scope — S1 Rep2 100k 🔴

```text
1-3 recon ──→ 4 plan (lists tests last) ──→ 5 App ──→ 6 CSS
                                                          │
                    7 tests (258 LOC, 7 journeys) ←── VERBOSITY FORK
                          │
                    8 HTML ──→ 9 tsc ←── PREFLIGHT FORK ──→ 10 VERIFY (12.7k wt, cold context)
```

**First divergence @7:** 258 LOC test write (not extra features).  
**Second @9:** tsc before verify. No search/sort/undo.

---

### Deferred VERIFY — S1 Rep3 90k 🔴

```text
1-3 recon ──→ 4-5 types/hook ──→ 6 App (sort, cancel) ←── SCOPE FORK @6
                                        │
                              7 CSS ──→ 8 HTML ──→ 9 tests (222 LOC)
                                                      │
                                                10 test cleanup ←── TIMING FORK
                                                      │
                                                11 tsc ──→ 12 VERIFY
```

**First divergence @6:** sort + cancel flows (no prompt).  
**Second @10–11:** refinement + tsc delay VERIFY to @12.

---

### Granular tests — S1 Rep4 93k 🔴

```text
1-4 recon ──→ 5 hook ──→ 6 App (367 LOC, sort/cancel) ──→ 7 CSS ──→ 8 HTML
                                                                        │
                              9 tests (285 LOC, 15 journeys) ←── GRANULARITY FORK
                                        │
                                   10 VERIFY (8 fail) → converging repair tail
```

**First divergence @9:** 15 granular tests (violates “smallest sufficient suite”). App scope moderate; test explosion drives 8 failures.

---

### Major scope — S1 Rep5 105k 🔴

```text
1-4 recon ──→ 5 CSS early ──→ 6 App (542 LOC, SEARCH) ←── SCOPE FORK @6
                                        │
                              7 HTML ──→ 8 tests (9) ──→ 9 VERIFY (8 fail)
```

**First divergence @6:** search UI + 542 LOC monolith. Single largest App write in cohort.

---

## Master fork diagram

```text
                    same idea + v2.2 env + GLM-5.2
                              │
                         calls 1–3 recon
                              │
                    ┌─────────┴─────────┐
                    │   call 4 plan   │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    test-soon plan      build-complete plan    invent feature
    (Rep3, Rep5,        (Rep4, Rep2,          (undo@4, sort@6,
     S1 Rep1)           S1 Rep3)              search@6)
         │                    │                    │
         v                    v                    v
    App+CSS+tests         App+refine+CSS       extra impl calls
    span 1–2              span 3–6             + heavier writes
         │                    │                    │
         ├─ consolidated      ├─ refine tests      ├─ verbose tests
         │  6–8 tests        │  before VERIFY     │  (258 LOC)
         │                    │                    │
         v                    v                    v
    VERIFY soon           VERIFY late           VERIFY + many fails
    ~30k pre-VERIFY       ~50–62k pre-VERIFY    ~42–62k + 30k repair
         │                    │                    │
         v                    v                    v
      ~50k total           ~90–109k total        ~93–105k total
```

---

## Answers to the three causes

### 1. Prompt/contract pressure — **partial, not sufficient**

- **Encourages:** empty states, validation, breadth of journey coverage, accessible/scoped tests  
- **Discourages (ignored):** “smallest sufficient suite”, “no speculative cases”  
- Cheap Rep5 proves prompt-supported extras (cancel lend, validation tests) **can still land at 50k** if VERIFY is immediate  

### 2. Scope expansion by Pi — **decisive in tail runs**

- **Search (Rep5), sort (Rep3/4), undo (Rep2):** no prompt support — pure Pi invention  
- **Rep4 15-test granularity:** conflicts with prompt — Pi choice, not contract requirement  
- v2.2 Rep4 bridge shows same scope+timing pattern without S1  

### 3. Pure model variance — **primary for timing and verbosity**

- **When** Pi writes tests vs continues building: no prompt difference  
- **How verbose** test bodies are (258 LOC / 7 tests): variance  
- **tsc preflight** before VERIFY: variance  
- **Call token weight** on same action types: variance (see call-by-call doc)  

---

## Implication (analysis only — no intervention)

The next lever depends on **which fork branch** dominates the target cohort:

| If target is… | Fork branch | Hypothesis for future work (NOT authorized here) |
|---|---|---|
| Rep4/5 repair tail | Granular tests → 8 failures @ VERIFY | Test consolidation / first-VERIFY failure surface |
| Rep2/3 pre-VERIFY | Deferred VERIFY + preflight | Test timing / build-complete bias |
| Rep5 | Search + 542 LOC App | Scope guard for uninvented features |
| Rep2 v2.2 | Undo invention | Same scope guard |
| Overall median | Strategy variance at call 4–6 | Understand why Pi picks build-complete despite “smallest sufficient suite” |

**Do not design an intervention in this document.**

---

## Related artifacts

- Pre-VERIFY authoring: `docs/v2/control-floor/s1-first-verify-authoring-forensic.md`
- Call-by-call weights: `docs/v2/control-floor/s1-vs-v22-call-comparison.md`
- JSON: `artifacts/forensic/trajectory-fork-analysis.v1.json`
