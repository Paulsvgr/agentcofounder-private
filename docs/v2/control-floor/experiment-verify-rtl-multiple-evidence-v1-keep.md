# KEEP: VERIFY_RTL_MULTIPLE_EVIDENCE_V1

**Decision:** **KEEP** (2026-09-04)  
**Default:** `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1` ON when unset (same as role+name evidence).  
**Correction (2026-09-04):** Do **not** cite seeded `~83k → ~12k` as causal evidence for MULTIPLE (confounded). See below.

## Why KEEP

KEEP is justified as a **factual reporter correction**: legacy compaction threw away Testing Library match identity; the new formatter preserves tag/text/attrs from real RTL exceptions. No advice, no extra LLM call, essentially free truth.

| Gate | Result |
|------|--------|
| Natural activation | Proven (control 4/5, treatment 3/5) |
| First cohort candidates | **0** in vivo — old parser failed on live RTL (`Ignored nodes`) |
| Parser fix | Live `getByText` / `getByRole` exceptions → parsed candidates (unit + integration) |
| Seeded message proof | **VERIFIED** — legacy tag tokens vs `MATCHES PRESENT` with `<option>`/`<span>`/`<button>` |
| Seeded Pi repair (1+1) | Treatment behavior **encouraging** (saw candidates → scoped TEST_FIX → green; 0 WRONG_PRODUCT). **Cost delta not causal** — see confound. |
| Random cohort tokens | **Irrelevant** for KEEP — treatment never delivered candidates in that 5+5 |

**No more random MULTIPLE cohorts.**

## Seeded Pi cost claim — retracted

Earlier KEEP text said:

> Same fail: control ~20 calls / ~83k repair; treatment ~5 / ~12k

**Retracted as causal evidence.** Arms did **not** start with the same test set:

| | Control `…10-05-26-745Z` | Treatment `…10-09-11-848Z` |
|--|--|--|
| Tests on first VERIFY | `App.test.tsx` **+** `test/compact-failure-multiple-live.test.ts` | `App.test.tsx` only |
| First VERIFY shape | ~2/5, 3 failures | ~0/2, 2 failures (Science + Lend out) |

Control’s harness live self-test expects structured MULTIPLE evidence while `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0`, so a large part of the control spiral was reporter/env thrash — not “tag scraps vs candidates on the same app tests.”

Treatment’s path on the Science/Lend-out failures (candidates → understand ambiguity → edit tests → PASS) remains real and useful as a qualitative check. It does **not** license an 83k→12k win claim.

**Mild shared seed bias (both arms):** repair idea says prefer scoped queries on multiples; seeded tests say “intentionally unscoped / MUST fail.” Shared bias does not invalidate the message mechanism; it weakens the seed as a pure behavioral benchmark.

*(Overlay strips `compact-failure*` from **every** prepared app — natural and seeded — via `stripHarnessSelfTestsFromPreparedApp`.)*

## Evidence pointers

- Prereg / cohort notes: [experiment-verify-rtl-multiple-evidence-v1-preregistration.md](./experiment-verify-rtl-multiple-evidence-v1-preregistration.md)
- Audit: [audit-repair-tail-rtl-text-multiple.md](./audit-repair-tail-rtl-text-multiple.md)
- Natural cohort export: `artifacts/exports/cohort-verify-rtl-multiple-evidence-v1-2026-09-04.zip`
- Seeded pack (+ TYPECHECK seed): `artifacts/exports/seeded-repair-multiple-and-typecheck-2026-09-04.zip`
- Seeded compare (raw numbers; read with confound): `artifacts/experiments/verify-rtl-multiple-seeded/seeded-repair-compare.json`
- Message proof: `artifacts/experiments/verify-rtl-multiple-seeded/message-proof.json`

## Stack note

KEEP alongside `HARNESS_VERIFY_RTL_EVIDENCE_V1` (role+name). Both are truth-preserving VERIFY compaction — no advice, no Error Memory, no `rg`.
