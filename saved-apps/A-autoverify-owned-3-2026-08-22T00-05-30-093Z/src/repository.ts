import type { Book } from "./types.js";

const STORAGE_KEY = "bookshelf.books.v1";

function isBook(value: unknown): value is Book {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.author === "string" &&
    typeof b.category === "string" &&
    (b.borrower === null || typeof b.borrower === "string")
  );
}

export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
}

export function createRepository(
  storage: Storage | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): BookRepository {
  return {
    load() {
      if (!storage) return [];
      let raw: string | null = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return [];
      }
      if (raw === null) return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isBook).map((b) => ({ ...b }));
    },
    save(books) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(books));
      } catch {
        // storage may be full or unavailable; nothing we can do
      }
    },
  };
}
