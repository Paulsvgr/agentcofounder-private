import type { Book, NewBookInput, BookCategory } from "../types";
import {
  createBook,
  lendBook,
  returnBook,
  updateBook,
  hasDuplicate,
  validateNewBook,
  validateBorrower,
} from "../domain/book";
import { generateId } from "../data/bookRepository";

export interface BookService {
  getAll(): Book[];
  add(input: NewBookInput): { ok: true; book: Book } | { ok: false; error: string };
  edit(
    id: string,
    changes: { title: string; author: string; category: BookCategory },
  ): { ok: true } | { ok: false; error: string };
  remove(id: string): { ok: true } | { ok: false; error: string };
  lend(id: string, borrower: string): { ok: true } | { ok: false; error: string };
  returnLent(id: string): { ok: true } | { ok: false; error: string };
}

export function createBookService(
  initial: Book[],
): BookService & { getBooks(): Book[] } {
  let books = [...initial];

  function getBooks(): Book[] {
    return [...books];
  }

  function getAll(): Book[] {
    return getBooks();
  }

  return {
    getAll,
    getBooks,
    add(input) {
      const error = validateNewBook(input);
      if (error) return { ok: false, error };
      if (hasDuplicate(books, input))
        return { ok: false, error: "That book is already on your shelf." };
      const book = createBook(input, generateId());
      books = [...books, book];
      return { ok: true, book };
    },
    edit(id, changes) {
      const error = validateNewBook(changes);
      if (error) return { ok: false, error };
      const input: NewBookInput = {
        title: changes.title,
        author: changes.author,
        category: changes.category,
      };
      if (hasDuplicate(books, input, id))
        return { ok: false, error: "That book is already on your shelf." };
      let found = false;
      books = books.map((b) => {
        if (b.id === id) {
          found = true;
          return updateBook(b, changes);
        }
        return b;
      });
      if (!found) return { ok: false, error: "Book not found." };
      return { ok: true };
    },
    remove(id) {
      const before = books.length;
      books = books.filter((b) => b.id !== id);
      if (books.length === before)
        return { ok: false, error: "Book not found." };
      return { ok: true };
    },
    lend(id, borrower) {
      const error = validateBorrower(borrower);
      if (error) return { ok: false, error };
      let found = false;
      books = books.map((b) => {
        if (b.id === id) {
          found = true;
          return lendBook(b, borrower.trim());
        }
        return b;
      });
      if (!found) return { ok: false, error: "Book not found." };
      return { ok: true };
    },
    returnLent(id) {
      let found = false;
      books = books.map((b) => {
        if (b.id === id) {
          found = true;
          return returnBook(b);
        }
        return b;
      });
      if (!found) return { ok: false, error: "Book not found." };
      return { ok: true };
    },
  };
}

/**
 * Thin wrapper that keeps a service and a repository in sync, persisting
 * after every mutation so the UI can stay stateless about storage.
 */
export function createPersistentBookService(
  initial: Book[],
  save: (books: Book[]) => void,
): BookService {
  const service = createBookService(initial);
  const persist = () => save(service.getBooks());
  return {
    getAll: service.getAll,
    add(input) {
      const result = service.add(input);
      if (result.ok) persist();
      return result;
    },
    edit(id, changes) {
      const result = service.edit(id, changes);
      if (result.ok) persist();
      return result;
    },
    remove(id) {
      const result = service.remove(id);
      if (result.ok) persist();
      return result;
    },
    lend(id, borrower) {
      const result = service.lend(id, borrower);
      if (result.ok) persist();
      return result;
    },
    returnLent(id) {
      const result = service.returnLent(id);
      if (result.ok) persist();
      return result;
    },
  };
}
