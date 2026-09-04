# Experiment: Relevance-preserving VERIFY (RTL role/name evidence)

**ID:** `verify-rtl-evidence-v1`  
**Status:** IN PROGRESS — offline proof green; matching control + treatment cohort  
**Depends on:** default stack (VERIFY + root-error-first + persistence + Tailwind)

## Treatment (mechanism only)

Replace line-count truncation of Testing Library role+name failures with **relevance-preserving** compact MESSAGE when `HARNESS_VERIFY_RTL_EVIDENCE_V1=1` (default ON when unset).

```text
Unable to find … role="button" name="Add book"

QUERIED
role="button"
name="Add book"

BUTTONS PRESENT
- "+ Add book"
- "All"
- "Lent out"
```

Control arm sets `HARNESS_VERIFY_RTL_EVIDENCE_V1=0` (legacy `slice(0,12)` path). **All other flags identical.**

**Code:** `app-template-base/compactFailureMessage.ts` + `compactFailureReporter.ts`  
**Not included:** Error Memory, repair prompts, `rg` enrichment, auto-stop, product-vs-test advice.

## Cohort commands

```bash
npm run experiment:verify-rtl-evidence-v1-control -- 5
npm run experiment:verify-rtl-evidence-v1-treatment -- 5
```

Default stack (both arms):

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_TAILWIND=1
TEMPLATE_CSS_VOCABULARY=0
```

| Arm | Flag | Experiment id |
|-----|------|---------------|
| Control | `HARNESS_VERIFY_RTL_EVIDENCE_V1=0` | `verify-rtl-evidence-v1-control` |
| Treatment | `HARNESS_VERIFY_RTL_EVIDENCE_V1=1` | `verify-rtl-evidence-v1-treatment` |

## Activation split (required)

Do **not** require every rep to hit a role+name FAIL.

```text
all runs
vs
activated = ≥1 VERIFY FAIL whose MESSAGE contains QUERIED + role PRESENT header
         (treatment) or equivalent role+name miss under legacy truncate (control)
```

Judge causality primarily on the **activated** subset.

## Primary outcomes (behavioral)

| Metric | Notes |
|--------|-------|
| First diagnosis after first role/name FAIL | `correct` \| `secondary` \| `wrong` (manual forensic) |
| Same normalized FAIL repeated before green | count / max streak |
| `WRONG_PRODUCT` edits | forensic class |
| Calls after first relevant FAIL → green | |
| Weighted repair cost after first relevant FAIL | |

## Secondary

| Metric |
|--------|
| Total weighted / calls |
| Harness success |
| Product-quality floor (spot) |

## Gates

| Gate | Metric |
|------|--------|
| Mechanism | Activated treatment FAILs contain `QUERIED` + candidates or `(none)` |
| Diagnosis | Activated treatment: fewer wrong “UI not rendering” first diagnoses vs control |
| Repeats | Activated: fewer identical role+name signatures ≥3× before green |
| Wrong product | Activated: fewer WRONG_PRODUCT name chases |
| Cost | Report all-run + activated medians; do not over-weight non-activated noise |
| Quality floor | Harness success ≥ 4/5; persistence ≥ 4/5 |

## Verdict rule

- **KEEP** if mechanism holds on activated runs and repair behavior improves without quality loss  
- **REVERT** if activated tails worsen or product quality drops  

## Explicit non-goals

- Deciding test vs product for Pi  
- `rg` code search on VERIFY  
- Error Memory / verify-repair prompts  
- Auto-stop when green  

## Offline proof

```bash
npx vitest run test/compact-failure-message.test.ts
```

See also: [forensic-207k-verify-oracle.md](./forensic-207k-verify-oracle.md), [next-lever-test-as-oracle.md](./next-lever-test-as-oracle.md).
