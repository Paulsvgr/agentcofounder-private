# Findings

Measured over 72 runs on 27 Aug 2026, gpt-oss-120b via Berget unless stated.

## Configurations

Success rate decides between them: at this variance a token median on
fewer than ~250 runs cannot separate two similar configurations.

| config | n | success | median score |
|---|---|---|---|
| A — before the landmine and rubric work | 8 | 6/8 | 419,619 |
| **B — all fixes, full prompt (`known-good-config-b`)** | 8 | **7/8** | 444,032 |
| C — B with the prompt trimmed ~1,000 tokens | 20 | 13/20 | 753,389 |
| GLM-5.2 on config B | 5 | **0/5** | — |

B stands. C lost on both axes with the largest sample of the three.

## Variance dominates everything

Across 52 scored runs the standard deviation is **120% of the mean**
(mean 857,059; range 66,003 to 4,762,259). Detecting a 30% difference in
medians at that spread needs roughly **250 runs per configuration**. Every
comparison made during development used between 5 and 20.

Large effects (the 3x gain from taking the verdict off the model's
self-report) are real. Fine distinctions between similar prompts were noise.

## A bad run is visible by its tenth call

| | final score | context at call 5 | context at call 10 |
|---|---|---|---|
| cheapest third | 161,210 | 7,271 | 9,792 |
| dearest third | 1,944,655 | 10,547 | 22,660 |

A run heading for 1.9M already carries 2.3x the context of a good run by
call ten. This is the basis for the untried fix: detect the divergence,
then restart with a fresh session carrying only the app state and the
failing output, so repair turns cost ~3k instead of ~25k.

## GLM-5.2 does not work with this harness

Five runs, zero writes, zero journeys, four to seven calls before giving
up. It never engages the tools through the `openai-completions` path.
This is not a cost question — it does not function. Any model swap needs
its tool-calling verified before its tokens are compared.

## What held, and what did not

Changes that reduced how much work there is to do all held:

- take `tests_run` and `status` from the Vitest report, not the model's claim
- inventory the seed in the prompt so nothing is explored
- ship tested primitives instead of generating them
- one test per journey
- remove the seed's hidden contracts (export style, protected paths)

Changes that constrained how the model works all failed and were reverted:

- blocking redundant reads — fired once in a 73-call run; median worsened
- forcing whole-file writes over edits — without caching a full rewrite puts
  the entire file in the conversation and every later turn re-bills it
- asking for all writes in one response — read as "emit one JSON blob of
  files", so the model wrote nothing at all
