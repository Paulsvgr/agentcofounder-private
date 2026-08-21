import type { Book } from "./types";
import { sanitizeBooks, STORAGE_KEY } from "./domain";

export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
}

/** A localStorage-backed repository that recovers from quota/access failures. */
export function createLocalBookRepository(
  storage: Storage = window.localStorage,
): BookRepository {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return sanitizeBooks(JSON.parse(raw));
      } catch {
        return [];
      }
    },
    save(books: Book[]) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(books));
      } catch {
        // Quota exceeded or storage unavailable; the in-memory state still
        // reflects the user's intent for the current session.
      }
    },
  };
}
