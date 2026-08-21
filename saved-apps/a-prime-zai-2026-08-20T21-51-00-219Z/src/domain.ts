import type { Book, BookCategory, BookFilter, BookRow } from "./types";

export const STORAGE_KEY = "book-shelf/v1";

export function isBookCategory(value: unknown): value is BookCategory {
  return typeof value === "string" && value.length > 0 && value.length <= 40;
}

/** Validate the raw shape coming out of localStorage; drops malformed entries. */
export function sanitizeBooks(raw: unknown): Book[] {
  if (!Array.isArray(raw)) return [];
  const books: Book[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : crypto.randomUUID();
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const author = typeof e.author === "string" ? e.author.trim() : "";
    const category = isBookCategory(e.category) ? e.category : "Other";
    const borrower =
      typeof e.borrower === "string" && e.borrower.trim().length > 0
        ? e.borrower.trim()
        : null;
    if (!title || !author) continue;
    books.push({ id, title, author, category, borrower });
  }
  return books;
}

export function createBook(
  title: string,
  author: string,
  category: BookCategory,
): Book {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    author: author.trim(),
    category,
    borrower: null,
  };
}

export function lendBook(book: Book, borrower: string): Book {
  return { ...book, borrower: borrower.trim() };
}

export function returnBook(book: Book): Book {
  return { ...book, borrower: null };
}

export function isOut(book: Book): boolean {
  return book.borrower !== null && book.borrower.length > 0;
}

export function toRow(book: Book): BookRow {
  return { ...book, status: isOut(book) ? "out" : "in" };
}

export function applyFilter(books: Book[], filter: BookFilter): Book[] {
  if (filter === "out") return books.filter(isOut);
  return books;
}

export function countOut(books: Book[]): number {
  return books.filter(isOut).length;
}

export function validateBookInput(title: string, author: string): string | null {
  if (!title.trim()) return "Title is required.";
  if (!author.trim()) return "Author is required.";
  if (title.trim().length > 200) return "Title is too long (max 200 characters).";
  if (author.trim().length > 120) return "Author name is too long (max 120 characters).";
  return null;
}

export function validateBorrower(name: string): string | null {
  if (!name.trim()) return "Borrower name is required.";
  if (name.trim().length > 120) return "Borrower name is too long (max 120 characters).";
  return null;
}
