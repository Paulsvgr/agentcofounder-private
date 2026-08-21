import type { Book, BookInput } from "./types.js";
import type { BookRepository } from "./repository.js";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Domain operations on the bookshelf. Keeps mutation logic out of the UI so
 * persistence or another client can be swapped without rewriting components.
 */
export class Bookshelf {
  constructor(private repo: BookRepository) {}

  list(): Book[] {
    return this.repo.loadAll();
  }

  add(input: BookInput): Book {
    const book: Book = {
      id: createId(),
      title: input.title,
      author: input.author,
      category: input.category,
      borrower: null,
    };
    const books = this.list();
    books.push(book);
    this.repo.saveAll(books);
    return book;
  }

  update(id: string, input: BookInput): Book | null {
    const books = this.list();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    books[idx] = { ...books[idx], ...input };
    this.repo.saveAll(books);
    return books[idx];
  }

  remove(id: string): boolean {
    const books = this.list();
    const next = books.filter((b) => b.id !== id);
    const changed = next.length !== books.length;
    if (changed) this.repo.saveAll(next);
    return changed;
  }

  lend(id: string, borrower: string): Book | null {
    const books = this.list();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    books[idx] = { ...books[idx], borrower };
    this.repo.saveAll(books);
    return books[idx];
  }

  returnBook(id: string): Book | null {
    const books = this.list();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    books[idx] = { ...books[idx], borrower: null };
    this.repo.saveAll(books);
    return books[idx];
  }

  lentCount(): number {
    return this.list().filter((b) => b.borrower !== null).length;
  }
}
