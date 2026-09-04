# AgentCofounder harness optimization report

The goal was not to build an application. It was to make the harness produce a runnable,
tested, persistent, maintainable POC from an *unseen* idea, while cutting weighted token
cost (`input + output*3 + cache_read*0.1`).

Nothing in `contract-public/` changed. `result.json` keeps its exact schema. The judge's
independent verification path is untouched — the runner still owns every fact about tests,
build, startup, ports and tokens, and the model still only writes `report.partial.json`.

## 1. What changed

### A. A tested, domain-neutral toolkit inside `app-template/` (largest lever)

Every line the model does not generate is output tokens saved at 3x weight, and it is code
that is already correct. The starter now ships:

| Module | Purpose |
| --- | --- |
| `src/lib/id.ts` | id generation, `normalizeKey` for duplicate detection |
| `src/lib/validation.ts` | composable rules + `validateFields`/`hasErrors` |
| `src/lib/dates.ts` | ISO helpers, `daysUntil`, `isOverdue`, formatting |
| `src/lib/storage.ts` | versioned, migratable localStorage with corrupt-data recovery and an explicit `ok/empty/recovered/unavailable` status |
| `src/lib/repository.ts` | entity CRUD boundary owning ids, timestamps and ordering |
| `src/lib/collection.ts` | search, filter, sort, group, count, sum |
| `src/lib/state-machine.ts` | lifecycles (`can`, `next`, `apply`, `isFinal`) |
| `src/hooks/useCollection.ts` | React binding: load once, persist on change, surface storage notices |
| `src/ui/index.tsx` | accessible shell, sections, stat cards, buttons, form fields with `aria-invalid`/`aria-describedby`/`role="alert"`, notices, empty states, list, table, focus-trapped dialog |
| `src/styles.css` | token-based responsive theme with dark mode |
| `src/test/setup.ts`, `src/test/helpers.ts` | storage isolation, `seedStorage`/`corruptStorage`/`readStorage` |

16 template tests cover these and pass. This directly feeds Persistence (20), Robustness (20),
Usability (30), Integration-ready (15) and Maintainability (15) without spending model output.

### B. Prompt hierarchy rewritten for cache stability and fewer turns

- `solution/system-prompt.md`: role, constraints, a 7-step method, an explicit efficiency
  section (no re-reading, no narration, whole-file writes) and the report shape. No overlap
  with the skill or `AGENTS.md`.
- `solution/skills/mvp-builder/SKILL.md`: a domain-shape playbook (register, workflow,
  planner, log, comparison, checklist) so an unseen idea maps onto a known plan instead of
  being improvised.
- The skill is **inlined into the system prompt** instead of being passed as `--skill <path>`.
  Previously the model had to spend a tool call reading it, and could skip it entirely.
- `app-template/AGENTS.md` is now a complete inventory of the toolkit with signatures, so the
  model never reads `src/lib/**` to find out what exists.
- `composeSystemPrompt()` builds a byte-identical prefix (system prompt + skill + journeys +
  contract) for every call, including repair calls; only the final user message varies. That
  is what makes cache reads (0.1 weight) replace input tokens (1.0 weight).

### C. Bounded test-and-repair loop

Previously a single Pi call either landed or the run failed. Now, when harness verification
fails, the runner sends one (configurable, 0–3, default 1) repair pass containing only the
failing checks and the *tails* of the relevant logs — not the whole transcript — behind the
same cached prefix. Then it re-verifies and recomposes the result.

`CHALLENGE_REPAIR_ATTEMPTS` controls the bound. Each verification attempt writes to its own
`verify-N/` artifact directory so logs are never lost.

### D. Exact multi-call token accounting

`mergeUsageSummaries()` sums every Pi invocation of the run and re-indexes `call_log`, so the
totals in `result.json` still match what a judge recomputes from all event streams.

### E. Observability: `trace.jsonl` and `summary.md`

Each phase (implement / verify / repair) appends one JSON line with status, duration and a
short detail. At the end the runner writes `summary.md`: status, assumptions, implemented
features, agent-reported journeys, independent harness checks, the token table and the
weighted efficiency figure. Both live under `artifacts/runs/<runId>/`.

### F. Hidden-idea benchmark

`benchmark/ideas/` holds six unseen ideas, one per domain shape, none of them the public
book-lending example. `benchmark/README.md` defines what to record per run. Nothing about any
of these ideas is encoded in the harness.

## 2. Files changed

```
app-template/AGENTS.md                     rewritten: toolkit inventory + contract
app-template/src/lib/*.ts                  new primitives (+ tests)
app-template/src/hooks/useCollection.ts    new
app-template/src/ui/index.tsx              new accessible component set
app-template/src/styles.css                rewritten design tokens
app-template/src/test/{setup,helpers}.ts   new
solution/system-prompt.md                  rewritten
solution/skills/mvp-builder/SKILL.md       rewritten
src/run-challenge.ts                       inlined skill, phases, bounded repair, trace/summary
src/repair.ts                              new
src/trace.ts                               new
src/usage.ts                               + mergeUsageSummaries
test/repair-and-trace.test.ts              new
test/run-challenge.test.ts                 updated prompt assertions
test/verify-app.test.ts                    seed now ships passing tests
benchmark/**                               new
```

Unchanged on purpose: `contract-public/**`, `contract-public/result.schema.json`,
`src/verify-app.ts` verification semantics, `src/result.ts`, `src/validate-result.ts`,
`solution/extensions/protected-paths.ts`, the pinned Pi version, and all lockfiles.

## 3. Verification in this sandbox

- `npm run check` — typecheck, 47 harness tests passed (1 environment-guard skip), 16 template
  tests passed, template production build clean.
- `npm run challenge -- --prepare-only` — workspace reset, toolkit and `AGENTS.md` present in
  `output/app`.
- No credentials anywhere in the tree.

Not yet run here: a real Pi invocation. That needs your Berget key.

## 4. Next step — measure on your machine

```bash
source ~/.pi/agent/challenge-env.sh
npm run challenge                                     # baseline, public idea
npm run challenge -- --idea-file benchmark/ideas/03-log-freelance-hours.txt
npm run challenge -- --idea-file benchmark/ideas/01-workflow-repair-shop.txt
```

After each run, `artifacts/runs/<runId>/summary.md` has the numbers to paste back: status,
harness checks, repair attempts, tokens and weighted efficiency. Useful ablations, one variable
at a time: `CHALLENGE_REPAIR_ATTEMPTS=0` versus `1`, and the previous prompt versus the new one.
