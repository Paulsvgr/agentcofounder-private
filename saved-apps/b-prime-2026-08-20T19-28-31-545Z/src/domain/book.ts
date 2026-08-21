// Pure domain logic for the personal bookshelf. No UI, no storage.

export const CATEGORIES = [
  "Novel",
  "Cookbook",
  "Reference",
  "Non-fiction",
  "Poetry",
  "Children's",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: Category;
  /** Name of the borrower, or null when the book is on the shelf. */
  borrower: string | null;
}

export interface BookInput {
  title: string;
  author: string;
  category: Category;
}

export type ValidationErrors = Partial<Record<keyof BookInput, string>>;

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/** Coerce an unknown persisted value into a Category, defaulting to "Other". */
export function coerceCategory(value: unknown): Category {
  return isCategory(value) ? value : "Other";
}

/** Validate raw user input for a book. Returns an empty object when valid. */
export function validateBookInput(input: {
  title: string;
  author: string;
  category: unknown;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  if (input.title.trim() === "") {
    errors.title = "Title is required";
  }
  if (input.author.trim() === "") {
    errors.author = "Author is required";
  }
  if (!isCategory(input.category)) {
    errors.category = "Choose a kind of book";
  }
  return errors;
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `book_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBook(input: BookInput): Book {
  return {
    id: makeId(),
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    borrower: null,
  };
}

/** Return a new book with updated details. The borrow state is preserved. */
export function updateBook(book: Book, input: BookInput): Book {
  return {
    ...book,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
  };
}

/** Mark a book as lent out to someone. Throws if the name is blank. */
export function lendBook(book: Book, borrowerName: string): Book {
  const name = borrowerName.trim();
  if (name === "") {
    throw new Error("Borrower name is required");
  }
  return { ...book, borrower: name };
}

/** Clear the borrower so the book is back on the shelf. */
export function returnBook(book: Book): Book {
  return { ...book, borrower: null };
}

export function isLentOut(book: Book): boolean {
  return book.borrower !== null;
}

/** Count how many books in the collection are currently lent out. */
export function countLentOut(books: Book[]): number {
  return books.filter(isLentOut).length;
}
