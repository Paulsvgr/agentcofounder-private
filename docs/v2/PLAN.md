# Agent Cofounder V2 — plan

Phase F stays frozen as evidence on `setup/measure`. V2 is built on `main` as a clean experimental platform.

## Milestones

### M1 — Preserve and audit (this branch)

- Keep all historical runs, exports, sessions, experiment manifests.
- Document architecture and what to keep vs replace.
- Safe branch for teammates (`v2` off `main`; Phase F on `setup/measure`).

### M2 — Exact evidence + token reconciliation

- Normalized call ledger from `events.jsonl` / sessions.
- Sum of per-call input + output + cache read must equal official `result.json` totals.
- Run reconciliation across all historical runs; fail the build if any drift.
- Deterministic activity classification from tool names and file paths.

### M3 — Harness-owned ground truth (forward-looking)

- Public UI contract in `contract-public/` (accessible names for core controls).
- Harness runs private acceptance suite after build; writes `harness_acceptance` to results.
- Fix exit-code masking so failures are not reported as success.

### M4 — Task set

- Multiple app ideas: dev/tuning set + held-out evaluation set.
- `--idea-file` through experiment runner; no tuning on held-out prompts.

### M5 — Modular build architecture

Each intervention independently switchable:

- Planner ON/OFF
- Profile selection ON/OFF
- Component assembly ON/OFF
- Theme matching ON/OFF
- Test contracts ON/OFF
- Deterministic guards ON/OFF
- Error memory ON/OFF

Only claim an optimization works after M2–M4 exist.

### Analysis station (after M2)

- Canvas/UI over normalized ledger.
- Run vs run, experiment vs experiment, token breakdown by activity and phase.
- Every number drillable to raw Pi events.
- Versioned classifiers; re-run analysis without re-running Pi.

## Principles

1. Raw Pi evidence is immutable.
2. Derived analysis is versioned and recomputable.
3. Pi cannot own measurement truth (tests, exit codes, acceptance).
4. Held-out tasks before claiming general improvements.
5. Git describes code under test; shared storage holds run evidence.

## Already on `main`

- **Run replay** (`npm run replay:run`) — rebuild apps from session logs without model calls; template snapshot per run.
