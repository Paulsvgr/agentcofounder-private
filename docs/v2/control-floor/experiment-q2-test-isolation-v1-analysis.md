# Experiment Q2 — Test Isolation v1 — analysis & verdict

**Status:** FINAL / FROZEN (2026-09-01)  
**Experiment:** `q2-test-isolation-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, OFF/OFF)  
**Preregistration:** [experiment-q2-test-isolation-v1-preregistration.md](./experiment-q2-test-isolation-v1-preregistration.md)

**Export:** `artifacts/exports/cohort-q2-test-isolation-v1-2026-09-01.zip`  
**Run log:** `artifacts/experiments/q2-test-isolation-v1/2026-09-01T16-27-38Z.log`

> **Experiment: REVERT. Test-isolation mechanism: PASS.**

---

## Locked final verdict

| Layer | Verdict |
|-------|---------|
| **Formal preregistered experiment** | **REVERT** (Primary A distribution + cost non-regression) |
| **Test isolation mechanism (`createMemoryStorage`)** | **PASS** — **5/5** adoption; **0/5** hand-rolled mocks; **0/5** confirmed storage bleed |
| **`memoryStorage` overlay** | **Validated helper — not promoted to default floor** |
| **Human UX / quality overlay** | **Not required** to determine formal verdict (Primary A and cost gates already fail) |

**Root cause of VERIFY failures:** primarily **brittle RTL selectors / journey tests** (`TestingLibraryElementError`, ambiguous text matchers), **not** storage isolation.

**Real bottleneck:** test quality and **VERIFY repair loops** — not cross-test `localStorage` bleed.

---

## Formal result (frozen prereg gates)

| Metric | Control v2.2 | Q2 | Gate |
|--------|-------------:|---:|------|
| Median weighted | **60,852** | **89,832** | ❌ ≤70k |
| Runs **>140k** | **0/5** | **1/5** | ❌ 0/5 |
| Median calls | **16** | **23** | worse |
| VERIFY fails, distribution | **0, 1, 1, 2, 2** | **1, 1, 1, 2, 3** | worse |
| Runs with **0** VERIFY fails before green | **1/5** | **0/5** | ❌ needed ≥2/5 |
| Runs with **≥2** VERIFY fails before green | **2/5** | **2/5** | ❌ needed ≤1/5 |
| Median `verify_fail_before_first_canonical_green` | **1** | **1** | ✅ ≤1 |
| Confirmed storage bleed | — | **0/5** | ✅ (mechanism) |
| Hand-rolled test `localStorage` mocks | — | **0/5** | ✅ |
| Quality regression | — | — | **not required for verdict** |

Primary **A** (distribution shape) and **cost non-regression** failed. Median verify-fail count alone does not rescue the experiment.

---

## Two separate cost problems (confirmed)

Q2 did **not** solve the real bottleneck. It was **more expensive**, not cheaper.

| Bucket | What it is | Q2 evidence |
|--------|------------|-------------|
| **1. Expensive pre-VERIFY work** | Product build, styling, recon, test authoring before first VERIFY | Rep 1: 174k / 34 calls; first VERIFY at call 24; ~124k weighted before first canonical verification |
| **2. Expensive post-VERIFY test repair** | VERIFY fail → RTL/journey repair spirals | VERIFY→first canonical PASS median **~30.6k** vs control **~12.4k** (~2.5× worse); rep 2: 3 verify fails + piped `vitest` escape |

`memoryStorage` adoption is correct and cheap at test runtime — it does not address either bucket.

---

## Cohort table (5 reps)

| Rep | Run ID | Weighted | Calls | VERIFY fails before green | VERIFY tools | Journeys (final) | `createMemoryStorage` | Hand-rolled mock | Test pattern |
|-----|--------|----------:|------:|--------------------------:|-------------:|------------------|----------------------|------------------|--------------|
| 1 | `2026-09-01T16-27-44-211Z` | **174,578** | 34 | 1 | 2 | 10/10 | yes | no | injected `storage` prop + `beforeEach` |
| 2 | `2026-09-01T16-32-14-794Z` | 78,641 | 17 | **3** | 4 | 6/6 | yes | no | `installStorage()` per `it` |
| 3 | `2026-09-01T16-35-26-498Z` | 111,756 | 23 | 1 | 2 | 14/14 | yes | no | `vi.stubGlobal` + unit file |
| 4 | `2026-09-01T16-39-03-742Z` | 89,832 | 18 | 1 | 3 | 7/7 | yes | no | per-`it` memory storage |
| 5 | `2026-09-01T16-42-18-175Z` | 84,497 | 23 | 2 | 3 | 7/7 | yes | no | injected `storage` prop |

**Harness success:** 5/5  
**Median weighted:** **89,832** (78,641 – 174,578)  
**Median calls:** **23** (17, 18, 23, 23, 34)  
**VERIFY fail distribution:** `{1, 1, 1, 2, 3}`

---

## Comparison: v2.2 control vs Q2

| Metric | v2.2 (5 reps) | Q2 treatment | Δ |
|--------|---------------:|-------------:|---|
| Median weighted | **60,852** | **89,832** | **+48%** |
| Weighted range | 49k – 109k | 78k – **175k** | wider tail |
| Median calls | **16** | **23** | +7 |
| Median verify fails before green | **1** | **1** | same |
| VERIFY fail distribution | **0, 1, 1, 2, 2** | **1, 1, 1, 2, 3** | worse at 0 (0 vs 1 clean run) |
| Reps ≥2 verify fails | 2/5 | 2/5 | same tail count |
| Reps >140k weighted | **0/5** | **1/5** | worse |
| VERIFY → first canonical PASS (ledger median) | **~12.4k** | **~30.6k** | **~2.5× worse** |
| Hand-rolled test `localStorage` mocks | not measured | **0/5** | — |
| `createMemoryStorage` in tests | 0/5 (baseline) | **5/5** | mechanism delta |

Canonical VERIFY→PASS phase split uses call-ledger weighted cost + Metrics v2 trajectory boundaries (same method as [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)).

Q2 **did not beat** the locked control on trajectory **distribution** despite matching the median verify-fail count. Clean-run count fell **1/5 → 0/5**; peak verify-fail rose **2 → 3** (rep 2).

---

## Primary A — trajectory deep dive

### What improved vs control?

- **Nothing on the frozen distribution gates.** Median stayed at 1; heavy-repair tail count unchanged (2/5).

### VERIFY sequences (canonical)

| Rep | Sequence | Notes |
|-----|----------|-------|
| 1 | FAIL 6/10 → PASS 10/10 | One repair cycle; cost dominated by **pre-VERIFY** work (calls 1–23) |
| 2 | FAIL 4/6 → FAIL 4/6 → **unknown** → FAIL 4/6 → PASS 6/6 | **3** canonical fails; call 8 ran **piped vitest** after unknown verify |
| 3 | FAIL 10/14 → PASS 14/14 | Extra journeys; single repair cycle |
| 4 | FAIL 6/7 → PASS 7/7 → PASS 7/7 | One fail; optional re-verify |
| 5 | FAIL 5/7 → FAIL 6/7 → PASS 7/7 | Two fails before green |

Rep 2 is the clearest **test-repair spiral** in the cohort: repeated 4/6 VERIFY failures on a small suite, plus a direct `vitest run` bash escape (piped test count **1**). Failures were **RTL selector / journey coverage** (`TestingLibraryElementError`), not storage bleed — tests use isolated memory storage per case.

### Cost phase split (ledger median)

| Phase | v2.2 median | Q2 median |
|-------|------------:|----------:|
| VERIFY → first canonical PASS | **~12.4k** | **~30.6k** |
| Weighted to first canonical green (total) | ~55,608 | ~87,165 |
| Weighted after first green | ~0 | ~0 |

Q2 spent more in the **VERIFY repair phase** (~2.5×) and more **before** first green without improving verify-fail distribution — opposite of the intended trajectory lever.

---

## Primary B — isolation mechanism (PASS)

### Adoption

| Pattern | Reps | Description |
|---------|------|-------------|
| Injected `storage` prop + `beforeEach` memory | 1, 5 | App accepts `Storage`; tests pass isolated map storage |
| `installStorage(createMemoryStorage())` per `it` | 2 | `Object.defineProperty(window, 'localStorage', …)` |
| `vi.stubGlobal('window', { localStorage })` | 3 | App tests + separate unit file |

All patterns use **`createMemoryStorage`** from `@/test/memoryStorage` — **0/5** ad hoc `localStorage` mock/spy without the helper.

### Storage bleed

**0/5 confirmed** — automated cohort review found no trajectory evidence of cross-test persistence failures; isolation patterns present in all reps. Human hard-refresh overlay was **not recorded** for this cohort and is **not required** for the formal experiment verdict.

### Runtime persistence (out of scope)

Q2 overlay does **not** preinstall runtime collection primitives. Reps **hand-rolled** runtime `localStorage` in app code as expected. Test isolation does not address refresh/runtime persistence (P1’s lane).

---

## Cost deep dive

### Activity mix (weighted share — median rep profile)

Typical Q2 run: **mixed** (~40–50%), **source** (~15–25%), **recon** (~5–15%), **finalize** (~7–10%), **test** (variable), **css** (0–15% on v2.2 template).

Rep 1 anomaly: **source 24%**, **test 18%**, **recon 16%** before first VERIFY — large multi-file UI build before calling VERIFY at call **24**.

### Tail post-mortem — Rep 1 (174,578 / 34 calls)

| Signal | Value |
|--------|-------|
| `verify_fail_before_first_canonical_green` | **1** (not a VERIFY spiral) |
| `weighted_before_first_canonical_verification` | **123,972** |
| First canonical green call | **30** |
| Post-valid-full-green calls | **3** |

**Classification:** **Bucket 1 — pre-VERIFY product + test authoring cost spiral.** Not caused by `memoryStorage`.

### Tail post-mortem — Rep 2 (78,641 / 3 verify fails)

**Classification:** **Bucket 2 — RTL/test-repair spiral.** VERIFY at calls 5, 7, 12, 14; call **8** ran `npx vitest run` via bash after an **unknown** verify outcome. Still ended 6/6 green with `createMemoryStorage` isolation.

---

## What Q2 proved vs did not prove

| Claim | Evidence |
|-------|----------|
| Assembler can add/remove overlays without full template per combo | **Yes** — clean OFF/OFF vs test-isolation ON assembly |
| Pi will use preinstalled `memoryStorage` when documented | **Yes** — 5/5 |
| Ad hoc `localStorage` test mocks decrease | **Yes** — 0/5 hand-rolled |
| Cross-test storage bleed eliminated | **Yes** — 0/5 confirmed |
| VERIFY-fail **distribution** improves vs v2.2 | **No** — 0/5 at zero fails (control 1/5) |
| Median weighted cost improves | **No** — +48% |
| VERIFY→PASS repair cost improves | **No** — ~30.6k vs ~12.4k (~2.5× worse) |
| Real browser reload / hollow refresh fixed | **Not tested** — out of scope |
| Runtime persistence improved | **Not tested** — out of scope |

---

## Engineering conclusions (frozen)

1. **Formal experiment: REVERT** on frozen prereg (cost + Primary A distribution).
2. **Mechanism: PASS** — `memoryStorage` is a **validated candidate/helper**; preserve in overlay/registry.
3. **Do not promote** `test_isolation` to default assembler toggle without a new prereg.
4. **Do not** target storage isolation again as the next Q2 arm — mechanism question is closed.
5. **Next experiment (separate prereg):** **RTL / test-quality + VERIFY repair orchestration** — selector discipline, journey structure, breaking repair spirals after bad VERIFY. Not storage.

---

## References

- Preregistration: [experiment-q2-test-isolation-v1-preregistration.md](./experiment-q2-test-isolation-v1-preregistration.md)
- Baseline trajectory: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Cost decomposition method: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- P1 Q2 candidate note: [experiment-preinstalled-persistence-v1-preregistration.md](./experiment-preinstalled-persistence-v1-preregistration.md)
- Export: `artifacts/exports/cohort-q2-test-isolation-v1-2026-09-01.zip`
- Staging: `artifacts/exports/q2-test-isolation-v1-staging/`
