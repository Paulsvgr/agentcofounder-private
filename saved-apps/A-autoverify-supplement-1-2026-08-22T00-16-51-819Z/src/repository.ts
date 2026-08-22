import type { Book, BookId } from "./types.js";

/**
 * Persistence boundary. The UI talks only to this interface, so storage can be
 * swapped (e.g. for a server) without rewriting components.
 */
export interface BookRepository {
  load(): Book[];
  save(books: Book[]): void;
}

const STORAGE_KEY = "book-shelf.v1";

/** In-browser localStorage implementation. Survives page refresh. */
export class LocalStorageBookRepository implements BookRepository {
  private readonly key: string;
  private readonly storage: Storage | undefined;

  constructor(key = STORAGE_KEY) {
    this.key = key;
    this.storage =
      typeof window !== "undefined" ? window.localStorage : undefined;
  }

  load(): Book[] {
    if (!this.storage) return [];
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isBookList(parsed)) return [];
      return parsed.map(sanitizeBook);
    } catch {
      // Malformed stored data: discard rather than crash.
      return [];
    }
  }

  save(books: Book[]): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(books));
    } catch {
      // Quota or privacy-mode failure: ignore so the UI keeps working this session.
    }
  }
}

/** In-memory repository for tests where localStorage is undesirable. */
export class InMemoryBookRepository implements BookRepository {
  private store: Book[] = [];
  load(): Book[] {
    return this.store.map((b) => ({ ...b }));
  }
  save(books: Book[]): void {
    this.store = books.map((b) => ({ ...b }));
  }
}

function isBookList(value: unknown): value is Array<Partial<Book> & Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isBook(item));
}

function isBook(value: unknown): value is Partial<Book> & Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.author === "string" &&
    typeof b.category === "string"
  );
}

/** Coerce a possibly-stale object into a valid Book with safe defaults. */
function sanitizeBook(b: Partial<Book> & Record<string, unknown>): Book {
  return {
    id: String(b.id),
    title: String(b.title),
    author: String(b.author),
    category: String(b.category),
    // Older data may have null/undefined/number here; coerce to a string.
    borrower: typeof b.borrower === "string" ? b.borrower : "",
  };
}

/** Simple unique-ish id generator. Good enough for a single-user local app. */
export function newId(): BookId {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
