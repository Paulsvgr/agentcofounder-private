import type { Book, StoredBook } from "./types.js";

const STORAGE_KEY = "book-shelf.books.v1";

export interface BookRepository {
  loadAll(): Book[];
  saveAll(books: Book[]): void;
}

const toStored = (book: Book): StoredBook => ({ ...book });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Coerce unknown stored data into a valid book, or drop it if malformed.
 * Malformed persisted data is skipped rather than crashing the app.
 */
const coerceBook = (value: unknown): Book | null => {
  if (!isObject(value)) return null;
  const id = value["id"];
  const title = value["title"];
  const author = value["author"];
  const category = value["category"];
  const borrowerName = value["borrowerName"];
  if (!isString(id)) return null;
  if (!isString(title)) return null;
  if (!isString(author)) return null;
  if (
    category !== "novel" &&
    category !== "cookbook" &&
    category !== "reference" &&
    category !== "other"
  ) {
    return null;
  }
  if (borrowerName !== null && !isString(borrowerName)) return null;
  return {
    id,
    title,
    author,
    category,
    borrowerName: borrowerName as string | null,
  };
};

/**
 * localStorage-backed repository. Falls back gracefully when storage is
 * unavailable (private mode, quota, etc.) so the UI keeps working in-memory.
 */
export const createLocalStorageRepository = (): BookRepository => {
  const safeStorage = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  return {
    loadAll(): Book[] {
      const storage = safeStorage();
      if (!storage) return [];
      let raw: string | null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return [];
      }
      if (!raw) return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      if (!Array.isArray(parsed)) return [];
      const books: Book[] = [];
      for (const entry of parsed) {
        const book = coerceBook(entry);
        if (book) books.push(book);
      }
      return books;
    },
    saveAll(books: Book[]): void {
      const storage = safeStorage();
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(books.map(toStored)));
      } catch {
        /* ignore write failures; UI still holds current state in memory */
      }
    },
  };
};
