# Results: product-quality / build-contract v1

**Status:** **REVERT / NOT KEEP** (2026-09-04)  
**Flag:** `HARNESS_PRODUCT_QUALITY_CONTRACT_V1` remains **OFF** (default)  
**Prereg:** [experiment-product-quality-contract-v1-preregistration.md](./experiment-product-quality-contract-v1-preregistration.md)  
**Compare:** `artifacts/experiments/product-quality-contract-v1/pair-compare.json`

## Pair

| | Control `…12-48-50-746Z` | Treatment `…12-51-52-540Z` |
|--|--:|--:|
| Contract | off | on (prompt hash differs) |
| Status | success 12/12 | success 12/12 |
| Calls | **16** | 24 |
| Weighted | **~85k** | ~143k (~69% more) |
| Green | @13 | @20 |
| Human app rubric | **same score** | **same score** |

## Locked interpretation

Mechanism worked (treatment prompt included the quality contract).  
Apps looked the **same** to human scoring — **no quality lift**.  
Cost/calls clearly **worse**.

> **no quality lift → no KEEP**, even if the checklist is “correct.”

## Decision

**REVERT.** Do not enable by default. Do not spend more reps chasing this wording today.

Code may remain in-tree behind the flag for later experiments; default stays **OFF**.

## Next (last day)

Not more product-quality prompt tuning unless a *different* mechanism is proposed. Prefer **monster-call / per-turn output control** if continuing harness work.
