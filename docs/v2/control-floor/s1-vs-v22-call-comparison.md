# S1 vs v2.2 Call-by-Call Matched Comparison

Analysis-only. No code changes. No new experiment.

## Phase medians

| Cohort | n | Total | Pre-first-VERIFY | VERIFY→PASS | Post-PASS |
|---|---:|---:|---:|---:|---:|
| v2.2 full cohort | 5 | 60,852 | 36,202 | 10,646 | 10,723 |
| v2.2 cheap (49–61k) | 3 | 50,364 | 30,744 | 8,896 | 10,723 |
| S1 expensive (Rep2–5) | 4 | 96,895 | 48,654 | 23,184 | 20,248 |
| S1 Rep1 anchor | 1 | 64,512 | 38,176 | 17,656 | 8,680 |

## Per-run overview

| Run | Total | Calls | Pre-VERIFY | V→PASS | Post | First VERIFY @ | First PASS @ | VERIFY path |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| v2.2 Rep3 49k | 49,449 | 16 | 30,165 | 10,646 | 8,639 | 8 | 13 | SUITE→0 (6 tests) |
| v2.2 Rep5 50k | 50,364 | 12 | 30,744 | 8,896 | 10,723 | 7 | 9 | 2→0 (8 tests) |
| v2.2 Rep2 61k | 60,852 | 15 | 44,065 | 0 | 16,787 | 11 | 11 | 0 (9 tests, first-verify green) |
| v2.2 Rep4 109k† | 108,708 | 27 | 61,378 | 30,252 | 17,078 | 14 | 23 | 3→2→0 (10 tests) |
| S1 Rep1 65k | 64,512 | 16 | 38,176 | 17,656 | 8,680 | 9 | 13 | 1→1→0 (6 tests, Tier-1 @11) |
| S1 Rep2 100k | 100,435 | 15 | 49,233 | 15,735 | 35,467 | 10 | 12 | 1→0 (7 tests) |
| S1 Rep3 90k | 89,545 | 18 | 61,974 | 16,199 | 11,372 | 12 | 15 | 1→0 (8 tests) |
| S1 Rep4 93k | 93,354 | 17 | 48,074 | 30,169 | 15,111 | 10 | 14 | 8→3→0 (15 tests) |
| S1 Rep5 105k | 105,193 | 20 | 42,185 | 37,622 | 25,385 | 9 | 14 | 8→4→0 (9 tests) |

† v2.2 Rep4 is the cohort tail outlier — included because it shows the same multi-fail converging repair cost S1 Rep4/5 exhibit.

## Call-by-call: pre-first-VERIFY (ordinal matched)

Compares call N before first VERIFY across cheap v2.2 median vs S1 expensive median.

| Call # | v2.2 cheap median wt | S1 expensive median wt | Δ | v2.2 dominant | S1 dominant |
|---:|---:|---:|---:|---|---|
| 1 | 417 | 1,258 | +841 | product_impl | product_impl |
| 2 | 1,670 | 1,556 | -114 | test_authoring | test_authoring |
| 3 | 2,219 | 2,642 | +423 | styling | styling |
| 4 | 4,216 | 4,638 | +422 | product_impl | product_impl |
| 5 | 7,021 | 7,535 | +514 | product_impl | product_impl |
| 6 | 4,315 | 10,370 | +6,055 | styling | styling |
| 7 | 6,320 | 10,828 | +4,508 | product_impl | product_impl |
| 8 | 3,481 | 5,311 | +1,830 | verify | product_impl |
| 9 | 2,953 | 7,898 | +4,945 | test_authoring | product_impl |
| 10 | 2,021 | 8,234 | +6,213 | test_authoring | verify |
| 11 | 2,575 | 6,207 | +3,632 | test_authoring | product_impl |
| 12 | 1,532 | 4,473 | +2,941 | test_authoring | verify |

## Heavy calls in S1 expensive runs (≥8k weighted)

| Run | Call | Weighted | Cum | Activity | Tools | in | cache_read |
|---|---:|---:|---:|---|---|---:|---:|
| S1 Rep2 100k | 5 | 10,908 | 21,554 | source | write(li>
  );
}
) | 2,910 | 2,944 |
| S1 Rep2 100k | 6 | 9,559 | 31,114 | css | write(

@media (max-width: 38rem) {
  .form-row {
    flex-d | 3,127 | 5,312 |
| S1 Rep2 100k | 7 | 11,491 | 42,605 | mixed | write(i)).toBeInTheDocument();
    });
  });
});
) | 4,663 | 5,760 |
| S1 Rep2 100k | 10 | 12,693 | 61,926 | other | verify | 12,645 | 0 |
| S1 Rep2 100k | 13 | 13,496 | 80,538 | mixed | bash | 13,409 | 0 |
| S1 Rep2 100k | 15 | 13,551 | 100,435 | finalize |  | 12,306 | 1,984 |
| S1 Rep3 90k | 6 | 11,180 | 27,972 | source | write(main>
  );
}
) | 3,711 | 2,304 |
| S1 Rep3 90k | 7 | 13,142 | 41,114 | css | write(
.edit-form {
  display: flex;
  flex-wrap: wrap;
  ga | 7,421 | 1,024 |
| S1 Rep3 90k | 12 | 8,700 | 70,674 | other | verify | 8,066 | 5,952 |
| S1 Rep4 93k | 6 | 9,443 | 21,557 | source | write(main>
  );
}
) | 1,058 | 4,800 |
| S1 Rep4 93k | 7 | 10,165 | 31,723 | css | write(

.book-list {
  list-style: none;
  margin: 0;
  padd | 3,646 | 4,864 |
| S1 Rep4 93k | 9 | 10,884 | 48,074 | mixed | write(>);
      await fillAddForm("Zebra Book", "Author Z",  | 2,164 | 8,448 |
| S1 Rep4 93k | 11 | 12,666 | 66,421 | mixed | write(>);
      await addBook("Zebra Book", "Author Z", "Nov | 4,005 | 10,496 |
| S1 Rep5 105k | 5 | 9,621 | 15,559 | css | write(styles.css) | 1,479 | 1,920 |
| S1 Rep5 105k | 6 | 16,004 | 31,564 | source | write(main>
  );
}
) | 5,042 | 1,024 |
| S1 Rep5 105k | 9 | 8,772 | 50,957 | other | verify | 8,462 | 3,008 |
| S1 Rep5 105k | 10 | 8,687 | 59,644 | mixed | write(i)).toBeInTheDocument();
    expect(within(tableBody() | 1,181 | 11,456 |
| S1 Rep5 105k | 11 | 9,371 | 69,014 | other | verify | 8,760 | 6,016 |
| S1 Rep5 105k | 13 | 8,181 | 79,808 | mixed | write(i)).toBeInTheDocument();
  });
});
) | 307 | 15,232 |

## Heavy calls in v2.2 cheap runs (≥8k weighted)

| Run | Call | Weighted | Cum | Activity | Tools | in | cache_read |
|---|---:|---:|---:|---|---|---:|---:|
| v2.2 Rep3 49k | 6 | 8,788 | 22,282 | css | write( 8%);
}

.add-book {
  margin-bottom: 1.25rem;
}

.car | 3,943 | 1,920 |
| v2.2 Rep5 50k | 4 | 13,956 | 19,188 | mixed | write(li>
  );
}
), write(
.empty {
  color: var(--muted);
  | 3,128 | 1,088 |
| v2.2 Rep5 50k | 5 | 8,947 | 28,135 | mixed | write(i)).toBeInTheDocument();
    expect(screen.getByText(" | 3,659 | 4,160 |
| v2.2 Rep2 61k | 9 | 8,903 | 36,966 | css | write(
.empty-state {
  text-align: center;
  padding: 3rem  | 3,466 | 4,992 |

## Work-category totals (full run)

| Category | v2.2 cheap median | S1 expensive median | Δ |
|---|---:|---:|---:|
| product_impl | 18,487 | 52,076 | +33,589 |
| test_authoring | 7,644 | 11,695 | +4,051 |
| verify | 5,267 | 14,797 | +9,530 |
| build | 0 | 0 | 0 |
| styling | 10,775 | 12,495 | +1,720 |
| recon | 0 | 0 | 0 |
| finalization | 2,784 | 4,032 | +1,248 |

## VERIFY→PASS repair detail (multi-fail converging runs)

### S1 Rep4 93k

| VERIFY @ | Outcome | fail_count | Cost this call | Cum after |
|---:|---|---:|---:|---:|
| 10 | fail | - | 5,682 | 53,756 |
| 12 | fail | - | 6,334 | 72,756 |
| 14 | pass | - | 2,810 | 81,054 |

Repair segment: 4 calls, 30,169 weighted

| Call | Weighted | Activity | Tools |
|---:|---:|---|---|
| 10 | 5,682 | other | verify |
| 11 | 12,666 | mixed | write(>);
      await addBook("Zebra Book", "Author Z", "Novel");
      await ad |
| 12 | 6,334 | other | verify |
| 13 | 5,487 | mixed | edit(App.test.tsx) |

### S1 Rep5 105k

| VERIFY @ | Outcome | fail_count | Cost this call | Cum after |
|---:|---|---:|---:|---:|
| 9 | fail | - | 8,772 | 50,957 |
| 11 | fail | - | 9,371 | 69,014 |
| 14 | pass | - | 3,745 | 83,552 |
| 18 | pass | - | 2,032 | 96,579 |

Repair segment: 5 calls, 37,622 weighted

| Call | Weighted | Activity | Tools |
|---:|---:|---|---|
| 9 | 8,772 | other | verify |
| 10 | 8,687 | mixed | write(i)).toBeInTheDocument();
    expect(within(tableBody()).queryByText("Some  |
| 11 | 9,371 | other | verify |
| 12 | 2,612 | source | edit(App.tsx) |
| 13 | 8,181 | mixed | write(i)).toBeInTheDocument();
  });
});
) |

## Rep2 deep dive: 100k in 15 calls (not snowball)

| Call | S1 Rep2 wt | v2.2 Rep5 wt | S1 activity | v2.2 activity | Why heavier? |
|---:|---:|---:|---|---|---|
| 1 | 1,279 | 417 | recon | recon | ~parity |
| 2 | 1,228 | 1,467 | recon | mixed | ~parity |
| 3 | 2,288 | 3,348 | mixed | source | ~parity |
| 4 | 5,851 | 13,956 | source | mixed | -8105 lighter |
| 5 | 10,908 | 8,947 | source | mixed | ~parity |
| 6 | 9,559 | 2,609 | css | source | input 3127 vs 1654; work type product_impl→styling |
| 7 | 11,491 | 6,320 | mixed | other | cache_read 5760 vs 3584; work type verify→product_impl |
| 8 | 5,154 | 2,576 | source | mixed | input 4142 vs 438; work type test_authoring→product_impl |
| 9 | 1,474 | 1,878 | recon | other | ~parity |
| 10 | 12,693 | 2,021 | other | mixed | input 12645 vs 987; work type product_impl→verify |
| 11 | 3,042 | 3,601 | mixed | finalize | ~parity |
| 12 | 2,073 | 3,223 | other | finalize | ~parity |
| 13 | 13,496 | - | mixed | - | extra S1 call |
| 14 | 6,346 | - | finalize | - | extra S1 call |
| 15 | 13,551 | - | finalize | - | extra S1 call |

## Rep3 deep dive: 62k before first VERIFY

| Call | S1 Rep3 wt | v2.2 Rep3 wt | S1 cum | Category |
|---:|---:|---:|---:|---|
| 1 | 1,411 | 312 | 1,411 | product_impl |
| 2 | 1,720 | 2,147 | 3,131 | product_impl |
| 3 | 2,995 | 1,987 | 6,126 | product_impl |
| 4 | 5,217 | 2,027 | 11,344 | product_impl |
| 5 | 5,448 | 7,021 | 16,791 | product_impl |
| 6 | 11,180 | 8,788 | 27,972 | product_impl |
| 7 | 13,142 | 7,882 | 41,114 | styling |
| 8 | 3,033 | 3,481 | 44,147 | product_impl |
| 9 | 7,024 | 2,953 | 51,171 | product_impl |
| 10 | 7,781 | 1,335 | 58,952 | product_impl |
| 11 | 3,022 | 1,344 | 61,974 | product_impl |

## Context at VERIFY calls (input + cache_read tokens)

| Run | First VERIFY | Second VERIFY | Third VERIFY | Fourth VERIFY |
|---|---:|---:|---:|---:|
| v2.2 Rep3 49k | @8: 8,714 tok / 3,481 wt | @13: 9,610 / 1,785 | — | — |
| v2.2 Rep5 50k | @7: 9,537 / 6,320 | @9: 10,265 / 1,878 | — | — |
| v2.2 Rep4 109k | @14: 13,510 / 1,674 | @18: 15,320 / 2,364 | @23: 17,899 / 2,610 | — |
| S1 Rep2 100k | @10: **12,645 / 12,693** (0 cache!) | @12: 13,354 / 2,073 | — | — |
| S1 Rep4 93k | @10: 13,255 / 5,682 | @12: 17,057 / 6,334 | @14: 18,123 / 2,810 | — |
| S1 Rep5 105k | @9: 11,470 / 8,772 | @11: 14,776 / 9,371 | @14: 17,675 / 3,745 | @18: 18,209 / 2,032 |

**Pattern:** expensive runs pay for VERIFY calls in one of two ways — (a) **cold input** (Rep2 call 10: 12,645 input, 0 cache_read → full-weight billing), or (b) **accumulated context** (Rep4/5: input+cache grows 13k→18k across repair cycle). Cheap v2.2 runs reuse cache aggressively on later VERIFY calls.

---

## Three-bucket reconciliation (~32.5k median gap)

```text
S1 expensive median:   96,895
v2.2 full median:      60,852
Δ total:              ~36,043  (S1 expensive vs v2.2 full)

Decomposed:
  Pre-first-VERIFY:   +12,452  (48,654 vs 36,202)
  VERIFY → PASS:      +12,538  (23,184 vs 10,646)
  Post-PASS:           +9,525  (20,248 vs 10,723)
```

Compared to **v2.2 cheap (49–61k)** the gap is larger still: pre +17.9k, v2p +14.3k.

---

## Which calls got heavier — by run archetype

### Archetype A: Extended pre-VERIFY (Rep3, 90k)

- **11 calls / 62k** before first VERIFY vs v2.2 cheap median **~31k in 7–8 calls**.
- Heavy calls @6–7: source write (11k) + CSS write (13k) — same *types* as v2.2 but **deferred VERIFY** lets product/CSS stack up.
- First VERIFY @12 is only 1 failure — repair is cheap; the damage is all pre-VERIFY.

### Archetype B: Cold-context VERIFY + post-pass finalization (Rep2, 100k)

- Only **15 calls** — not a snowball.
- Call 10 (first VERIFY): **12,693 wt** driven by **12,645 uncached input tokens** (v2.2 cheap VERIFY median ~3–6k).
- Calls 13–15 (post-PASS): **bash 13.5k + finalize 13.5k + finalize 6.3k = 33k** — build/finalization with full conversation history attached.
- v2.2 Rep5 (matched 12-call cheap run) finishes at call 12 with ~10.7k post-PASS total.

### Archetype C: Multi-fail converging repair (Rep4/5, 93–105k)

- Rep4: **8→3→0** over 15 tests; Rep5: **8→4→0** over 9 tests.
- S1 **correctly silent** (all transitions `converging`, tier 0).
- Repair segment Rep4: 4 calls / **30.2k**; Rep5: 5 calls / **37.6k**.
- **v2.2 Rep4 (109k tail)** shows the same shape: **3→2→0**, repair **30.3k** — this pathology is **not S1-specific**; it is trajectory variance in test-heavy repair loops.
- Extra cost vs cheap v2.2 comes from **more tests authored** (Rep4: 15 vs cheap median 6–8) and **heavier intermediate test edits** (call 11 Rep4: 12.7k writing test helpers).

### Archetype D: Near-parity cheap path (Rep1, 65k)

- **1→1→0** on 6 tests; one **stalled** VERIFY (call 11: 9,055 wt, Tier-1 delivered) then green.
- Total within ~4k of v2.2 Rep2 (61k); pre-VERIFY only +4k vs v2.2 cheap median.

---

## Key findings

1. **CSS is not the explanation.** Styling bucket median delta is +1.7k; both cohorts have 8–13k CSS calls. v2.2 comparison already had CSS off.
2. **Pre-VERIFY gap (~+12–18k)** comes from **more product/test work before first VERIFY** (Rep3 deferral) and **heavier individual implementation calls** (calls 6–10 ordinal +4–6k each vs v2.2 cheap median).
3. **VERIFY→PASS gap (~+12–15k vs v2.2 full)** is dominated by **multi-fail converging loops** (Rep4/5). S1 cannot reduce this — classifier sees monotonic improvement.
4. **Post-PASS gap (~+9.5k)** is Rep2-specific: **build + double-finalization** with 12–13k input each.
5. **Heavy-call mechanism:** cost spikes are **per-call context weight** (uncached input or large cache_read), not call-count explosion — except where multi-fail repair adds 2–3 extra VERIFY cycles.
6. **S1 limitation confirmed:** converging 8→3→0 and 8→4→0 paths burn 30–40k with zero intervention opportunity.
7. **S1 Rep1 (~65k)** is the counterexample: short test suite, one stalled intervention, no post-pass bloat.

---

## Implication for next step (analysis only)

Do **not** jump to S2. The expensive S1 runs share failure modes with **v2.2 Rep4 (109k)** — test-suite bloat, multi-fail converging repair, and cold-context VERIFY/finalization calls — none of which S1 targets.

Next investigation should compare **what Pi authored differently** in expensive vs cheap runs (test count, test LOC, first-verify timing), not intervention tier design.
