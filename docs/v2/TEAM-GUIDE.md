# Agent Cofounder V2 — team guide

This document is the **narrative source of truth** for what we built, why, and how to use it. Update this file whenever we add a new tool or milestone. The root [README](../../README.md) stays a short command reference and links here.

**Hackathon spec:** [agentcofounder.stockholm.ai](https://agentcofounder.stockholm.ai/)

---

## Branch map (read first)

| Branch | Purpose | Who uses it |
|--------|---------|-------------|
| **`main`** | Clean hackathon starter + run replay | Submission baseline |
| **`setup/measure`** | Phase F experiments (Exp1–6, 5b) and historical runs | Frozen evidence — do not stack new experiments here |
| **`v2`** | Analysis platform (reconcile, ledger, future M3–M5) | **Start here** for analysis and new work |

**Rules:**

- Phase F history lives on `setup/measure`. Do not delete it.
- New measurement and analysis work goes on `v2`.
- Do not mix experiment patches into `v2` without a deliberate merge plan.
- Raw run artifacts under `artifacts/runs/` are immutable evidence. Derived analysis goes under `artifacts/analysis/` or `artifacts/replay/`.

---

## 1. Environment setup

**Requirements:** Node 22.19.x, npm 10.9.3 (see `.nvmrc`).

```bash
git clone <repo-url>
cd agentcofounder
git checkout v2

npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check
```

**Pi / Berget credentials** (once per machine):

```bash
./pi-agent/setup.sh
# add API key to ~/.pi/agent/berget-api-key
source ~/.pi/agent/challenge-env.sh   # before each challenge run
```

**Optional runtime env:**

```bash
export CHALLENGE_PROVIDER="zai"
export CHALLENGE_THINKING="off"    # default — lower output token cost
```

**Run the challenge** (costs model tokens):

```bash
npm run challenge
```

After a successful run:

- App: `http://localhost:3000` via `cd output/app && npm run dev`
- Artifacts: `artifacts/runs/<run-id>/`

Each complete run folder contains:

| File / dir | Role |
|------------|------|
| `events.jsonl` | Raw Pi telemetry (immutable) |
| `result.json` | Official totals — **written by harness, not agent** |
| `sessions/` | Pi session JSONL |
| `idea.txt` | Prompt used |
| `app-template/` | Template snapshot (new runs only — for replay) |

---

## 2. Why the `v2` branch exists

Phase F on `setup/measure` stacked six interventions on one prompt with flawed comparisons (wrong controls, agent-owned quality signals, cumulative stacks). We decided:

1. **Freeze Phase F** as reference evidence.
2. **Build V2** on clean `main` as a proper experimental platform.
3. **Measurement before optimization** — no new “Planner + components + …” claims until M2–M4 exist.

Roadmap detail: [PLAN.md](./PLAN.md).

---

## 3. Run replay — rebuild apps without AI

**Problem:** Re-running Pi to inspect an old app costs tokens and may differ stochastically.

**Solution:** Deterministically replay `write` and `edit` tool calls from session logs.

```bash
npm run replay:run -- artifacts/runs/<run-id>
```

**Output:** `artifacts/replay/<run-id>/report.json`

**Checks:** `npm test`, `npm run build`, file hash match vs `saved-apps/`

**Notes:**

- New runs snapshot `app-template/` into the run folder for exact replay.
- Older runs without a snapshot use a template drift check.
- v1 does not replay bash — only filesystem writes/edits.

**On branches:** `main` and `v2` (merged from `main`).

---

## 4. Reconcile — verify token accounting

**Problem:** If `result.json` totals do not match a independent sum from `events.jsonl`, all cost analysis is untrustworthy.

**Solution:** Re-sum tokens from events using the same logic as the harness (`src/usage.ts`) and diff against `result.json`.

```bash
# One run
npm run reconcile:run -- <run-id>

# All complete runs under artifacts/runs/
npm run reconcile:all
```

**Exit code:** 0 = all complete runs match; 1 = at least one mismatch.

**Current baseline (Aug 2026):** 66 OK, 0 mismatches, 24 skipped (early runs missing `result.json`).

**When to use:** After harness changes, before publishing analysis, or when a run’s numbers look wrong.

**Does not modify:** `result.json` or any submission artifact.

---

## 5. Normalize — per-call analysis ledger

**Problem:** `result.json` has run-level totals and a flat `call_log`, but not tools, paths, or weighted cost per call.

**Solution:** Build a rich ledger from `events.jsonl`.

```bash
npm run normalize:run -- <run-id>
```

**Output:** `artifacts/analysis/<run-id>/ledger.json`

Each call includes:

- Token breakdown (input, output, cache read/write, reasoning)
- **Weighted cost** per call: `input×1 + output×3 + cacheRead×0.1` ([hackathon formula](https://agentcofounder.stockholm.ai/))
- Cumulative weighted total
- Tools invoked that turn (bash, read, write, edit) with paths/commands
- Embedded reconciliation vs `result.json`

**Does not modify:** `result.json`. Safe for submission repo.

**Schema:** `agentcofounder.call_ledger.v1` — see `src/v2/normalize.ts`.

---

## 6. Phase F experiments (frozen on `setup/measure`)

Seven cumulative interventions on the public book-lending prompt. Full write-up: [`docs/phase-f-strategy.md`](../phase-f-strategy.md) on `setup/measure`.

| Exp | Intervention | Verdict (short) |
|-----|--------------|-----------------|
| 1 | RTL test cleanup | KEEP |
| 2 | Stop rule after green | KEEP |
| 3 | Test policy in prompt | KEEP |
| 4 | Failure digest prompt | REVERT |
| 5 | Template primitives | WEAK KEEP |
| 6 | Compact Vitest reporter | WEAK KEEP |
| 5b | Storage hardening | KEEP for **predictability**, not mean cost savings |

**5b replication (2026-08-28):** 5 control + 5 treatment, interleaved. No significant mean savings (p≈0.75). **4.5× lower variance** in model calls (p≈0.012). Original “47% cheaper” used the wrong control and lucky clean reps.

**Published runs:** ~90 on [agentcofounder-hackathon.vercel.app](https://agentcofounder-hackathon.vercel.app/)

---

## 7. Hackathon rules we must not break

From the [official spec](https://agentcofounder.stockholm.ai/):

- **`result.json`** is harness-owned — agent must not write or invent token totals.
- App must serve at **`http://localhost:3000`**.
- Efficiency ranking: **Input + Output×3 + CacheRead×0.1**.
- Local schema (stricter): `contract-public/result.schema.json` — includes `harness_checks`, `port_reclamation`, etc.

All V2 analysis tools are **read-only** on run artifacts.

---

## 8. Documentation maintenance

When adding a feature:

1. Add a numbered section here (problem → solution → commands → output → what it does *not* touch).
2. Add CLI one-liner to root README if teammates will run it.
3. Update [PLAN.md](./PLAN.md) milestone status.
4. Commit docs in the **same change** as the code.

Do **not** duplicate long explanations in README — link here instead.

---

## 9. What's next

| Milestone | Status |
|-----------|--------|
| M1 — v2 branch + plan | **Done** |
| M2 — reconcile + ledger | **Done** (activity classification **next**) |
| M3 — harness-owned acceptance | Not started |
| M4 — multi-prompt task set | Not started |
| M5 — modular build architecture | Not started |
| Analysis station UI | After M2 classification |

**Recommended next step:** M2 activity classification — tag each ledger call (test, build, source, css, repair) from tools and file paths.

---

## Quick command reference

```bash
npm run challenge                  # run agent (costs tokens)
npm run replay:run -- <run-id>     # rebuild app from logs, no AI
npm run reconcile:run -- <run-id>  # audit one run's token math
npm run reconcile:all              # audit all complete runs
npm run normalize:run -- <run-id>  # build analysis ledger
npm run check                      # typecheck + unit tests + app template
```
