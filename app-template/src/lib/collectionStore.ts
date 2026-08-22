export interface CollectionStore<T> {
  load(): T[];
  save(items: T[]): void;
}

/**
 * Domain-neutral JSON list persistence.
 * `parse` validates ONE array item (not the whole storage payload).
 */
export function createCollectionStore<T>(options: {
  key: string;
  parse: (raw: unknown) => T | null;
  storage?: Storage | null;
}): CollectionStore<T> {
  const storage =
    options.storage === undefined
      ? typeof globalThis !== "undefined" && "localStorage" in globalThis
        ? globalThis.localStorage
        : null
      : options.storage;

  return {
    load(): T[] {
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
      if (!storage) return;
      try {
        storage.setItem(options.key, JSON.stringify(items));
      } catch {
        // Best-effort persistence; in-memory UI state can still work.
      }
    },
  };
}
