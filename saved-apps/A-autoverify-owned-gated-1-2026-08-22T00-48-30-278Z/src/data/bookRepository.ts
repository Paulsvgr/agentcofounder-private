import type { Book } from "../types";
import { isBook } from "../domain/book";

const STORAGE_KEY = "shelf-books-v1";

export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
}

/**
 * Repository backed by localStorage. Silently returns an empty list when
 * storage is unavailable or contains malformed data so the UI keeps working.
 */
export function createLocalStorageRepository(
  storage: Storage | undefined,
  key: string = STORAGE_KEY,
): BookRepository {
  return {
    load(): Book[] {
      if (!storage) return [];
      try {
        const raw = storage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isBook);
      } catch {
        return [];
      }
    },
    save(books: Book[]): void {
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(books));
      } catch {
        // Ignore write failures (quota / private mode) — data just won't persist.
      }
    },
  };
}

export function generateId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
