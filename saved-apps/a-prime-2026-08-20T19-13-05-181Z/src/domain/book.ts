// Pure domain logic for the home library. No React, no storage, no I/O.
// Keeping types and rules here means the UI and storage layers stay thin.

export const CATEGORIES = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "Poetry",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: Category;
  /** null = on the shelf; a non-empty string = currently lent to that person. */
  borrower: string | null;
}

export interface BookInput {
  title: string;
  author: string;
  category: Category;
}

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}

/** Generate an id resilient to environments without crypto.randomUUID (jsdom). */
export function makeId(): string {
  const g: unknown =
    typeof globalThis !== "undefined" ? (globalThis as Record<string, unknown>).crypto : undefined;
  if (
    typeof g === "object" &&
    g !== null &&
    typeof (g as { randomUUID?: unknown }).randomUUID === "function"
  ) {
    return (g as { randomUUID: () => string }).randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBook(input: BookInput, id: string = makeId()): Book {
  return {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    borrower: null,
  };
}

export function updateBook(book: Book, input: BookInput): Book {
  return {
    ...book,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
  };
}

export function lendBook(book: Book, borrower: string): Book {
  return { ...book, borrower: borrower.trim() };
}

export function returnBook(book: Book): Book {
  return { ...book, borrower: null };
}

export function isLentOut(book: Book): boolean {
  return book.borrower !== null && book.borrower.trim().length > 0;
}

export interface ValidationErrors {
  title?: string;
  author?: string;
  category?: string;
}

export function validateBookInput(input: {
  title: string;
  author: string;
  category: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.title.trim()) errors.title = "Title is required";
  if (!input.author.trim()) errors.author = "Author is required";
  if (!isCategory(input.category)) errors.category = "Choose a category";
  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function validateBorrower(name: string): string | undefined {
  return name.trim() ? undefined : "Enter who is borrowing the book";
}
