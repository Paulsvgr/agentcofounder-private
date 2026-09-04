# Experiment analysis: CSS vocabulary A/B (`css-ab-persist-v1`)

**Date:** 2026-09-03 / scored 2026-09-04  
**Prereg:** [experiment-css-ab-persist-v1-preregistration.md](./experiment-css-ab-persist-v1-preregistration.md)  
**Export:** `artifacts/exports/cohort-css-ab-persist-v1-2026-09-03.zip`

## Verdict

### **CSS VOCABULARY: GOES**

```text
TEMPLATE_CSS_VOCABULARY=0
```

**Keep (then superseded by Tailwind KEEP):**

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_CSS_VOCABULARY=0
```

**Active default after Tailwind A/B:** see [experiment-tailwind-ab-persist-v1-analysis.md](./experiment-tailwind-ab-persist-v1-analysis.md) (`TEMPLATE_TAILWIND=1`).

## Why

Product-quality first. B (~9k cheaper median weighted) mostly avoids **writing CSS**, not a leaner agent loop (median calls A **15** vs B **27**). B raises a consistency/a11y floor but **caps UX ceiling** (native `window.prompt` in 4/4 B apps vs 1/5 A; forbidden inline styles in 2/4 B apps). Approximate source/journey scoring: A UX ~24/30 vs B ~22/30; totals ~tie. Per locked rule: do not keep a small token optimization that hurts the app.

Caveat: UX scores are code/journey review from archive artifacts, not pixel-perfect browser sessions — still sufficient for the binary.

## Unlocks next

```text
A′ = persistence + free CSS
C  = persistence + preinstalled Tailwind
```

Tailwind KEEP closed the styling track. Next lever: [next-lever-test-as-oracle.md](./next-lever-test-as-oracle.md).
