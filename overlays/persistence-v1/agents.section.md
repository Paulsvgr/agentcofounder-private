## Collection persistence (preinstalled)

For **flat keyed collections** that must survive browser refresh, use `createCollectionStore` and `useCollection` from `@/lib/`.

- Do **not** hand-roll `localStorage` load/save with separate `useEffect`s.
- You still write: entity type, a `parse` function for one array item, domain validation, UI, and journey tests.
- For non-collection state (wizards, timers, nested trees), design what fits instead of forcing this hook.
