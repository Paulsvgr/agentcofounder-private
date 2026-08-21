// LocalStorage-backed repository for books. Isolates persistence from UI/domain.
import {
  type Book,
  generateId,
  normalizeBook,
} from "../domain/book.js";

const STORAGE_KEY = "home-library.books.v1";

export interface BookRepository {
  loadAll(): Book[];
  saveAll(books: Book[]): void;
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** In-memory repository, useful for tests and as a fallback. */
export class InMemoryBookRepository implements BookRepository {
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

/** LocalStorage repository with graceful fallback when storage is unavailable. */
export class LocalStorageBookRepository implements BookRepository {
  private readonly key: string;
  private readonly storage: Storage | null;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
    this.storage = getLocalStorage();
  }

  loadAll(): Book[] {
    if (!this.storage) return [];
    const raw = safeParse(this.storage.getItem(this.key));
    if (!Array.isArray(raw)) return [];
    const books: Book[] = [];
    for (const item of raw) {
      const book = normalizeBook(item);
      if (book) books.push(book);
    }
    return books;
  }

  saveAll(books: Book[]): void {
    if (!this.storage) return; // storage unavailable: silently degrade
    try {
      this.storage.setItem(this.key, JSON.stringify(books));
    } catch {
      // Quota or other storage error: silently degrade rather than crash.
    }
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const ls = window.localStorage;
      // Probe to confirm it actually works (private mode throws on write).
      ls.setItem("__hl_probe__", "1");
      ls.removeItem("__hl_probe__");
      return ls;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Convenience: create a new id at the repository boundary. */
export function newId(): string {
  return generateId();
}
