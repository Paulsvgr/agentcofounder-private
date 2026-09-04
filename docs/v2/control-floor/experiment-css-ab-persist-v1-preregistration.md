# Experiment: CSS vocabulary A/B (persistence stack)

**ID:** `css-ab-persist-v1`  
**Arms:** `A` = persistence-only · `B` = CSS + persistence  
**Locked:** 2026-09-03 — product-quality first; tokens second

## Question

> Does the restrictive CSS vocabulary improve the final **100-point** app enough to justify its token cost and loss of design freedom?

This is a **product-quality experiment first**, token experiment second.

## Rubric (do not invent buckets)

| Rubric | Points |
|--------|-------:|
| Usability & UX | 30 |
| Persistence | 20 |
| Robustness | 20 |
| API / integration readiness | 15 |
| Maintainability | 15 |
| **Total** | **100** |

Pay special attention to **Usability & UX (30)** — that is what CSS is supposed to justify.

## Arms

### A — Persistence only (`css-ab-persist-v1-a`)

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_CSS_VOCABULARY=0
```

### B — CSS + persistence (`css-ab-persist-v1-b` / comparator)

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_CSS_VOCABULARY=1
```

### Explicitly OFF in both

```text
HARNESS_ERROR_MEMORY_V1=0
HARNESS_VERIFY_REPAIR_V1=0
HARNESS_TAIL_SWEEP_V1=0
HARNESS_TEST_AUTHORING_GUARD_V1=0
HARNESS_EARLY_VERIFY_V1=0
HARNESS_OWNED_TEST_STRUCTURE_V1=0
HARNESS_CONVERGENCE_INTERVENTION_V1=0
HARNESS_SCOPE_SEQUENCE_V1/V2/V2B=0
TEMPLATE_TEST_ISOLATION=0
```

No new AGENTS guidance, no test coaching, no `tsc` on FAIL, no other overlay changes.

## Comparator reuse (B)

**Preferred B:** existing `root-error-first-v1-1` cohort (2026-09-03), which matches Arm B flags.

- Use **success** reps only for cost/quality medians.
- **Discard** invalid / provider-EPIPE fifths (do not treat ~43k fails as product evidence).
- If a clean 5th B success is needed for balance, **rerun one B rep** under identical harness — do not invent equivalence with older `css-persistence-v1` (no root-error-first).

## Runs

- Same product idea and environment for A and B.
- **5 reps Arm A** (new).
- **5 success-equivalent Arm B** (reuse + optional fill).

```bash
npm run experiment:css-ab-persist-v1-a -- 5
# B: reuse root-error-first-v1-1 successes; optional:
# npm run experiment:css-ab-persist-v1-b -- 1   # fill only if needed
```

## Primary outcome: actual app quality

Do **not** primarily judge generated Vitest.

Independently score each final app on the **100-point rubric** above.

**Use each generated app** (not screenshots alone). External/manual journeys for both arms:

```text
add book
edit
delete
lend with borrower
return
filter lent
refresh → data survives
blank/invalid input
empty borrower
repeated operations
malformed/null persisted data → no crash
basic responsive / readable / navigation quality
```

For UX (30), review:

- information hierarchy
- obviousness of actions
- form layout
- editing flow
- lend/return flow
- feedback / errors
- mobile / responsive behavior
- coherence vs merely “styled”

## Secondary outcomes

| Metric | Why |
|--------|-----|
| Weighted tokens | Cost among working apps |
| Model calls | Effort |
| Pre-first-VERIFY weighted | Build-phase cost |
| VERIFY FAIL count | Repair pressure |
| Calls after first FAIL | Repair-tail length |
| Harness success | Floor |
| `useCollection` adoption | Persistence mechanism stuck |

Use these to separate:

```text
CSS affects build cost?
CSS affects repair cost?
CSS affects actual UX / total 100?
```

## Decision rule (locked before results)

**DROP CSS vocabulary** if persistence-only (A):

- does **not meaningfully reduce** the 100-point quality score, especially **UX 30**,
- retains persistence / robustness,
- and is equal or cheaper economically  
  **OR** is only modestly more expensive while quality is equal/better.

**KEEP CSS vocabulary** only if B shows a **clear, repeatable product-quality advantage** large enough to justify restrictions and any cost.

Hard priority:

> Ranking is low weighted tokens **among apps that work well**.  
> If A looks better at 85k and B looks worse at 75k → **do not keep B** for the 10k savings.

Binary after this A/B: **CSS stays or CSS goes.**

## Explicit non-goals

- Not “does custom CSS cost more tokens?”
- Not Error Memory / test-authoring / soft design primitives
- Not solving Pi-test→product-damage (next phase after this A/B)

## Frozen interpretation

> Is our CSS harness intervention helping us **win** (100-pt apps + fair efficiency)?

Then move to the bigger disease: **Pi’s own tests causing Pi to damage otherwise-correct product code.**
