// Local persistence for books behind a small repository boundary.
import type { Book, Category } from "../domain/book.js";
import { coerceCategory } from "../domain/book.js";

const STORAGE_KEY = "bookshelf.books.v1";

export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Coerce an unknown value into a usable Book, or null if it can't be salvaged. */
export function coerceBook(value: unknown): Book | null {
  if (!isRecord(value)) return null;
  const { id, title, author, category, borrower } = value;
  if (typeof id !== "string" || id === "") return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof author !== "string" || author === "") return null;
  const safeCategory: Category = coerceCategory(category);
  const safeBorrower =
    typeof borrower === "string" && borrower.trim() !== "" ? borrower.trim() : null;
  return { id, title, author, category: safeCategory, borrower: safeBorrower };
}

/** Coerce the raw stored array, dropping any malformed entries. */
export function coerceBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) return [];
  return value.map(coerceBook).filter((b): b is Book => b !== null);
}

/** A repository backed by window.localStorage, with graceful failure handling. */
export function createLocalBookRepository(storage: Storage): BookRepository {
  return {
    load(): Book[] {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        return coerceBooks(JSON.parse(raw));
      } catch {
        // Corrupt JSON or unavailable storage: start from an empty shelf.
        return [];
      }
    },
    save(books: Book[]): void {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(books));
      } catch {
        // Quota exceeded or storage unavailable: keep the in-memory state.
      }
    },
  };
}

/** In-memory repository for tests and environments without storage. */
export function createMemoryBookRepository(initial: Book[] = []): BookRepository {
  let books: Book[] = [...initial];
  return {
    load(): Book[] {
      return [...books];
    },
    save(next: Book[]): void {
      books = [...next];
    },
  };
}
