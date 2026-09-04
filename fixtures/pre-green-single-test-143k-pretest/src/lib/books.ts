/**
 * Book lending tracker — domain types, validation, and helpers.
 */

export type BookCategory =
  | "Fiction"
  | "Non-fiction"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Children's"
  | "Poetry"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Fiction",
  "Non-fiction",
  "Cookbook",
  "Reference",
  "Biography",
  "Children's",
  "Poetry",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrower: string; // "" when home
}

export function isBookCategory(value: unknown): value is BookCategory {
  return (
    typeof value === "string" &&
    BOOK_CATEGORIES.includes(value as BookCategory)
  );
}

/**
 * Validate a single persisted array entry into a Book, or return null.
 */
export function parseBook(raw: unknown): Book | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id === "") return null;
  if (typeof obj.title !== "string" || obj.title.trim() === "") return null;
  if (typeof obj.author !== "string" || obj.author.trim() === "") return null;
  if (!isBookCategory(obj.category)) return null;
  if (typeof obj.borrower !== "string") return null;
  return {
    id: obj.id,
    title: obj.title,
    author: obj.author,
    category: obj.category,
    borrower: obj.borrower,
  };
}

/** Collapse whitespace and trim. */
export function cleanText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** A book is "lent out" when it has a non-empty borrower. */
export function isLentOut(book: Book): boolean {
  return book.borrower.trim() !== "";
}

/** Count of books currently lent out. */
export function countLentOut(books: Book[]): number {
  return books.filter(isLentOut).length;
}

/** Books currently lent out, ordered by borrower then title. */
export function lentOutBooks(books: Book[]): Book[] {
  return books
    .filter(isLentOut)
    .sort(byBorrowerThenTitle);
}

/** Books currently at home, ordered by title. */
export function homeBooks(books: Book[]): Book[] {
  return books
    .filter((b) => !isLentOut(b))
    .sort(byTitle);
}

function byTitle(a: Book, b: Book): number {
  return a.title.localeCompare(b.title);
}

function byBorrowerThenTitle(a: Book, b: Book): number {
  const byBorrower = a.borrower.localeCompare(b.borrower);
  if (byBorrower !== 0) return byBorrower;
  return a.title.localeCompare(b.title);
}
