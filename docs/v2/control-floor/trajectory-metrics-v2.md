# Trajectory Metrics v2 — Specification

**Status:** Signed off (v3)  
**Schema:** `agentcofounder.trajectory_metrics.v2`  
**Replaces:** `trajectory_metrics.v1`

## Purpose

Symmetric per-run metrics for **verify → interpret → repair**, comparable across **Control v2.1, B, C, VERIFY v1** without new Pi runs.

## Verification events

Sources: **bash** (`isNpmTestCommand`) and **`verify`** tool.

Verify output: `verify exit_code=N (PASS|FAIL)` + full compact reporter text.

## Canonical suite

**Canonical** = full authoritative suite (not sidecar, not file-scoped).

**Piped is independent of canonical.** Piped full-suite runs are canonical.

| Command | canonical | piped | exit_code_trusted |
|---------|-----------|-------|-------------------|
| `npm test` | yes | no | bash: often unknown |
| `npm test \| tail` | yes | yes | **false** |
| `verify` tool | yes | no | **true** |
| `npx vitest run src/App.test.tsx` | no | — | — |
| sidecar debug test | no | — | — |

## Canonical outcome (tri-state)

| Outcome | Definition |
|---------|------------|
| **pass** | Parsed `PASS N/N` with N>0, passed===total; verify exit_code=0; piped PASS N/N counts as **pass** even when exit untrusted |
| **fail** | Explicit: SUITE_ERROR, FAIL 0/0, FAIL N/M with N<M, verify exit_code≠0, trusted bash exit≠0 |
| **unknown** | Canonical run with unparseable/truncated output — **not** counted as fail |

## Valid full green

`first_valid_full_green_call` = minimum `max(T,B)` over pairs where:

- `T` = canonical **pass**
- `B` = build green
- no **product mutation** on calls in `(min(T,B), max(T,B))`

Product mutation = write/edit to src/tests/config (excluding sidecar test files).

## Primary repair-tail metric (cross-cohort)

`canonical_fail_before_first_canonical_green` — explicit **fail** canonical events before first canonical **pass**.

`canonical_unknown_before_first_canonical_green` — **unknown** events before first canonical pass (observability).

VERIFY-specific secondary: `verify_fail_before_first_canonical_green`.

## Cohort run lists (20 runs)

- **Control v2.1:** `2026-08-31T12-46-51-224Z` … `13-05-01-562Z`
- **B:** `13-27-27-135Z` … `13-44-58-268Z`
- **C:** `14-10-21-280Z` … `14-36-58-838Z`
- **VERIFY v1:** `15-39-40-550Z` … `15-57-09-094Z`

## Aggregation

n=5 per cohort: report **full distribution**, median, min–max, tail rep, `tail_rep_rate` (e.g. weighted > 120k). **No P90.**

## Output

`artifacts/analysis/<run-id>/trajectory.v2.json`
