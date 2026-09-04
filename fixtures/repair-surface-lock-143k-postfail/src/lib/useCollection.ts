import { useCallback, useState } from "react";
import { createId } from "./text";
import type { CollectionStore } from "./collectionStore";

/**
 * Flat keyed CRUD over a CollectionStore.
 * Prefer this for list/collection apps. If state is not a flat keyed
 * collection (timer, wizard, nested tree, etc.), design what fits instead.
 */
export function useCollection<T extends { id: string }>(
  store: CollectionStore<T>,
  options?: { idFactory?: () => string },
): {
  items: T[];
  add(fields: Omit<T, "id">): T;
  update(id: string, patch: Partial<Omit<T, "id">>): void;
  remove(id: string): void;
  replaceAll(items: T[]): void;
} {
  const idFactory = options?.idFactory ?? createId;
  const [items, setItems] = useState<T[]>(() => store.load());

  const commit = useCallback(
    (next: T[]) => {
      setItems(next);
      store.save(next);
    },
    [store],
  );

  const add = useCallback(
    (fields: Omit<T, "id">): T => {
      const item = { ...fields, id: idFactory() } as T;
      commit([...items, item]);
      return item;
    },
    [commit, idFactory, items],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<T, "id">>): void => {
      commit(items.map((item) => (item.id === id ? ({ ...item, ...patch } as T) : item)));
    },
    [commit, items],
  );

  const remove = useCallback(
    (id: string): void => {
      commit(items.filter((item) => item.id !== id));
    },
    [commit, items],
  );

  const replaceAll = useCallback(
    (next: T[]): void => {
      commit(next);
    },
    [commit],
  );

  return { items, add, update, remove, replaceAll };
}
