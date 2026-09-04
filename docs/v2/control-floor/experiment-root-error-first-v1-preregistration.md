# Experiment: Root-error-first VERIFY v1

**ID:** `root-error-first-v1`  
**Arm:** treatment  
**Comparator:** `css-persistence-v1` cohort (2026-09-03) — median ~105k, 5/5 success

## Treatment (only)

- `HARNESS_OWNED_VERIFY=1`
- `TEMPLATE_CSS_VOCABULARY=1`
- `TEMPLATE_PERSISTENCE=1`
- `HARNESS_ROOT_ERROR_FIRST_V1=1`
- All other experiment flags **OFF**, including:
  - `HARNESS_ERROR_MEMORY_V1=0`
  - `HARNESS_VERIFY_REPAIR_V1=0`
  - no new prompts / AGENTS text
  - no `tsc --noEmit` on FAIL
  - no new overlays / test-authoring changes

## Hypothesis

When VERIFY fails with a causal runtime/suite error buried under Testing Library symptoms, putting **ROOT / RUNTIME ERROR** first improves Pi’s **first diagnosis**, which should shorten repair tails vs css-persistence-v1.

## Mechanism (no extra LLM)

On canonical VERIFY FAIL:

1. Parse compact reporter failure blocks locally
2. Classify TypeError / ReferenceError / SyntaxError / causal `Error` messages as **root**, including Vite `Failed to resolve import` / suite collect errors
3. Classify TestingLibraryElementError / AssertionError as **secondary**
4. If any root exists: rewrite VERIFY body to:

```text
ROOT / RUNTIME ERROR
...

SECONDARY TEST FAILURES
...
```

5. If no extractable root signal: leave FAIL text **unchanged**

## Primary learning metric

**First-diagnosis accuracy** (manual review per rep):

After the **first** VERIFY FAIL, inspect Pi’s next **1–3** actions and label:

| Label | Meaning |
|-------|---------|
| `correct` | Names / fixes the causal runtime/import/suite problem before unrelated product edits |
| `secondary` | Chases an RTL / copy / selector symptom of the root |
| `wrong` | Unrelated path (e.g. storage/aria when root was import/runtime) |

Do **not** judge the cohort from median tokens alone.

## Gates

| Gate | Threshold |
|------|-----------|
| Quality floor | Harness success ≥ 4/5; `useCollection` adoption ≥ 4/5 |
| Cost (secondary) | Median weighted **< 105,386** (css-persistence-v1) preferred |
| Repair (secondary) | Report VERIFY fail count / calls after first FAIL vs baseline |
| Hard tripwire | Stop and inspect any run **> 140–150k** with clearly **wrong** first diagnosis — do not finish the cohort blind |

## Verdict

- **KEEP** if first-diagnosis accuracy improves vs css-persistence samples and quality floor holds (cost improvement is supporting evidence)
- **REVERT** if first diagnosis does not improve, or wrong-diagnosis tails worsen
- Product refresh QA remains manual (same as css-persistence-v1)

## Explicit non-goals (this cohort)

- Error Memory
- `tsc --noEmit` diagnostics
- Prompt / overlay / test-authoring changes
- Console-capture enrichment beyond what already appears in VERIFY text

## Known limitation

If the causal exception is swallowed by product code and **never appears** in VERIFY output, this treatment cannot elevate it. That case is out of scope for v1; do not expand scope mid-cohort.

## Cohort

```bash
npm run experiment:root-error-first-v1
```

5 reps. Review protocol mandatory for each run.
