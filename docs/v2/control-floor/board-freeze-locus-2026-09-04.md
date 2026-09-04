# Board freeze: locus directions (2026-09-04 evening)

**Wrong locus (product deformed to satisfy bad test):** **DROP**  
→ `measurement-wrong-locus-natural-2026-09-04.md` — **0/90** eligible COMPLETE-evidence natural fails.

**Test weakening:** **OBSERVE ONLY**  
→ `measurement-test-weakening-2026-09-04.md` — **7/318 ≈ 2.2%** of test-repair windows; usually one assert lost.  
Do **not** ban regex / `within` / matcher relaxation generally. If quality regressions are audited later, watch narrowly: deleted negatives, borrower/category/persistence asserts, materially weaker matchers.

**Neither explains expensive natural repair tails.** Next measurement: **TEST BUG vs PRODUCT BUG** on natural first fails / multi-VERIFY loops — `measurement-test-bug-vs-product-bug-2026-09-04.md` (**DONE**: expensive tails **64% TEST_BUG**, one-shot **87% TEST_BUG**, clear PRODUCT_BUG ≈0).
