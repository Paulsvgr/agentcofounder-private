# Agent Cofounder V2 — plan

Phase F stays frozen as evidence on `setup/measure`. V2 is built on `main` as a clean experimental platform.

**Team onboarding:** [TEAM-GUIDE.md](./TEAM-GUIDE.md)

## Milestones

### M1 — Preserve and audit — **done**

- [x] `v2` branch off `main`; Phase F preserved on `setup/measure`
- [x] [TEAM-GUIDE.md](./TEAM-GUIDE.md) — narrative doc for teammates
- [x] Historical runs, exports, sessions, experiment manifests kept locally

### M2 — Exact evidence + token reconciliation — **done**

- [x] Single-run reconcile (`npm run reconcile:run`)
- [x] Batch reconcile (`npm run reconcile:all`) — 66/66 complete runs match (Aug 2026)
- [x] Per-call ledger (`npm run normalize:run`) → `artifacts/analysis/<run-id>/ledger.json`
- [x] Hackathon weighted cost on each call (`src/v2/weights.ts`)
- [x] Activity classification (`src/v2/classify.ts`) — recon/source/css/test/build/finalize/repair

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

### Analysis station — **done (v1)**

- [x] `npm run analyze:run` → `ledger.json`, `station.json`, `station.html`
- [x] Activity breakdown, cumulative cost chart, filterable call table with tool drill-down
- [x] Optional `--compare <run-id>` for activity deltas
- [ ] Run vs experiment batch views (future)
- [ ] Link numbers back to raw `events.jsonl` line refs (future)

## Principles

1. Raw Pi evidence is immutable.
2. Derived analysis is versioned and recomputable.
3. Pi cannot own measurement truth (tests, exit codes, acceptance).
4. Held-out tasks before claiming general improvements.
5. Git describes code under test; shared storage holds run evidence.

## Shipped on `main` (also on `v2`)

- **Run replay** (`npm run replay:run`) — rebuild apps from session logs; template snapshot per run.
