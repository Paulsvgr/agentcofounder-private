import type { Book } from "../domain/books";

const STORAGE_KEY = "family-books:v1";

type StoredState = {
  books: Book[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBook(value: unknown): value is Book {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.author === "string" &&
    typeof value.kind === "string" &&
    (typeof value.borrowedBy === "string" || value.borrowedBy === null) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}

export type BookStore = {
  load(): Book[];
  save(books: Book[]): void;
  clear(): void;
};

export function createLocalStorageBookStore(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.localStorage,
): BookStore {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return [];
        const booksVal = (parsed as StoredState).books;
        if (!Array.isArray(booksVal)) return [];
        const books = booksVal.filter(isBook);
        // sort stable for UI
        books.sort((a, b) => a.createdAt - b.createdAt);
        return books;
      } catch {
        return [];
      }
    },
    save(books) {
      const state: StoredState = { books };
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    clear() {
      storage.removeItem(STORAGE_KEY);
    },
  };
}
