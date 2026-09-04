# Experiment analysis: Free CSS vs preinstalled Tailwind (`tailwind-ab-persist-v1`)

**Date:** 2026-09-03 / scored 2026-09-04  
**Prereg:** [experiment-tailwind-ab-persist-v1-preregistration.md](./experiment-tailwind-ab-persist-v1-preregistration.md)  
**Export:** `artifacts/exports/cohort-tailwind-ab-persist-v1-2026-09-03.zip`  
**Arm A′ source:** `css-ab-persist-v1-a` (free CSS)  
**Arm C:** `tailwind-ab-persist-v1-c` (successes incl. post-balance replacements for reps 3–5)

## Verdict

### **TAILWIND OVERLAY: KEEP**

Styling track is **closed**. Do not run further CSS/Tailwind A/Bs.

**Active default candidate:**

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_TAILWIND=1
TEMPLATE_CSS_VOCABULARY=0
HARNESS_ERROR_MEMORY_V1=0
HARNESS_VERIFY_REPAIR_V1=0
```

## Why

Product first. C is ~20% cheaper at the median (**77.6k** vs **97.1k**) with **no design-freedom cap** comparable to CSS vocabulary.

| | A′ Free CSS | C Tailwind |
|--|------------:|-----------:|
| Success | 5/5 | **5/5** |
| Median weighted | 97.1k | **77.6k** |
| Range | 49k–**207k** | **70k–104k** |
| `useCollection` | 5/5 | 5/5 |
| Pi Tailwind install/config | — | **0/5** |
| `window.prompt` | 1/5 | **1/5** |
| Design visibly capped | No | **No** |

Vocabulary caused a prompt epidemic (4/4). Tailwind did not (1/5, same as free CSS). Interaction structure still varies across C1–C5 — Tailwind supplies styling primitives, not product dictation.

Approximate source/journey rubric: A′ and C both ~85 overall; C has a slightly stronger consistency floor. Not enough A′ UX upside to overturn economics.

Token nuance: Tailwind `className` strings are noisy (~3k median chars vs ~0.5k) but wipe most of `styles.css`; combined app styling/code size is similar, and **median output fell** 10.9k → 8.7k. Median **calls did not fall** (15 → 19) — savings are expression/output, not fewer turns.

## Unlocks next

Highest-value lever is no longer styling. See [next-lever-test-as-oracle.md](./next-lever-test-as-oracle.md).
