/**
 * Durable, single-user collection storage.
 *
 * Domain-neutral on purpose: the collection knows nothing about what it holds
 * beyond the `revive` function handed to it, so any record shape can use it.
 */

export type StorageFailure =
  /** No usable Storage: private browsing, disabled cookies, no window. */
  | "unavailable"
  /** Stored value was missing, unparseable, or not a list. */
  | "corrupt"
  /** Some stored entries failed to revive and were dropped. */
  | "partial"
  /** A write was rejected, typically because the quota is exhausted. */
  | "write-failed";

export interface CollectionOptions<T> {
  /** Return the item when the raw value is usable, or undefined to drop it. */
  revive: (value: unknown) => T | undefined;
  /** Defaults to window.localStorage when one is reachable. */
  storage?: Storage | null;
  /** Called for every degraded outcome so the UI can surface it. */
  onFailure?: (failure: StorageFailure, detail: string) => void;
}

export interface Collection<T> {
  /** The current items. Always a usable array, even after a storage failure. */
  list: () => readonly T[];
  /** Replace the items, persisting when storage allows. */
  replace: (items: readonly T[]) => void;
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Resolve a Storage safely.
 *
 * Browsers throw on `window.localStorage` itself under some privacy settings,
 * so access is probed rather than assumed. Returns null when unusable.
 */
export function resolveStorage(candidate?: Storage | null): Storage | null {
  if (candidate !== undefined) return candidate;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    // A disabled store can expose the API and still reject every write.
    const probe = "__probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Read persisted items, salvaging whatever survives.
 *
 * A single unusable entry never discards the rest: bad entries are dropped and
 * reported as `partial`, so one malformed record cannot wipe a collection.
 */
export function readItems<T>(
  key: string,
  storage: Storage | null,
  revive: (value: unknown) => T | undefined,
  onFailure?: (failure: StorageFailure, detail: string) => void,
): T[] {
  if (!storage) {
    onFailure?.("unavailable", "Storage is unavailable; changes last for this session only.");
    return [];
  }

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    onFailure?.("unavailable", `Could not read saved data: ${String(error)}`);
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    onFailure?.("corrupt", "Saved data was unreadable and has been ignored.");
    return [];
  }
  if (!Array.isArray(parsed)) {
    onFailure?.("corrupt", "Saved data was not a list and has been ignored.");
    return [];
  }

  const items: T[] = [];
  let dropped = 0;
  for (const entry of parsed) {
    const item = revive(entry);
    if (item === undefined) dropped += 1;
    else items.push(item);
  }
  if (dropped > 0) {
    onFailure?.("partial", `${dropped} unreadable ${dropped === 1 ? "entry" : "entries"} were skipped.`);
  }
  return items;
}

/**
 * Create a persisted collection.
 *
 * Items are held in memory and mirrored to storage. A failed write is reported
 * but never rolls back the in-memory state, so the session stays usable when
 * the quota is exhausted.
 */
export function createCollection<T>(key: string, options: CollectionOptions<T>): Collection<T> {
  const storage = resolveStorage(options.storage);
  let items: readonly T[] = readItems(key, storage, options.revive, options.onFailure);
  const listeners = new Set<() => void>();

  return {
    list: () => items,
    replace: (next) => {
      items = [...next];
      if (storage) {
        try {
          storage.setItem(key, JSON.stringify(items));
        } catch (error) {
          options.onFailure?.(
            "write-failed",
            `Changes could not be saved and will be lost when the page closes: ${String(error)}`,
          );
        }
      }
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
