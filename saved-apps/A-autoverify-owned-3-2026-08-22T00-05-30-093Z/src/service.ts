import type { Book, BookInput } from "./types.js";
import type { BookRepository } from "./repository.js";

let counter = 0;
function createId(): string {
  counter += 1;
  return (
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `book-${Date.now()}-${counter}`)
  );
}

export function createBookService(repo: BookRepository) {
  return {
    list(): Book[] {
      return repo.load();
    },
    add(input: BookInput): Book {
      const book: Book = {
        id: createId(),
        title: input.title.trim(),
        author: input.author.trim(),
        category: input.category,
        borrower: null,
      };
      const books = [...repo.load(), book];
      repo.save(books);
      return book;
    },
    update(id: string, input: BookInput): void {
      const books = repo.load();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return;
      books[idx] = {
        ...books[idx],
        title: input.title.trim(),
        author: input.author.trim(),
        category: input.category,
      };
      repo.save(books);
    },
    remove(id: string): void {
      const books = repo.load().filter((b) => b.id !== id);
      repo.save(books);
    },
    lend(id: string, borrower: string): void {
      const name = borrower.trim();
      if (!name) return;
      const books = repo.load();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return;
      books[idx] = { ...books[idx], borrower: name };
      repo.save(books);
    },
    returnBook(id: string): void {
      const books = repo.load();
      const idx = books.findIndex((b) => b.id === id);
      if (idx === -1) return;
      books[idx] = { ...books[idx], borrower: null };
      repo.save(books);
    },
  };
}

export type BookService = ReturnType<typeof createBookService>;
