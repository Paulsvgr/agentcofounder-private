// Persistence boundary. The UI talks to this interface; the storage mechanism
// can be swapped without changing the UI or domain logic.

import { Book, sanitizeBookList } from "./domain.js";

const STORAGE_KEY = "home-library.books.v1";

export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
  clear(): void;
}

function isStorageAvailable(): boolean {
  try {
    const probe = "__home_library_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** A localStorage-backed repository. Degrades to in-memory (no persistence)
 *  when storage is unavailable or full, so the app keeps working. */
export function createLocalStorageRepository(): BookRepository {
  return {
    load(): Book[] {
      if (!isStorageAvailable()) return [];
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return sanitizeBookList(JSON.parse(raw));
      } catch {
        return [];
      }
    },
    save(books: Book[]): void {
      if (!isStorageAvailable()) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      } catch {
        // Quota exceeded or storage disabled: drop the write silently.
      }
    },
    clear(): void {
      if (!isStorageAvailable()) return;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}
