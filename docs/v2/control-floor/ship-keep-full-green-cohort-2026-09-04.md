# Ship cohort: KEEP + FULL_GREEN (hackathon)

**Date:** 2026-09-04  
**Stack:** VERIFY + root-error-first + RTL evidence/MULTIPLE/text + TYPECHECK + persistence + Tailwind + **FULL_GREEN_GATE=1**  
**Idea:** `contract-public/development-idea.txt` (natural bookshelf)  
**Script:** `npm run experiment:ship-keep-full-green -- 5`  
**Log:** `artifacts/experiments/ship-keep-full-green-v1/`

## Results — 5/5 success

| Rep | Run | Weighted | Calls | Green @ | V-fails | Harness |
|-----|-----|--------:|------:|--------:|--------:|---------|
| 1 | `2026-09-04T14-37-34-690Z` | **71.9k** | 15 | 15 | 3 | 3/3 |
| 2 | `2026-09-04T14-40-05-738Z` | **85.7k** | 14 | 14 | 2 | 3/3 |
| 3 | `2026-09-04T14-42-27-752Z` | **51.8k** | 11 | 11 | 2 | 3/3 |
| 4 | `2026-09-04T14-45-09-517Z` | **81.4k** | 15 | 14 | 2 | 3/3 |
| 5 | `2026-09-04T14-48-25-378Z` | **148.3k** | 34 | 34 | 8 | 3/3 |

**Median weighted: ~81.4k** (min 51.8k · max 148.3k)  
**4/5 ≤ 86k · 1/5 tail at 148k**  
**Post-green calls: 0/5** (FULL_GREEN engaged)

## Interpretation

This is the **ship stack**, not an experiment REVERT. Natural variance remains (one long repair tail). Cheap path still appears (~52k). Do not confuse with seeded 106k/227k pre-green pair (flag OFF).

## Ship recommendation

Default **ON:** this KEEP + FULL_GREEN stack.  
Leave REVERT flags **OFF**. Accept ~80k median with occasional tail rather than chasing closed levers.
