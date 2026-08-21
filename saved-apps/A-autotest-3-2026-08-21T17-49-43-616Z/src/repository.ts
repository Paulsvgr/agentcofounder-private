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
  loadAll(): Book[];
  saveAll(books: Book[]): void;
}

/** In-memory repository useful for tests and as a fallback. */
export class MemoryBookRepository implements BookRepository {
  private books: Book[] = [];

  constructor(initial: Book[] = []) {
    this.books = [...initial];
  }

  loadAll(): Book[] {
    return [...this.books];
  }

  saveAll(books: Book[]): void {
    this.books = [...books];
  }
}

/**
 * localStorage-backed repository. Degrades gracefully: if storage is
 * unavailable or holds malformed data, it behaves like an empty shelf
 * rather than crashing the app.
 */
export class LocalBookRepository implements BookRepository {
  loadAll(): Book[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isBook);
    } catch {
      return [];
    }
  }

  saveAll(books: Book[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch {
      // Storage may be full or unavailable; ignore so the UI keeps working.
    }
  }
}
