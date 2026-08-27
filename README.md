# AgentCofounder submission

Our entry for the [AgentCofounder](https://agentcofounder.stockholm.ai) challenge.
Give it one plainly-written product idea and it autonomously produces a working,
tested, verified React application — no human in the loop.

The organizers' original README is kept as [STARTER-README.md](STARTER-README.md).

## Results

Measured over 88 runs. See [FINDINGS.md](FINDINGS.md) for the full analysis.

| | starter | ours |
|---|---|---|
| runs producing a scoreable submission | 0 / 1 | **20 / 24 (83%)** |
| efficiency score, typical | 755,112 | **304,146** |
| efficiency score, best | 755,112 | **43,889** |
| cost per app | €0.15 | **€0.06** |
| app shapes handled | — | **7 / 7** |

Efficiency score is `input + 3 × output`, lower is better.

Seven deliberately different shapes pass: a record tracker, a plant-watering log,
freelance invoices, a cafe rota, noughts and crosses, a bill splitter, a pomodoro
timer, and a single-document scratchpad. They differ in structure, not just
subject — turn-based state, pure calculation and self-advancing timers are not
record collections, and the harness does not force them to be.

## Running it

The starter cannot run on Windows: `src/port-owner.ts` implements only Linux
`/proc` and macOS `lsof` paths, and every `spawn` uses `shell: false`, which
Node 22 rejects for `.cmd` shims. We run under WSL Ubuntu, which is also what
judging containerises to.

```bash
# one run against the public idea
./wrun.sh

# one run against any idea file
./wrun.sh --idea-file eval-ideas/game.txt

# every idea, once each
./eval.sh

# the same configuration N times, to see variance
./repeat.sh 5
```

Results land in `runs/<timestamp>/`. Then:

```bash
node compare.js   # every run, side by side
node audit.js     # generated apps against quality proxies
```

`BERGET_API_KEY` goes in `.env.local`, which is gitignored.

## What we changed

Full reasoning in [FINDINGS.md](FINDINGS.md); each commit explains itself.

1. **Take the verdict from the test results, not the model's claim.** The
   baseline built a correct app with two passing tests, reported `tests_run: []`,
   and scored zero. `src/verify-app.ts` now transcribes journeys from the Vitest
   report and `src/result.ts` derives status from what was verified. It can only
   lower a verdict — a failing test still fails. This alone took us from no runs
   counting to nearly all of them.
2. **Inventory the seed in the prompt** so the model never opens a file to learn
   what is in it. Reads dropped from 9 to 2.
3. **Ship tested primitives** — `app-template/src/lib/` handles persistence,
   corrupt-data recovery and ids; `styles.css` styles semantic markup. Shipped
   code costs no tokens and cannot be got wrong. Scoped to ideas that keep
   records, so a game is not pushed into a shape it does not have.
4. **One test per journey**, so coverage is reported honestly and a single
   failure does not hide the rest.
5. **Remove the seed's hidden contracts.** `main.tsx` demanded a named `App`
   export while the model wrote a default one — a build failure unrelated to the
   app being built. It now accepts either, and the paths that must survive are
   stated explicitly.

## What we tried that failed

Four changes were reverted after measurement. All four tried to constrain *how*
the model works; every change that held instead reduced *how much work there is*.

- **Blocking redundant reads** — fired once in a 73-call run. Median worsened.
- **Forcing whole-file writes over edits** — without caching a full rewrite puts
  the entire file in the conversation and every later turn re-bills it.
- **Asking for all writes in one response** — read as "emit one JSON blob of
  files"; the model wrote nothing at all.
- **Trimming the prompt by 1,000 tokens** — 65% success against 88% over 20 runs.
  The guidance was earning its cost.

`known-good-config-b` tags the configuration these numbers describe.

## Caveats

Across 52 runs the standard deviation is 120% of the mean. Separating two similar
configurations needs roughly 250 runs each; ours used 5 to 24. Large effects are
real, fine distinctions were not.

The tail is unsolved: best 43,889, worst 3,806,437 on identical configuration. A
bad run is identifiable by its tenth call, carrying 22,660 tokens of context
against 9,792 for a good one.

GLM-5.2 does not work here — five runs, zero writes, zero journeys. It never
engages the tools through Berget's `openai-completions` path.
