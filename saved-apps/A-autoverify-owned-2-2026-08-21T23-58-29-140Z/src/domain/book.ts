// Domain types and pure logic for the personal bookshelf.
// Kept free of React and storage concerns so the same logic
// can be reused by any client or persistence layer.

export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Poetry"
  | "Children's"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "Poetry",
  "Children's",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  // When non-empty, the book is currently lent out to this borrower.
  borrower: string;
}

export interface NewBookInput {
  title: string;
  author: string;
  category: BookCategory;
}

/** Trim to a normalized single-line value; empty string means "not set". */
export function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isCategory(value: unknown): value is BookCategory {
  return typeof value === "string" && (BOOK_CATEGORIES as string[]).includes(value);
}

/** Validate the fields a user supplies when adding/editing a book. */
export function validateBookInput(input: {
  title: string;
  author: string;
  category: BookCategory;
}): { ok: true } | { ok: false; errors: Partial<Record<"title" | "author" | "category", string>> } {
  const errors: { title?: string; author?: string; category?: string } = {};
  const title = normalizeName(input.title);
  const author = normalizeName(input.author);

  if (!title) errors.title = "Title is required.";
  if (title.length > 200) errors.title = "Title must be 200 characters or fewer.";
  if (!author) errors.author = "Author is required.";
  if (author.length > 120) errors.author = "Author must be 120 characters or fewer.";
  if (!isCategory(input.category)) errors.category = "Pick a category.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}

export function isLentOut(book: Book): boolean {
  return normalizeName(book.borrower).length > 0;
}

/** Repair a possibly-malformed persisted record into a usable Book, or null if unrecoverable. */
export function repairBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return null;
  if (typeof r.title !== "string" || normalizeName(r.title).length === 0) return null;
  if (typeof r.author !== "string" || normalizeName(r.author).length === 0) return null;
  if (!isCategory(r.category)) return null;
  const borrower = typeof r.borrower === "string" ? r.borrower : "";
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    category: r.category,
    borrower: borrower,
  };
}

export function repairBooks(raw: unknown): Book[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => repairBook(item))
    .filter((b): b is Book => b !== null);
}

export function makeId(): string {
  // Avoid depending on crypto.randomUUID availability in older test DOMs.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type BookFilter = "all" | "out";

export function filterBooks(books: Book[], filter: BookFilter): Book[] {
  if (filter === "out") return books.filter(isLentOut);
  return books;
}

export function countLentOut(books: Book[]): number {
  return books.reduce((n, b) => (isLentOut(b) ? n + 1 : n), 0);
}
