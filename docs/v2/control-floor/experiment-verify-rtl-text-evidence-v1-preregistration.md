# Experiment: VERIFY text-miss evidence (rtl_text)

**ID:** `verify-rtl-text-evidence-v1`  
**Status:** **KEEP** (2026-09-04) — factual reporter; modest seeded delta only ([keep](./experiment-verify-rtl-text-evidence-v1-keep.md))  
**Depends on:** locked stack (VERIFY + root-error-first + RTL role/name + MULTIPLE + TYPECHECK KEEP; hard-stop OFF)  
**Audit:** [audit-repair-tail-rtl-text-multiple.md](./audit-repair-tail-rtl-text-multiple.md)

## Causal story

`rtl_text` misses are expensive because VERIFY:

1. Keeps Testing Library’s **non-factual** function-matcher tip.
2. Collapses the container dump into tag-token `MATCHES` (`<body>`, `</h1>`, …).

Pi cannot distinguish copy/grammar drift vs split text vs absent vs wrong-row from VERIFY alone.

## Treatment (mechanism only)

When `HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=1` (default **ON** when unset — KEEP), compact MESSAGE for
`Unable to find an element with the text:` / `display value:` becomes:

```text
Unable to find an element with the text: 1 are currently lent out.

QUERIED
text="1 are currently lent out."

VISIBLE TEXT
1. "1 is currently lent out."
2. "1 book on the shelf."
…
```

Facts only — strings already in the dump. **No** matcher advice. **No** test-vs-product claim.

Control arm sets `HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=0`. **All other flags identical.**

**Code:** `app-template-base/compactFailureMessage.ts` (+ `app-template/` sync)  
**Forwarded:** `src/v2/challenge-prompt.ts` → VERIFY child env

## Offline proof

```bash
npx vitest run test/compact-failure-message.test.ts
npm run prove:verify-rtl-text-grammar-seeded-messages
```

| Gate | Check |
|------|--------|
| Grammar fixture | Treatment MESSAGE has `QUERIED` + `VISIBLE TEXT` + product `1 is…` |
| Tip stripped | Treatment has no “function for your text matcher” |
| Control | Tip present; no `VISIBLE TEXT` |
| No advice | No within / flexible / intentional |

## Seeded repair pair

```bash
npm run experiment:verify-rtl-text-grammar-seeded-repair -- both 1
```

Fixture: `fixtures/verify-rtl-text-grammar-seeded` — product uses singular `is`/`book`; tests expect `are`/`books`.

Same fail surface both arms. Expected eventual fix: **TEST_FIX** assertions (or product copy change — either is acceptable if green).

## KEEP rule

- **KEEP** if mechanism holds and treatment reaches the same correct fix with fewer repair calls / less weighted on this seed **without** confounders (no harness self-tests; same fixture).
- Do **not** claim large universal savings from a soft grammar seed.
- Default **ON** after KEEP (explicit `0` disables).

## Explicit non-goals

- Error Memory, hard-stop, prompt edits, `rg` enrichment  
- Bundling with new MULTIPLE/TYPECHECK changes  
- Natural random cohort before seeded pair judged
