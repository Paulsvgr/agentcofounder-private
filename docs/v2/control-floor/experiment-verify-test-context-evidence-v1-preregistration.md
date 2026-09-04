# Experiment prereg: VERIFY test-context evidence v1

**ID:** `verify-test-context-evidence-v1`  
**Status:** **REVERT** — mechanism PASS; locus FAIL (product surgery). See [results](./experiment-verify-test-context-evidence-v1-results.md)  
**Flag:** `HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1` — default **OFF**  
**Family:** factual VERIFY reporter (same class as role/name, MULTIPLE, rtl_text)  
**Motivator:** Dune/oracle spiral `2026-09-04T14-48-25-378Z` (~148k)  
**Board:** [board-lock-ship-observe-2026-09-04.md](./board-lock-ship-observe-2026-09-04.md)

## Philosophy (locked)

```text
Harness supplies truthful local evidence.
Pi still decides whether the product or the test is wrong.
```

**Not** this experiment:

- “Maybe your filter is wrong”
- “Prefer editing the test”
- Error Memory / `rg` / coaching prompts (Q2-B REVERT)
- Authoring locks / test budgets (REVERT)
- **`RECENT TEST ACTIONS` summarization** — deferred to a later experiment if CONTEXT alone wins

## Causal story

On the Dune run, VERIFY was already truthful:

```text
Unable to find heading "Dune"
HEADINGS PRESENT
- "My Bookshelf"
```

Dune really was absent. The missing fact was the **test’s own preceding sequence** visible in source around the fail line.

## Locked claim

> Appending **raw factual nearby test source** to VERIFY FAIL MESSAGE reduces FAIL→PASS cost on state-sequence oracle failures **without** advising test-vs-product.

## Treatment (v1 — THIS PAIR ONLY)

When flag=1 and FAIL has a resolvable `AT … file:line`:

```text
… existing MESSAGE (QUERIED / HEADINGS / etc.) …

TEST CONTEXT
  53|     await user.click(screen.getByRole("button", { name: /^Lent out/i }));
  …
  61|     await user.click(within(row).getByRole("button", { name: "Mark returned" }));
  …
> 65|     row = screen.getByRole("heading", { name: "Dune" }).closest("li")!;
```

Rules:

| Rule | Detail |
|------|--------|
| Window | 8 lines before + 4 after fail line (cap ≤800 chars) |
| Source | Exact file bytes on disk at FAIL time |
| Markup | Line numbers; `>` on fail line — **no commentary** |
| Scope | Each formatted failure that has a resolvable location |
| Missing file/line | Omit block silently — never invent |
| **No** RECENT TEST ACTIONS | v1 |

## Arms

```text
Control (0): ship VERIFY reporters (no TEST CONTEXT)
Treatment (1): identical + TEST CONTEXT only
```

All other flags identical. Self-tests stripped (hygiene already on). No seeded debug sidecars.

## Seed (required before cohort)

Seal filesystem **during** the Dune spiral — not the final green app:

| Target | Intent |
|--------|--------|
| Source run | `2026-09-04T14-48-25-378Z` |
| Snapshot | After first sticky Dune miss @~call 15 (`App.test.tsx:65`), product already correct for filter semantics |
| Must FAIL | `heading "Dune"` after Mark returned while Lent filter active |
| Must NOT | Include final “switch to All books” fix |
| Idea | Continue / repair until VERIFY PASS + build + report |

Fixture path (planned): `fixtures/verify-test-context-dune-148k/`

Offline proof: same FAIL surface both arms; treatment MESSAGE contains `TEST CONTEXT` and fail-line source; control does not; **zero** advice phrases.

## KEEP gates (seeded 1+1 first)

| Gate | Pass if |
|------|---------|
| Mechanism | Treatment FAIL text includes `TEST CONTEXT` with fail-line content |
| No advice | No filter/product/test coaching strings in harness output |
| Economics | Treatment lower weighted and/or fewer calls FAIL→PASS on this seed |
| Correct locus | Eventual fix predominantly **test** (or equal quality) — not forced product surgery |
| Hygiene | No harness self-tests in suite |

**REVERT if:** thrash worsens; Pi ignores context; or only works via accidental coaching leakage.

Natural 5-rep cohort **only after** seeded KEEP — not before.

## Explicit non-goals

- Error Memory, hard-stop, FULL_GREEN changes, quality prompts  
- `rg` workspace enrichment  
- Bundling TYPECHECK / MULTIPLE changes  
- Teaching “test is wrong” as a rule  

## Fit vs closed work

| Prior | Relation |
|-------|----------|
| RTL evidence KEEP | Same family: truth in MESSAGE |
| Q2-B verify-repair REVERT | Opposite: no repair-first advice |
| Q2-C guard REVERT | No pre-VERIFY blocking |
| next-lever-test-as-oracle | This is the authorized first treatment |

## Implementation sketch (after go)

1. Parse `AT` path:line from failure location in `compactFailureReporter.ts`  
2. Read ±N lines; append `TEST CONTEXT` after compact MESSAGE  
3. Flag via env (default OFF); forward in challenge runtime env like other evidence flags  
4. Unit tests: fixture snippet → CONTEXT present / advice absent  
5. Seal Dune seed → `prove:` offline messages → seeded 1+1  

## Run (after implement)

```bash
npm run prove:verify-test-context-dune-messages   # planned
npm run experiment:verify-test-context-seeded -- both 1
```

## Decision table

| Outcome | Verdict |
|---------|---------|
| Mechanism + cheaper FAIL→PASS + no advice | **KEEP** (default-on in separate step) |
| Mechanism only, no economic win | Mechanism validated; experiment **REVERT** / leave OFF |
| Any advice creep or worse cost | **REVERT** |
