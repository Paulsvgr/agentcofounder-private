# Board lock: ship + observe (2026-09-04)

**Mode:** ship + observe  
**Old repair-tail ladder:** finished — do not reopen as a sequence

## SHIP STACK

```text
MULTIPLE evidence:     KEEP
role/name evidence:    KEEP
rtl_text evidence:     KEEP
TYPECHECK:             KEEP, default ON
persistence:           KEEP
Tailwind:              KEEP
FULL_GREEN:            active stop (prefer ON for submit)
```

Natural ship cohort (KEEP + FULL_GREEN): `docs/v2/control-floor/ship-keep-full-green-cohort-2026-09-04.md`  
Median ~81k · 5/5 success · post-green 0.

## HYGIENE

```text
harness self-tests stripped from all prepared apps ✅
  (stripHarnessSelfTestsFromPreparedApp — natural + seeded)
MULTIPLE (none parsed) parser ✅
  (Ignored-nodes live dumps; never emit placeholder)
```

## Measurement lock (do not drift)

[measurement-call-count-first-repair-2026-09-04.md](./measurement-call-count-first-repair-2026-09-04.md)

```text
cost ≈ calls × ~4.6k
expensive fork = after first VERIFY FAIL
main loop = TEST_FIX → VERIFY_FAIL
missing VERIFY inventory ≈ 2% → stop expanding VERIFY
```

## OFF / PARKED

```text
Error Memory:          OFF
rg:                    OFF
hard-stop experiment:  PARKED (superseded by FULL_GREEN)
quality prompt:        REVERT / OFF
repair-surface lock:   REVERT / OFF
pre-green test budget: REVERT / OFF
TEST CONTEXT evidence: REVERT / OFF
test_isolation:        REVERT / OFF (do not revive)
semantic scaffold:     DROPPED (no free shape signal; no planner call)
```

## Open research (parked — not tonight)

> Remaining tail is mostly **first-repair decision quality** with sufficient facts, not missing VERIFY text.

Natural fixture: `2026-09-04T14-48-25-378Z` (~148k Dune).  
No new reporter / gate / coaching / cadence until a new measurement unlocks one.

## Not this mode

- Re-running closed authoring locks / max_tokens / quality prompts as efficiency bets  
- Claiming 60k median (v2.2 was a different stack)  
- Treating seeded experiment failures (106k/227k) as the ship stack  
- Inventing features to “do something” after measurement freeze
