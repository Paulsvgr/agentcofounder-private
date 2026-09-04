---
name: mvp-builder
description: Turn a raw product idea into a small, tested, persistent browser application.
---

# Shaping any idea into a POC

Ideas are not always record lists. Identify which shape the idea has, then apply the matching plan.

- **Register / tracker** (things with attributes and status): entity + list + create/edit/remove + filter + counts.
- **Workflow / lifecycle** (items moving through stages): the same, plus an explicit state machine and stage-aware views and actions.
- **Planner / scheduler** (things placed in time): entity with dates, an upcoming/overdue view, and due-date derivations.
- **Log / journal** (repeated timestamped entries): append-first UI, per-period grouping and totals.
- **Comparison / analysis** (numbers the user wants to understand): entry capture plus derived aggregates, ranking, and outlier highlighting.
- **Checklist / operations** (work to complete against a subject): parent entity with child items, progress derivation, unresolved-items view.

Most ideas are one shape with a second entity attached. Two related entities are common
(e.g. a subject and the entries about it); three is usually feature creep.

# Working rules

1. Extract entities, fields, states, derived values, filters, and every ambiguity. Record each
   ambiguity and the decision in `assumptions`.
2. Use the public journey guidance as a coverage check: implement each pattern the idea implies,
   and skip a pattern it does not imply rather than inventing a substitute.
3. Persist through the starter repository, never `localStorage` directly. Give every stored
   record a `parseRecord` that rejects malformed entries so damaged data degrades instead of crashing.
4. Model lifecycles with `createStateMachine` and disable or hide actions the current state forbids.
5. Validate with the shipped rules; show one message per field, and use `unique()` where the idea
   implies records should not be duplicated.
6. Every collection view needs an empty state; every action needs a visible result; every derived
   number the idea asks for goes on screen with a label.
7. Test through the UI with accessible queries. Cover: create → appears; edit and remove; each state
   change; the filter; the derived total; invalid input rejected; persistence across a remount;
   corrupted stored data still renders the app.
8. Run `npm test` and `npm run build`; repair failures and rerun. No skipped or todo tests.
