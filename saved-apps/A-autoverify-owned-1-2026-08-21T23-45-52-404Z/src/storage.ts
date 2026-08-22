// Persistence boundary: the only module that touches localStorage.
// A different client (e.g. an API) could replace this without touching UI.

import { normalizeBook, type Book } from "./domain.js";

const STORAGE_KEY = "book-tracker.books.v1";

export interface BookRepository {
  load(): Book[];
  save(books: readonly Book[]): void;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Reads and validates stored data, dropping malformed records. */
function readRaw(): Book[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const books: Book[] = [];
    for (const entry of parsed) {
      const normalized = normalizeBook(entry);
      if (normalized) books.push(normalized);
    }
    return books;
  } catch {
    return [];
  }
}

function writeRaw(books: readonly Book[]): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // Storage may be full or unavailable; failures are non-fatal for in-session use.
  }
}

export const localBookRepository: BookRepository = {
  load: readRaw,
  save: writeRaw,
};
