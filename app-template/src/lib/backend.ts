/**
 * The seam between the application and wherever its records actually live.
 *
 * Components never touch a backend directly — they use `useCollection`, which
 * talks to one of these. Swapping browser storage for a hosted database means
 * writing one adapter and passing it in; no component changes.
 *
 * Deliberately tiny: a whole-collection read and a whole-collection write. That
 * is enough for a single-user application and keeps an adapter to a few lines.
 */

/** Why a read or write did not fully succeed. */
export type BackendFailure =
  /** No backend reachable: private browsing, offline, missing credentials. */
  | "unavailable"
  /** Stored payload was missing, unparseable, or not a list. */
  | "corrupt"
  /** Some entries could not be revived and were skipped. */
  | "partial"
  /** The write was rejected — quota exhausted, offline, permission denied. */
  | "write-failed";

export interface CollectionBackend {
  /**
   * Return the raw stored value for `key`, or null when nothing is stored.
   * Throw to signal the backend is unreachable.
   */
  read: (key: string) => string | null;
  /** Persist `value` under `key`. Throw when the write is rejected. */
  write: (key: string, value: string) => void;
}

/**
 * Browser storage, the default backend.
 *
 * Access is probed rather than assumed: some privacy settings make
 * `window.localStorage` throw on access, and others expose the API while
 * rejecting every write. Returns null when no usable store exists, which the
 * collection reports as `unavailable` rather than crashing.
 */
export function browserBackend(storage?: Storage | null): CollectionBackend | null {
  const resolved = resolveStorage(storage);
  if (!resolved) return null;
  return {
    read: (key) => resolved.getItem(key),
    write: (key, value) => resolved.setItem(key, value),
  };
}

export function resolveStorage(candidate?: Storage | null): Storage | null {
  if (candidate !== undefined) return candidate;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "__probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * A backend that keeps everything in memory for the life of the page.
 *
 * Useful in tests, and as the shape to copy when writing an adapter for a
 * hosted service. A remote adapter looks the same: `read` returns the stored
 * JSON string, `write` sends it, and either throws when the service is
 * unreachable so the collection can report the failure to the user.
 */
export function memoryBackend(seed: Record<string, string> = {}): CollectionBackend {
  const map = new Map(Object.entries(seed));
  return {
    read: (key) => map.get(key) ?? null,
    write: (key, value) => void map.set(key, value),
  };
}
