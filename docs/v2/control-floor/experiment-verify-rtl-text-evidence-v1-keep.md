# KEEP: HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1

**Decision:** **KEEP** (2026-09-04)  
**Locked claim:** **`rtl_text` KEEP — factual reporter improvement with a modest same-fail repair-tail win.**  
**Default:** ON when unset (explicit `0` / `false` / `no` disables)  
**Prereg:** [experiment-verify-rtl-text-evidence-v1-preregistration.md](./experiment-verify-rtl-text-evidence-v1-preregistration.md)  
**Compare:** `artifacts/experiments/verify-rtl-text-grammar-seeded/seeded-repair-compare.json`  
**Message proof:** `artifacts/experiments/verify-rtl-text-grammar-seeded/message-proof.json`

## Locked claim (narrow)

> **`rtl_text` KEEP — factual reporter improvement with a modest same-fail repair-tail win.**

**Not** the claim: “rtl_text makes the harness 26% cheaper generally.”

| Gate | This pair |
|------|-----------|
| Same failure surface | yes |
| Same eventual fix path | yes (TEST_FIX) |
| Treatment adds | factual `VISIBLE TEXT` only (tip stripped) |
| Green | **5 → 4** |
| Calls | **10 → 7** (~30% fewer) |
| Weighted | **~14.4k → ~10.6k** (~26% this pair) |
| Correctness | unchanged |

Smaller effect than TYPECHECK, but useful: cheap, factual, improves the agent’s view of RTL text-mismatch failures.

## What KEEP means

| Feature | Meaning |
|---------|---------|
| Mechanism | On text / display-value misses, strip RTL’s function-matcher tip; emit `QUERIED` + `VISIBLE TEXT` from the dump |
| Efficiency | Soft grammar seed only — **pair delta**, not a universal cost reduction |
| Class | Same family as role+name / MULTIPLE evidence — truth-preserving compaction |

## Evidence

**Offline:** unit tests + live grammar fixture message proof (`VERIFIED`).

**Seeded pair (same fixture, only `HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1` differs):**

| | Control `…12-20-44-797Z` | Treatment `…12-21-41-675Z` |
|--|--|--|
| VERIFY | tip + tag `MATCHES` | `QUERIED` + `VISIBLE TEXT` (`1 is currently lent out.`) |
| Calls | 10 | **7** |
| Weighted | ~14.4k | **~10.6k** |
| Green | @5 | **@4** |

Port `:3000` exit 137 / SIGKILL is **runner cleanup** — excluded from this KEEP judgment.

## Locked stack addition

```text
HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1=1   # KEEP; default ON
```

Alongside existing KEEP: role+name, MULTIPLE (reporter), TYPECHECK (efficiency), hard-stop still PARKED/OFF.
