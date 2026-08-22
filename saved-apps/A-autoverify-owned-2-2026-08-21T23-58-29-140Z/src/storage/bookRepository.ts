// Persistence boundary for the bookshelf.
// The UI never touches localStorage directly; it goes through this
// repository so storage can be swapped (e.g. for a server) without
// rewriting components.

import { type Book, repairBooks } from "../domain/book.js";

export { makeId } from "../domain/book.js";

export const STORAGE_KEY = "bookshelf.books.v1";

export interface BookRepository {
  loadAll(): Book[];
  save(books: Book[]): void;
}

/**
 * Repository backed by window.localStorage. Safely returns an empty list
 * when storage is unavailable or holds malformed data.
 */
export function createLocalStorageRepository(
  storage: Storage | null | undefined,
): BookRepository {
  function loadAll(): Book[] {
    if (!storage) return [];
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return repairBooks(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function save(books: Book[]): void {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch {
      // Storage full or disabled; treat as a no-op so the UI keeps working.
    }
  }

  return { loadAll, save };
}

/**
 * In-memory repository for tests where persistence is not the point.
 */
export function createMemoryRepository(initial: Book[] = []): BookRepository & {
  _peek: () => Book[];
} {
  let store: Book[] = [...initial];
  return {
    loadAll: () => [...store],
    save: (books: Book[]) => {
      store = [...books];
    },
    _peek: () => [...store],
  };
}
