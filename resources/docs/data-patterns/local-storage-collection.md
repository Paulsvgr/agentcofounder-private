# Local collection persistence (full reference)

Lazy-retrieval doc for `data-patterns/local-storage-collection`.  
Pi receives the short section in generated `RESOURCES.md` only.

## Files installed

| File | Role |
|------|------|
| `src/lib/collectionStore.ts` | JSON array persistence with per-item `parse` |
| `src/lib/useCollection.ts` | React CRUD hook over a store |
| `src/lib/text.ts` | `normalizeText`, `createId` |
| `src/test/memoryStorage.ts` | Map-backed Storage for tests |

## Exp5b hardening

- Default `storage` is resolved **lazily** on each `load`/`save`, not captured once at construction.
- Pass explicit `storage: createMemoryStorage()` in tests.

## Usage

```ts
import { createCollectionStore } from "@/lib/collectionStore";
import { useCollection } from "@/lib/useCollection";
import { createMemoryStorage } from "@/test/memoryStorage";

type Book = { id: string; title: string };

function parseBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  return { id: o.id, title: o.title };
}

// Production
const store = createCollectionStore<Book>({ key: "books", parse: parseBook });

// Tests
const testStore = createCollectionStore<Book>({
  key: "books",
  parse: parseBook,
  storage: createMemoryStorage(),
});

function App() {
  const { items, add, remove } = useCollection(store);
  // ...
}
```

## When not to use

- Nested trees, wizards, or non-list state → design a fitting store instead of forcing `useCollection`.
- Multi-user or server sync → needs an integration resource, not this pattern.

## Phase F provenance

Exp5 WEAK KEEP, Exp5b KEEP for predictability. Moved from fixed template to registry in V2.
