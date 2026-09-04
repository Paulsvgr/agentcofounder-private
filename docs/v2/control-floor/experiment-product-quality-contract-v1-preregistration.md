# Experiment: product-quality / build-contract v1

**ID:** `product-quality-contract-v1`  
**Status:** **REVERT / NOT KEEP** — same human rubric score, ~69% more weighted ([results](./experiment-product-quality-contract-v1-results.md))  
**Flag:** `HARNESS_PRODUCT_QUALITY_CONTRACT_V1` (default **OFF**)  
**Parked note superseded:** [parked-product-quality-prompt.md](./parked-product-quality-prompt.md) — MULTIPLE cohort is done; unparked → tested → reverted.

## Why this lever (last day)

Repair-tail board is frozen. Judges score the **generated app**, not our Control App.

Official rubric (100 pts):

| Category | Max |
|----------|----:|
| UX / usability | 30 |
| Persistence | 20 |
| Robustness | 20 |
| API readiness | 15 |
| Maintainability | 15 |

Harness already gets many apps to **PASS**. PASS ≠ 100. This lever pushes quality **during initial build**, before VERIFY repair.

## Treatment (mechanism only)

When `HARNESS_PRODUCT_QUALITY_CONTRACT_V1=1`, insert a **short** quality checklist immediately after `Required outcome:` in the system prompt:

- Usable UI (validation + error feedback, responsive)
- Persistence behind a small storage boundary
- Robustness for requested mutable workflows (not speculative edges)
- UI / domain / persistence separation
- Scope discipline (no unnecessary features)

**No** `UX=30 / Persistence=20 / …` dump. **No** giant verbose prompt.

Control arm: flag `=0` (baseline `system-prompt.md` only).  
All other flags identical (locked KEEP stack; hard-stop OFF).

**Code:** `solution/product-quality-contract-v1.md` + `.ts`  
**Wired:** `src/run-challenge.ts` + `src/v2/challenge-prompt.ts`

## Primary outcomes

| Metric | Notes |
|--------|-------|
| Human / overlay app rubric total | usability, persistence, robustness, api readiness, maintainability |
| Harness success / journeys | must not regress |
| Weighted cost / calls | secondary — do not KEEP if quality flat and cost worse |

## Gates

| Gate | Pass if |
|------|---------|
| Mechanism | Treatment prompt contains `Product quality contract`; control does not |
| Quality | Treatment rubric ≥ control on same idea (or clear UX/robustness lift) |
| Non-regression | Journeys / harness success not worse |
| Cost | Report; KEEP allowed if quality wins even if cost flat |

## Verdict

- **KEEP** if quality improves without serious cost/journey regression  
- **REVERT** if overplanning / mega-calls / quality flat or worse  

## Commands

```bash
npx vitest run test/product-quality-contract-v1.test.ts
npm run experiment:product-quality-contract-v1 -- both 1
```

## Explicit non-goals

- Control App work  
- Reopening repair-tail KEEPs  
- Templates/assembler rewrite  
- Monster-call caps (next if time)
