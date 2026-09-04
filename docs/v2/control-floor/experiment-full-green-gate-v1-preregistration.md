# Experiment: full-green-gate v1

**ID:** `full-green-gate-v1`  
**Status:** **KEEP** — see [results](./experiment-full-green-gate-v1-results.md)  
**Flag:** `HARNESS_FULL_GREEN_GATE_V1` — default **OFF** (opt-in KEEP)  
**Depends on:** default KEEP stack (VERIFY + root-error-first + persistence + Tailwind + RTL evidence + TYPECHECK)  
**Orthogonal to:** PARKED hard-stop-after-green (VERIFY-only stop); tail-sweep (post-**report** checks)

## Locked claim

> Once VERIFY PASS + harness BUILD PASS, further model turns are waste. The harness must own finalize and **prevent** another model call — not ask Pi to stop.

```text
VERIFY PASS
    ↓
harness runs canonical BUILD
    ↓
BUILD FAIL ──→ factual build error back to Pi
    ↓ PASS
FULL_GREEN
    ↓
kill/close agent loop immediately (terminate:true)
    ↓
harness writes report/result
    ↓
outer independent checks
```

## Arms (only difference = flag)

```text
Control (flag=0):
VERIFY PASS → Pi continues (build / report / prose) as today

Treatment (flag=1):
VERIFY PASS → harness BUILD → FULL_GREEN → ZERO further model calls
```

No prompt changes. Hard-stop remains OFF. Tail-sweep remains OFF. Product-quality contract OFF.

## Seed

Reuse already-green bookshelf fixture (same as hard-stop soft seed):

```text
fixtures/hard-stop-after-green-seeded/
```

Neutral idea: call verify first; when green, finish (control still may post-green; treatment must not).

```bash
npm run experiment:full-green-gate-seeded-repair -- both 1
```

## Primary measures

| Measure | Definition |
|---------|------------|
| FULL_GREEN timestamp | Treatment: `full-green-gate.v1.json` / verify tool text containing `FULL_GREEN` |
| Model calls after FULL_GREEN | Treatment must be **0** |
| Calls/tokens after equivalent full-green | Both arms: after verify PASS + build PASS (control: bash build; treatment: harness build) |
| Final correctness | Outer harness checks / journeys still green |

## KEEP rule

KEEP only if treatment proves **0 model calls after FULL_GREEN** and cuts post-full-green cost vs control while final correctness is unchanged.

Do **not** claim a universal “X% cheaper harness” from one pair.

## Explicit non-goals

- Mixing with hard-stop or tail-sweep in the same seed  
- Prompt-only stop  
- Product-quality contract  
- Control App polish
