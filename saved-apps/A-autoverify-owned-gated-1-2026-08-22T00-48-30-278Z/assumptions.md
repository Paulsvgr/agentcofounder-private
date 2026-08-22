# Assumptions

The product idea described a single-user, on-one-computer book lending tracker. The following decisions were made for genuinely ambiguous points:

1. **Categories are a fixed pick-list.** The idea mentions "novel, cookbook, reference thing" as examples of "roughly what kind of book it is." A fixed list (Novel, Cookbook, Reference, Biography, History, Science, Poetry, Children's, Other) keeps the UI simple and lets the filter/grouping stay predictable. Free-text categories were considered but would make "roughly what kind" harder to keep consistent across entries; "Other" covers anything off-list.

2. **Persistence is browser-local (localStorage), single user.** The idea says "it's just me using it on my own computer," so no login, backend, or sync is needed. Data is stored under one key and survives refresh. The repository boundary means a different storage target could be swapped in without touching the UI.

3. **Duplicate detection is by title + author, case-insensitive, trimmed.** The idea mentions "add a book by mistake" should be fixable/removable; preventing exact duplicates is a sensible guard so the "one list of everything I own" stays accurate. Editions/different books with the same title+author are treated as the same entry (the single-user owner can edit instead).

4. **Filter scope is "All" vs "Lent out."** The idea explicitly asks to "see everything I own in one list" and "pick out just the ones that are currently out with someone," and "see how many are lent out right now." Category-based filtering is not requested, so it is omitted rather than invented; the category is still shown for each book.

5. **No due dates or dates of any kind.** The idea only asks to note a borrower and clear it when the book returns. Dates/timers are not implied and are omitted.

6. **Lending is inline per book (Lend out -> enter name -> confirm).** No separate borrowers list or history is maintained; the idea only needs the current borrower recorded and cleared.
