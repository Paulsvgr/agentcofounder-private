# Experiment results: full-green-gate v1

**ID:** `full-green-gate-v1`  
**Decision:** **KEEP**  
**Flag:** `HARNESS_FULL_GREEN_GATE_V1` — default remains **OFF** (opt-in KEEP; promote default later if desired)  
**Prereg:** [experiment-full-green-gate-v1-preregistration.md](./experiment-full-green-gate-v1-preregistration.md)

## Pair

| Arm | Run | Calls | Weighted | Status | Post-FULL_GREEN model calls |
|-----|-----|------:|---------:|--------|----------------------------:|
| Control (`flag=0`) | `2026-09-04T13-17-58-832Z` | 4 | ~6708 | partial (outer harness 3/3) | n/a (no harness FULL_GREEN) |
| Treatment (`flag=1`) | `2026-09-04T13-18-28-860Z` | **1** | **164** | success | **0** |

Arms differed **only** by `HARNESS_FULL_GREEN_GATE_V1`. Same seeded fixture, KEEP stack ON, hard-stop OFF, tail-sweep OFF.

## Raw-stream proof (treatment)

```text
FULL_GREEN timestamp: 2026-09-04T13:18:39.486Z  (full-green-gate.v1.json)
assistant messages after FULL_GREEN: 0
```

Session timeline:

1. Assistant @1 → `verify`
2. Tool result → `FULL_GREEN` (harness build PASS + report written + `terminate:true`)
3. **No further assistant / model turns**

Export:

```json
{
  "outcome": "full_green",
  "verify_exit_code": 0,
  "build_exit_code": 0,
  "report_written": true,
  "terminate": true,
  "timestamp": "2026-09-04T13:18:39.486Z"
}
```

Control continued as today: verify PASS → bash/ls → write `report.partial.json` → closing prose (4 calls).

## Mechanism

Not prompt soft-stop. Verify tool returns `terminate: true` after harness BUILD PASS, which stops the agent loop before the next model call. Extension also blocks later tools with `terminate` as belt-and-suspenders.

## KEEP rationale

- Acceptance met: FULL_GREEN → **0** subsequent model calls  
- Harness owns report after VERIFY+BUILD  
- Outer independent checks still ran (treatment success 3/3)  
- Control unchanged when flag OFF  

Do **not** generalize the ~6708→164 weighted delta beyond this already-green seed; claim is the **stop mechanism**, not a universal % savings.

## Artifacts

- Pair log: `artifacts/experiments/full-green-gate-v1/seeded-repair-pair.log`
- Proof: `artifacts/experiments/full-green-gate-v1/pair-proof.json`
