# Experiment: Error Memory v1

**ID:** `error-memory-v1`  
**Arm:** treatment  
**Comparator:** `css-persistence-v1` cohort (2026-09-03) — median ~105k, 16 VERIFY fails

## Treatment

- `HARNESS_OWNED_VERIFY=1`
- `TEMPLATE_CSS_VOCABULARY=1`
- `TEMPLATE_PERSISTENCE=1`
- `HARNESS_ERROR_MEMORY_V1=1`
- All other experiment flags **OFF** (including `HARNESS_VERIFY_REPAIR_V1`)

## Mechanism (no extra LLM)

On canonical VERIFY FAIL:

1. Parse FAIL text locally
2. Match seeded error-memory catalog (regex/substring families)
3. Append **one short known hint per family per run** into the **same** VERIFY tool result
4. On later VERIFY PASS after a hint, record `pass_after_hint` in `error-memory.v1.json`

Seeded families:

| Family | Signal | Hint |
|--------|--------|------|
| `rtl_multiple_elements` | Found multiple elements with role/text | `within(row)` / unique accessible names |
| `rtl_accessible_name` | Unable to find accessible element with role | Match aria-label / accessible name |
| `test_storage_isolation` | persist/remount fail + Unable to find | Clear real JSDOM storage; watch module-time capture |

## Gates

| Gate | Threshold |
|------|-----------|
| Mechanism | ≥1 hint appended on ≥3/5 runs that have matching FAIL text |
| Cost | Median weighted **< 105,386** (css-persistence-v1 median) |
| Repair | Sum VERIFY fails **< 16** and/or median calls after first FAIL lower than baseline |
| Hard tripwire | 0/5 > 140,000 preferred; report if breached |
| Quality floor | Harness success ≥ 4/5; `useCollection` adoption ≥ 4/5 |
| Guardrail | No run appends the same family hint twice |

## Verdict

- **KEEP** if cost + repair improve vs css-persistence-v1 and quality floor holds
- **REVERT** if median weighted ≥ baseline or hints cause worse repair tails
- Product refresh QA remains manual (same as css-persistence-v1)

## Cohort

```bash
npm run experiment:error-memory-v1
```
