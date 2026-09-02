# Agent components (Experiment A v2)

Frozen design for `resource-slice-ui-v2`. v1 (`resource-slice-ui-v1`) remains the **raw shadcn pilot** — do not compare v1 runs to v2.

## Hypothesis

> Can we make Pi cheaper and more reliable by **reducing UI decision count** through a small **predictable component language**?

This is not “does shadcn save tokens?” Primitives (shadcn/Radix/native) are hidden; Pi sees stable **agent components** on **family contracts**.

## Architecture

```text
PRIMITIVES (hidden)     → implementation detail (native HTML in v2)
AGENT COMPONENTS (Pi)   → FormField, SelectField, ActionButton, …
RECIPES/BLOCKS (later)  → optional compositions
```

### Families (v2)

| Family | Agent members | Shared props |
|--------|---------------|--------------|
| `field-v1` | FormField, SelectField | label, value, onChange, error?, required?, disabled? |
| `action-v1` | ActionButton | label, onAction, variant?, disabled?, ariaLabel?, type? |
| `overlay-v1` | ConfirmDialog | open, onOpenChange, title, description?, confirm/cancel, onConfirm |
| `row-v1` | DataRow, DataList | id, title, description?, actions? / list label + empty |
| `state-v1` | EmptyState, Stat | title, description?, value? (Stat), action? (EmptyState) |

Contracts live in `resources/contracts/families.json`. Registry entries under `resources/registry/agent/` reference `tier: agent`, `family`, and `props_contract`.

## Agent slice (treatment)

Assembled preset `ui-v2`:

- `lib-utils`, `theme-default`
- `form-field`, `select-field`, `action-button`, `confirm-dialog`
- `data-row`, `data-list`, `empty-state`, `stat`

**Excluded:** raw `@/components/ui/*`, local-storage/data-pattern, recipes.

## Validation pipeline

```text
ASSEMBLE → RESOURCE SMOKE (family + per-component tests in src/resource-smoke)
         → tsc/build, @ alias in Vite AND Vitest
         → HAND TO PI → product + journey tests
```

Assembler runs smoke gate by default for `ui-v2` (`npm run assemble:resources -- --preset ui-v2`).

## RESOURCES.md shape

1. Family contracts (once per family)
2. Theme setup
3. Per agent component: import, extra props, example, use-when, test rule, do-not

Explicit rule: **do not import `@/components/ui/*`**.

## Success criterion (mechanical adoption)

Pi reads `RESOURCES.md` → composes agent contracts → rarely inspects internals → rarely repairs mechanics → green quickly.

Failure signals: reads of primitive source, custom reimplementations, boundary violations, heavy test repair.

## Run

```bash
npm run assemble:resources -- --preset ui-v2
npm run experiment:a-v2          # 5 reps, port 3000 hygiene
```

```bash
export RUN_EXPERIMENT=resource-slice-ui-v2
export RUN_ARM=treatment
export RUN_REP=1
npm run challenge
```
