# Experiment: CSS + Persistence v1

**ID:** `css-persistence-v1`  
**Arm:** treatment  
**Baseline comparators:** CSS vocabulary v1.1 (~51k median, persistence weak) · preinstalled-persistence-v1 alone (0/5 refresh fail, cost higher / UX uneven)

## Treatment (only)

- `HARNESS_OWNED_VERIFY=1` (v2.2 floor)
- `TEMPLATE_CSS_VOCABULARY=1` (css-vocabulary-v1.1 overlay)
- `TEMPLATE_PERSISTENCE=1` (persistence-v1 overlay: `createCollectionStore` + `useCollection`)
- All other experiment flags / overlays **OFF**

## Hypothesis

CSS gives ~50k cost + consistent UI vocabulary. Persistence-v1 removes the systematic StrictMode refresh wipe (15/15 persist pass in reviewed data). Combined, the harness should produce cheap apps that still survive real product journeys.

## Primary gates (product first)

Evaluate with **manual / external journeys**, not only agent Vitest:

| Gate | Threshold |
|------|-----------|
| Add → hard refresh → data remains | **0/5 failures** |
| Lend → borrower persists across refresh | **0/5 failures** |
| Return works | **0/5 failures** |
| Malformed / `null` localStorage does not white-screen | **0/5 crashes** |
| Harness `result.status === success` | ≥ 4/5 |
| Adoption of `useCollection` / store API | ≥ 4/5 |

## Secondary gates (cost)

| Gate | Threshold |
|------|-----------|
| Median weighted | ≤ 60,852 (v2.2) — stretch target ~50k CSS band |
| Hard tripwire | 0/5 > 140,000 |
| Median model calls | report only (no gate) |

## Reported (not gated)

- Usability / UX rubric
- Robustness (empty lend, validation)
- Inline-style evasion under CSS vocabulary
- Verify-loop count

## Verdict rule

- **KEEP** if product gates pass and median weighted ≤ v2.2.
- **RELOCATED** if product gates pass but cost regresses vs CSS-alone.
- **REVERT** if refresh/crash gates fail (mechanism did not stick under CSS).

## Cohort

5 reps · `npm run experiment:css-persistence-v1`
