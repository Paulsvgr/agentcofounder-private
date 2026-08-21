// Persistence boundary for books. LocalStorage-backed so the UI, domain,
// and storage stay cleanly separable; another client or store can replace
// this module without touching the UI or domain logic.

import type { Book, BookCategory } from "../domain/book.js";
import { isBookCategory } from "../domain/book.js";

const STORAGE_KEY = "home-library.books.v1";

/**
 * A single row that may be on disk. Fields are loosely typed because they
 * come from JSON; we sanitize before constructing a Book.
 */
interface StoredBook {
  id: unknown;
  title: unknown;
  author: unknown;
  category: unknown;
  borrower: unknown;
}

export interface BookRepository {
  loadAll(): Book[];
  saveAll(books: Book[]): void;
  clear(): void;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function sanitizeBook(raw: StoredBook): Book | null {
  if (!isString(raw.id) || raw.id.length === 0) return null;
  if (!isString(raw.title) || raw.title.trim().length === 0) return null;
  if (!isString(raw.author) || raw.author.trim().length === 0) return null;
  if (!isBookCategory(raw.category)) return null;

  const borrower = raw.borrower;
  const cleanBorrower: string | null =
    isString(borrower) && borrower.trim().length > 0
      ? borrower.trim()
      : null;

  return {
    id: raw.id,
    title: raw.title.trim(),
    author: raw.author.trim(),
    category: raw.category as BookCategory,
    borrower: cleanBorrower,
  };
}

function sanitizeBooks(raw: unknown): Book[] {
  if (!Array.isArray(raw)) return [];
  const books: Book[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const book = sanitizeBook(entry as StoredBook);
    if (book) books.push(book);
  }
  return books;
}

export function createBookRepository(
  storage: Storage | null,
): BookRepository {
  return {
    loadAll(): Book[] {
      if (!storage) return [];
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return sanitizeBooks(JSON.parse(raw));
      } catch {
        return [];
      }
    },
    saveAll(books: Book[]): void {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(books));
      } catch {
        // Storage may be full or unavailable; swallow so the UI keeps working.
      }
    },
    clear(): void {
      if (!storage) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}
