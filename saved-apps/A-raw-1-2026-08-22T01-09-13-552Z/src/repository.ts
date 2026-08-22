import type { Book, NewBookInput } from "./types";
import { createBook, lendBook, returnBook, updateBook, sanitizeBook } from "./domain";

const STORAGE_KEY = "book-tracker.books.v1";

export interface BookRepository {
  list(): Book[];
  add(input: NewBookInput): Book;
  remove(id: string): void;
  edit(id: string, changes: NewBookInput): Book;
  lend(id: string, borrower: string): Book;
  returnBook(id: string): Book;
}

export function createBookRepository(
  store: Storage,
  onStoreError: (err: Error) => void = () => {},
): BookRepository {
  function read(): Book[] {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitizeBook)
        .filter((b): b is Book => b !== null);
    } catch (err) {
      onStoreError(err instanceof Error ? err : new Error(String(err)));
      return [];
    }
  }

  function write(books: Book[]): void {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch (err) {
      onStoreError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return {
    list() {
      return read();
    },
    add(input) {
      const books = read();
      const book = createBook(input);
      write([...books, book]);
      return book;
    },
    remove(id) {
      const books = read().filter((b) => b.id !== id);
      write(books);
    },
    edit(id, changes) {
      const books = read();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error("Book not found");
      const updated = updateBook(books[idx], changes);
      const next = [...books];
      next[idx] = updated;
      write(next);
      return updated;
    },
    lend(id, borrower) {
      const books = read();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error("Book not found");
      const updated = lendBook(books[idx], borrower);
      const next = [...books];
      next[idx] = updated;
      write(next);
      return updated;
    },
    returnBook(id) {
      const books = read();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error("Book not found");
      const updated = returnBook(books[idx]);
      const next = [...books];
      next[idx] = updated;
      write(next);
      return updated;
    },
  };
}
