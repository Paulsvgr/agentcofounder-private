# Agent Cofounder V2 — plan

The original specification is kept verbatim in
[`spec/Agent_Cofounder_V2_COMPLETE_SPEC.md`](./spec/Agent_Cofounder_V2_COMPLETE_SPEC.md).
That is the source of truth. This file records status and working order — where
the two disagree, the spec wins.

Phase F stays frozen as evidence on `setup/measure`. V2 is built on `main`.

**Team onboarding:** [TEAM-GUIDE.md](./TEAM-GUIDE.md)

---

## The experiment loop

The backbone of all work after the measurement foundation. No harness change may
be called an improvement without going through it.

```text
1. Lock a baseline      5 runs, template exactly as it is
2. Change ONE thing     one intervention, nothing else
3. Run 5 more           same model, same settings, same prompt
4. Compare              all 5 vs all 5 — typical cost and spread
5. Call it              better / worse / unclear
6. Unclear → more runs
7. Only then            the next change
```

### Rules

1. **Five runs is a minimum, not proof.** Exp5b looked like a 47% win over 5
   runs. The 5+5 replication put the mean at p≈0.75 — noise. Three lucky runs
   were enough to fool us.
2. **`unclear` is the default answer.** A result has to be plain to count as a win.
3. **Measure spread, not just the middle.** That same replication showed 4.5×
   lower variance at p≈0.012 while the mean was noise. Consistency can be the win.
4. **Cost does not count if quality drops.** A cheaper worse app is a loss.
5. **One intervention per treatment.** An intervention may span several config
   fields, but it must declare which ones — see the config model below.
6. **Quality checks belong to their benchmark app**, never hardcoded into the
   general harness. The prompt can be anything.
7. **An unproven instrument does not get a vote.** This applies to quality
   checkers and to replay itself.

---

## Phase 1 — measurement foundation

| # | Step | Status |
|---|------|--------|
| 1 | Spec committed as source of truth | **done** |
| 2 | Replay runs at all; `scripts/` in typecheck | **done** |
| 3 | Replay validated across all saved apps | **done** |
| 4 | `HarnessConfig` — toggles, hash, intervention model | **done** |
| 5 | Run manifest — code, template, prompt, model, config per run | **done** |
| 6 | Audit existing run-server/storage + manifest ingestion plan | **done** |
| 7 | Wire manifest into export/publish pipeline (no new server) | **done** |

Steps 1–7 are **done**. Every run can record full provenance (`HarnessConfig`,
template hash, prompts, model, experiment metadata) and publish it to shared
storage. Compare baseline vs treatment **manually** when needed — label runs with
`RUN_EXPERIMENT` / `RUN_ARM` / `RUN_REP` / `RUN_INTERVENTION` (see TEAM-GUIDE §15; `RUN_COHORT` is a legacy alias).
We are **not** building a dedicated A/B experiment runner.

---

## Phase 2 — build Agent Cofounder (current order)

| # | Step | Status |
|---|------|--------|
| 8 | Analysis Station + runs app use manifest/config/template provenance | **done** |
| 9 | **Lock the V2 baseline** (5 runs, same template as today) | **in progress** |
| 10 | **V2 Control App** — local run browser, analyze trigger, launch form | **done** |
| 11 | Template/resources — select components → assemble app before Pi → tell Pi what was added | |
| 12 | Planner, themes, guards, error memory, … | later |

After step 9, template and resource work is in scope. Do not bundle planner +
components + theme + guards into the first template slice — one intervention at
a time still applies when comparing runs.

### Config model (keep — for tracking, not a runner)

All toggles default to `false`, so the baseline is an exact configuration with a
hash rather than a word we agree on. Runs pool into the same arm only when their
**`config_schema_version` + `config_hash`** pair matches; comparing across arms
uses a structured diff.

An **intervention** is a named set of config fields. For example,
`component_assembly` may require `docs_retrieval` and `template` and still be one
intervention. Use `validateIntervention()` when defining a treatment config to
ensure the diff from baseline stays inside declared fields.

See [TEAM-GUIDE §12](./TEAM-GUIDE.md#12-harnessconfig--experiment-toggles-and-identity)
and `npm run config:show`.

---

## Milestones (spec numbering M0–M12)

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Preserve Phase F | **done** |
| M1 | Clean V2 branch off main | **done** |
| M2 | Raw ingestion + normalized call schema | **done** |
| M3 | Exact token reconciliation | **done — 66/66** |
| M4 | Harness-owned ground truth | not started |
| M5 | Task benchmark | not started |
| M6 | Analysis Station v0 | partial — see below |
| M7 | Fresh baseline | Phase 2 step 9 |
| M8 | Preparation Agent | later |
| M9 | Resource resolver + assembler | app-template work lives here |
| M10 | Deterministic guards | later |
| M11 | Error Memory | later |
| M12 | Combined architecture + held-out | later |

### M3 is the gate, and it is green

The spec: *"Nothing downstream is considered trustworthy before this milestone
is green."* Reconciliation matches on 66 of 66 complete runs, so cost
comparisons are trustworthy.

### M6 — built early, and partly wrong

`npm run analyze:run` produces a ledger, `station.json` and `station.html`.

**The classifier violates the spec.** Section 5: *"Do not force phase and work
type into one label."* `src/v2/classify.ts` collapses them into one label where
`mixed` absorbs ~38% of weighted cost.

- [ ] Split into two independent axes — phase and work type
- [ ] Error taxonomy and repair detection
- [ ] Drill-down to the exact `events.jsonl` line

**Until that is fixed, the current activity shares must not drive which
improvement we build first.** Those numbers come from a model we know is wrong.
They do not block the experiment loop: cost comparison rests on reconciliation,
not on classification.

### Deliberate deviation from spec order

The spec lists M8 (Planner) before M9 (resources/template). We start with
**resource/template assembly** (Phase 2 step 10) after baseline lock, because
those slices are the core product direction and manifest provenance lets us track
exactly what was mounted per run. Planner, themes, and guards follow later.

Template work stays **one slice at a time** when comparing runs:

```text
template.persistence    (5b: variance yes, mean no)
template.test_setup
template.components
template.styling
```

Not "new template" as one package. Then we would not know which slice helped.

---

## Principles

1. Raw Pi evidence is immutable.
2. Derived analysis is versioned and recomputable.
3. Pi does not own measurement truth — tests, exit codes, acceptance.
4. Held-out tasks before claiming general improvements.
5. Git describes the code under test; shared storage holds run evidence.

## From the spec's "What NOT to do early"

- do not use one book-lending prompt as proof of generality
- do not treat Pi's chosen test output as ground truth
- do not bundle planner + components + theme + guards into the first experiment
- do not call an experiment a success because weighted tokens fell while quality did

## Shipped on `main` (also on `v2`)

- **Run replay** (`npm run replay:run`, `npm run replay:all`) — rebuild apps from
  session logs with no model calls. See TEAM-GUIDE for verdicts and known limits.
- **Analysis station** (`npm run analyze:run`) — ledger, activity breakdown,
  cumulative cost, filterable call table, optional `--compare`.
- **HarnessConfig** (`npm run config:show`) — baseline toggles, config identity,
  intervention validation. See TEAM-GUIDE §12.
- **Run manifest** — `run-manifest.json` per run (config, template, prompts, model,
  experiment metadata). See TEAM-GUIDE §13.
- **Shared run storage** — export/publish to team runs UI with `data.manifest`
  provenance sibling. See TEAM-GUIDE §14.
- **V2 Control App** (`control-app/`) — local run browser, per-call diagnostics,
  analyze/reconcile triggers, challenge launcher. See [CONTROL-APP.md](./CONTROL-APP.md).
