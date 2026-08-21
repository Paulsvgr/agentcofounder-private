// Pure domain logic for the home library. No storage, no UI.

export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Other";

export const BOOK_CATEGORIES: readonly BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  /** null means the book is at home; a name means it is lent out. */
  borrower: string | null;
}

export interface BookInput {
  title: string;
  author: string;
  category: BookCategory;
}

export interface ValidationError {
  field: keyof BookInput;
  message: string;
}

const CATEGORY_VALUES = new Set<string>(BOOK_CATEGORIES);

export function isBookCategory(value: unknown): value is BookCategory {
  return typeof value === "string" && CATEGORY_VALUES.has(value);
}

function trim(value: string): string {
  return value.trim();
}

/** Validate raw input, returning a map of field -> error message (empty if valid). */
export function validateBookInput(input: {
  title: string;
  author: string;
  category: unknown;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  const title = trim(input.title ?? "");
  if (title.length === 0) {
    errors.push({ field: "title", message: "Title is required" });
  } else if (title.length > 200) {
    errors.push({ field: "title", message: "Title must be 200 characters or fewer" });
  }

  const author = trim(input.author ?? "");
  if (author.length === 0) {
    errors.push({ field: "author", message: "Author is required" });
  } else if (author.length > 120) {
    errors.push({ field: "author", message: "Author must be 120 characters or fewer" });
  }

  if (!isBookCategory(input.category)) {
    errors.push({ field: "category", message: "Choose a valid category" });
  }

  return errors;
}

export function normalizeBookInput(input: {
  title: string;
  author: string;
  category: BookCategory;
}): BookInput {
  return {
    title: trim(input.title),
    author: trim(input.author),
    category: input.category,
  };
}

/** Create a new Book from validated input with a fresh id. */
export function createBook(input: BookInput, id: string): Book {
  return {
    id,
    title: input.title,
    author: input.author,
    category: input.category,
    borrower: null,
  };
}

/** Apply edits to a book, returning a new book object. */
export function editBook(book: Book, input: BookInput): Book {
  return { ...book, ...input };
}

/** Lend a book to someone; empty/whitespace borrower is rejected. */
export function lendBook(book: Book, borrower: string): Book {
  const name = trim(borrower ?? "");
  if (name.length === 0) return book;
  if (name.length > 120) return book;
  return { ...book, borrower: name };
}

/** Return a lent book home. */
export function returnBook(book: Book): Book {
  if (book.borrower === null) return book;
  return { ...book, borrower: null };
}

export function isLentOut(book: Book): boolean {
  return book.borrower !== null && book.borrower.length > 0;
}

/** Count how many books are currently lent out. */
export function countLentOut(books: readonly Book[]): number {
  return books.filter(isLentOut).length;
}

/** Narrow the collection to books currently out with someone. */
export function lentOutBooks(books: readonly Book[]): Book[] {
  return books.filter(isLentOut);
}

export function firstError(
  errors: ValidationError[],
): ValidationError | undefined {
  return errors[0];
}
