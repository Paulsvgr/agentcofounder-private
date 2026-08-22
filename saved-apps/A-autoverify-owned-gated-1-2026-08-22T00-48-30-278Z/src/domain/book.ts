import type { Book, NewBookInput, BookCategory } from "../types";
import { BOOK_CATEGORIES } from "../types";

export function isBookCategory(value: unknown): value is BookCategory {
  return (
    typeof value === "string" &&
    (BOOK_CATEGORIES as string[]).includes(value)
  );
}

export function isBook(value: unknown): value is Book {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.author === "string" &&
    isBookCategory(b.category) &&
    (b.borrower === null || typeof b.borrower === "string")
  );
}

export function createBook(input: NewBookInput, id: string): Book {
  return {
    id,
    title: input.title,
    author: input.author,
    category: input.category,
    borrower: null,
  };
}

export function lendBook(book: Book, borrower: string): Book {
  return { ...book, borrower: borrower };
}

export function returnBook(book: Book): Book {
  return { ...book, borrower: null };
}

export function updateBook(
  book: Book,
  changes: { title?: string; author?: string; category?: BookCategory },
): Book {
  return { ...book, ...changes };
}

export function isLent(book: Book): boolean {
  return book.borrower !== null && book.borrower.trim() !== "";
}

export function filterBooks(books: Book[], filter: "all" | "lent"): Book[] {
  if (filter === "lent") return books.filter(isLent);
  return books;
}

export function countLent(books: Book[]): number {
  return books.filter(isLent).length;
}

export function hasDuplicate(
  books: Book[],
  input: NewBookInput,
  excludeId?: string,
): boolean {
  return books.some(
    (b) =>
      b.id !== excludeId &&
      b.title.trim().toLowerCase() === input.title.trim().toLowerCase() &&
      b.author.trim().toLowerCase() === input.author.trim().toLowerCase(),
  );
}

export function validateNewBook(input: {
  title: string;
  author: string;
  category: string;
}): string | null {
  if (input.title.trim() === "") return "Title is required";
  if (input.author.trim() === "") return "Author is required";
  if (!isBookCategory(input.category)) return "Please choose a valid category";
  return null;
}

export function validateBorrower(name: string): string | null {
  if (name.trim() === "") return "Borrower name is required";
  return null;
}
