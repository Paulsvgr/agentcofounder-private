# Experiment: Free CSS vs preinstalled Tailwind

**ID:** `tailwind-ab-persist-v1`  
**Arms:** `A` / `A′` = free CSS · `C` = preinstalled Tailwind  
**Prerequisite:** [CSS vocabulary GOES](./experiment-css-ab-persist-v1-analysis.md)  
**Locked:** 2026-09-04 — product-quality first; tokens second

## Question

> Does **preinstalled Tailwind** (infrastructure, not restriction) improve the 100-point app and/or weighted tokens vs free hand-written CSS, while preserving design freedom?

## Rubric

| Rubric | Points |
|--------|-------:|
| Usability & UX | 30 |
| Persistence | 20 |
| Robustness | 20 |
| API / integration readiness | 15 |
| Maintainability | 15 |
| **Total** | **100** |

## Arms

### A′ — Persistence + free CSS (`tailwind-ab-persist-v1-a` / reuse)

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_TAILWIND=0
```

**Preferred reuse:** `css-ab-persist-v1-a` cohort (2026-09-03) — same flags. Rerun only if harness code materially differs.

### C — Persistence + preinstalled Tailwind (`tailwind-ab-persist-v1-c`)

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_TAILWIND=1
```

Harness installs Tailwind **before Pi starts** (`tailwindcss` + `@tailwindcss/vite`, Vite plugin, `@import "tailwindcss"`). Pi must not spend calls on install/config.

AGENTS: utilities freely; do **not** reinstall/configure Tailwind; do **not** “accept a fixed vocabulary appearance.”

### Explicitly OFF in both

```text
HARNESS_ERROR_MEMORY_V1=0
HARNESS_VERIFY_REPAIR_V1=0
TEMPLATE_CSS_VOCABULARY=0
```

No Error Memory, no new CSS restrictions, no third styling arm.

## Primary / secondary outcomes

Same as CSS A/B: **100-pt product score first** (use the apps), then weighted tokens, calls, VERIFY tails, harness success, `useCollection` adoption.

Also report: Tailwind install/config calls by Pi (target **0**), long `className` output share if measurable.

## Decision rule (before results)

**KEEP Tailwind overlay** if C shows clear product and/or efficiency advantage without capping design (no prompt-dialog epidemic, no “accept default” friction).

**DROP / defer Tailwind** if C is no better on UX/total quality and not clearly cheaper, or if Pi still fights the setup.

Binary after: Tailwind stays in default stack or free CSS remains default.

## Cohort

```bash
# Arm C (new)
npm run experiment:tailwind-ab-persist-v1-c -- 5

# Arm A′: prefer reuse css-ab-persist-v1-a; optional fill:
npm run experiment:tailwind-ab-persist-v1-a -- 5
```
