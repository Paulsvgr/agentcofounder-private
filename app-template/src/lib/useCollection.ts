import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { createCollection, type Collection, type CollectionOptions, type StorageFailure } from "./storage.js";

export interface Identified {
  id: string;
}

export interface CollectionApi<T extends Identified> {
  items: readonly T[];
  add: (item: T) => void;
  update: (id: string, change: (item: T) => T) => void;
  remove: (id: string) => void;
  replace: (items: readonly T[]) => void;
}

/**
 * React binding over a persisted collection.
 *
 * The collection is created once and read through useSyncExternalStore, so any
 * component rendering the same store stays consistent without prop drilling.
 * Mutations are expressed as whole-list replacements, keeping persistence and
 * domain rules out of components.
 */
export function useCollection<T extends Identified>(
  key: string,
  options: CollectionOptions<T>,
): CollectionApi<T> {
  // Options commonly arrive as inline literals; capture the first ones so a new
  // object identity on re-render cannot rebuild the store and drop state.
  const stored = useRef<Collection<T> | undefined>(undefined);
  const latestOptions = useRef(options);
  latestOptions.current = options;

  if (!stored.current) {
    stored.current = createCollection<T>(key, {
      revive: (value) => latestOptions.current.revive(value),
      storage: options.storage,
      onFailure: (failure: StorageFailure, detail: string) =>
        latestOptions.current.onFailure?.(failure, detail),
    });
  }
  const collection = stored.current;

  const items = useSyncExternalStore(collection.subscribe, collection.list, collection.list);

  const replace = useCallback(
    (next: readonly T[]) => collection.replace(next),
    [collection],
  );

  return useMemo(
    () => ({
      items,
      replace,
      add: (item: T) => replace([...collection.list(), item]),
      update: (id: string, change: (item: T) => T) =>
        replace(collection.list().map((item) => (item.id === id ? change(item) : item))),
      remove: (id: string) => replace(collection.list().filter((item) => item.id !== id)),
    }),
    [collection, items, replace],
  );
}
