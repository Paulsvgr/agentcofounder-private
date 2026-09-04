# Probe results: incremental-journey one-liner (2026-09-04)

**ID:** `incremental-journey-probe-v1`  
**Decision:** **KILL prompt-only procedure** (mechanism does not reliably engage)  
**Procedure:** `Write one journey it, run VERIFY, fix until green, then write the next journey.`  
**Injection:** `HARNESS_AGENTS_APPEND_FILE` → `probes/incremental-journey-one-line.md` (no hard gate)

---

## Runs

| | Probe 1 `19-23-16` | Probe 2 `19-26-43` | Probe 3 `19-30-39` |
|--|--:|--:|--:|
| Weighted | ~31.5k | ~43.8k | **~159k** |
| Calls | 8 | 10 | **35** |
| `it`s @ first VERIFY | **6** | **2** | **7** |
| First VERIFY @ | 8 | 10 | 11 |
| VERIFY fails | 0 | 0 | **5** |
| Thrash | none | none | repair loop |
| Final journeys | 6 full-ish | **2** thin | 7 full-ish |
| One-at-a-time? | **No** (write 6) | **No** (write 2) | **No** (write 7 → then repair) |

None interleaved `it` → VERIFY → next `it`. All: write N tests → VERIFY (then maybe repair).

---

## Interpretation

- Soft one-liner is **ignored** (probes 1 & 3: 6–7 `it`s before VERIFY) or **under-authors** (probe 2: 2 `it`s, thin coverage).
- Probe 1–2 cheap costs were **left-tail luck**; probe 3 is a normal expensive ship-shaped tail (**~159k**, vf=5).
- **Do not** cohort the one-liner. **Do not** authorize a hard gate from these draws.

---

## Decision

| Option | Verdict |
|--------|---------|
| Prompt-only one-liner | **KILL** (n=3) |
| Hard Δ≤1 / must-VERIFY gate | **Not authorized** |
| Ship KEEP | **unchanged** |

---

## One-line

> **n=3: never one-it→VERIFY→next; cheap draws were luck, third run ~159k/vf=5 — kill prompt-only incremental journey.**
