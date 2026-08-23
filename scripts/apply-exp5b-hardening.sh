#!/usr/bin/env bash
# Apply Exp5b storage hardening after Exp6 cohort completes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat > "$ROOT/app-template/src/lib/collectionStore.ts" <<'EOF'
export interface CollectionStore<T> {
  load(): T[];
  save(items: T[]): void;
}

function resolveStorage(explicit: Storage | null | undefined): Storage | null {
  if (explicit !== undefined) return explicit;
  try {
    return typeof globalThis !== "undefined" && "localStorage" in globalThis
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Domain-neutral JSON list persistence.
 * `parse` validates ONE array item (not the whole storage payload).
 *
 * When `storage` is omitted, the default global storage is resolved lazily on
 * each load/save so tests can replace `globalThis.localStorage` after import.
 * An explicitly provided storage object stays fixed for the store lifetime.
 */
export function createCollectionStore<T>(options: {
  key: string;
  parse: (raw: unknown) => T | null;
  storage?: Storage | null;
}): CollectionStore<T> {
  const explicitStorage = options.storage;

  return {
    load(): T[] {
      const storage = resolveStorage(explicitStorage);
      if (!storage) return [];
      let raw: string | null;
      try {
        raw = storage.getItem(options.key);
      } catch {
        return [];
      }
      if (raw == null || raw === "") return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      if (!Array.isArray(parsed)) return [];
      const items: T[] = [];
      for (const entry of parsed) {
        const item = options.parse(entry);
        if (item !== null) items.push(item);
      }
      return items;
    },
    save(items: T[]): void {
      const storage = resolveStorage(explicitStorage);
      if (!storage) return;
      try {
        storage.setItem(options.key, JSON.stringify(items));
      } catch {
        // Best-effort persistence; in-memory UI state can still work.
      }
    },
  };
}
EOF

python3 <<PY
from pathlib import Path
agents = Path("$ROOT/app-template/AGENTS.md")
text = agents.read_text()
needle = "validates **one** array item, not the whole payload)."
insert = needle + """

For simple flat CRUD, **`useCollection` is the persistence boundary** — pass a module-level `createCollectionStore` instance and use the hook directly in your app. Do not add repository or service wrapper layers unless the domain genuinely needs indirection beyond flat keyed collections."""
if "useCollection` is the persistence boundary" not in text:
    text = text.replace(needle, insert, 1)
    agents.write_text(text)
    print(f"Updated {agents}")
PY

echo "Exp5b hardening applied."
