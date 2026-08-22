// Application service: the only place mutable book operations live.
// Components call this; it composes validation, domain logic, and persistence.

import {
  type Book,
  type BookFilter,
  type NewBookInput,
  countLentOut,
  filterBooks,
  isLentOut,
  makeId,
  normalizeName,
  validateBookInput,
} from "../domain/book.js";
import { type BookRepository } from "../storage/bookRepository.js";

export interface BookService {
  listAll(): Book[];
  listFiltered(filter: BookFilter): Book[];
  lendCount(): number;
  addBook(input: NewBookInput): { ok: true; book: Book } | { ok: false; errors: Record<string, string> };
  updateBook(id: string, input: NewBookInput): { ok: true; book: Book } | { ok: false; errors: Record<string, string> };
  deleteBook(id: string): void;
  lendBook(id: string, borrower: string): { ok: true } | { ok: false; error: string };
  returnBook(id: string): void;
}

export function createBookService(repo: BookRepository): BookService {
  function withBooks<T>(fn: (books: Book[]) => T): T {
    const books = repo.loadAll();
    return fn(books);
  }

  return {
    listAll: () => repo.loadAll(),
    listFiltered: (filter) => withBooks((books) => filterBooks(books, filter)),
    lendCount: () => withBooks((books) => countLentOut(books)),

    addBook(input) {
      const result = validateBookInput(input);
      if (!result.ok) return { ok: false, errors: result.errors };
      const books = repo.loadAll();
      const book: Book = {
        id: makeId(),
        title: normalizeName(input.title),
        author: normalizeName(input.author),
        category: input.category,
        borrower: "",
      };
      books.push(book);
      repo.save(books);
      return { ok: true, book };
    },

    updateBook(id, input) {
      const result = validateBookInput(input);
      if (!result.ok) return { ok: false, errors: result.errors };
      const books = repo.loadAll();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return { ok: false, errors: { form: "That book no longer exists." } };
      const existing = books[idx];
      books[idx] = {
        ...existing,
        title: normalizeName(input.title),
        author: normalizeName(input.author),
        category: input.category,
      };
      repo.save(books);
      return { ok: true, book: books[idx] };
    },

    deleteBook(id) {
      const books = repo.loadAll();
      repo.save(books.filter((b) => b.id !== id));
    },

    lendBook(id, borrower) {
      const name = normalizeName(borrower);
      if (!name) return { ok: false, error: "Enter a borrower's name." };
      if (name.length > 120) return { ok: false, error: "Borrower name is too long." };
      const books = repo.loadAll();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return { ok: false, error: "That book no longer exists." };
      if (isLentOut(books[idx])) {
        return { ok: false, error: `${books[idx].title} is already out with ${books[idx].borrower}.` };
      }
      books[idx] = { ...books[idx], borrower: name };
      repo.save(books);
      return { ok: true };
    },

    returnBook(id) {
      const books = repo.loadAll();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return;
      if (!isLentOut(books[idx])) return; // idempotent: already home
      books[idx] = { ...books[idx], borrower: "" };
      repo.save(books);
    },
  };
}
