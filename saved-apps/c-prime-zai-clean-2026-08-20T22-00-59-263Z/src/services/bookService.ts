// Application service: bridges UI and persistence + domain logic.
import {
  type Book,
  type BookCategory,
  type BookInput,
  type BookValidationError,
  type LentValidationError,
  createBook,
  lendBook,
  returnBook,
  updateBook,
  validateBookInput,
  validateLending,
} from "../domain/book.js";
import { type BookRepository, newId } from "../infrastructure/bookRepository.js";

export interface BookService {
  list(): Book[];
  add(input: BookInput): { book?: Book; errors: BookValidationError[] };
  edit(id: string, changes: Partial<BookInput>): {
    book?: Book;
    errors: BookValidationError[];
  };
  remove(id: string): void;
  lend(id: string, borrowerName: string): {
    book?: Book;
    errors: LentValidationError[];
  };
  returnBook(id: string): void;
}

export function createBookService(repo: BookRepository): BookService {
  return {
    list() {
      return repo.loadAll();
    },
    add(input: BookInput): { book?: Book; errors: BookValidationError[] } {
      const errors = validateBookInput(input);
      if (errors.length > 0) return { errors };
      const books = repo.loadAll();
      const book = createBook(newId(), input);
      repo.saveAll([...books, book]);
      return { book, errors: [] };
    },
    edit(id: string, changes: Partial<BookInput>) {
      const errors = validateBookInput({
        title: changes.title ?? "",
        author: changes.author ?? "",
        category: changes.category ?? "other",
      });
      if (errors.length > 0) return { errors };
      const books = repo.loadAll();
      const next = books.map((b) =>
        b.id === id ? updateBook(b, changes) : b,
      );
      repo.saveAll(next);
      return { book: next.find((b) => b.id === id), errors: [] };
    },
    remove(id: string): void {
      const books = repo.loadAll();
      repo.saveAll(books.filter((b) => b.id !== id));
    },
    lend(id: string, borrowerName: string) {
      const errors = validateLending(borrowerName);
      if (errors.length > 0) return { errors };
      const books = repo.loadAll();
      const next = books.map((b) =>
        b.id === id ? lendBook(b, borrowerName) : b,
      );
      repo.saveAll(next);
      return { book: next.find((b) => b.id === id), errors: [] };
    },
    returnBook(id: string): void {
      const books = repo.loadAll();
      const next = books.map((b) => (b.id === id ? returnBook(b) : b));
      repo.saveAll(next);
    },
  };
}

export type { Book, BookCategory, BookInput };
