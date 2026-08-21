// Pure domain logic for the home library. No UI, no storage.

export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Children's"
  | "Other";

export const CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "Children's",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  /** null when the book is at home; a trimmed name when it is currently lent out. */
  borrowerName: string | null;
}

export interface BookDraft {
  title: string;
  author: string;
  category: BookCategory;
}

export type FieldErrors = Partial<
  Record<"title" | "author" | "category" | "borrowerName", string>
>;

export type BookStatus = "all" | "lent" | "home";

export function isBookCategory(value: unknown): value is BookCategory {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

export function validateBookDraft(input: {
  title: string;
  author: string;
  category: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.title.trim().length === 0) errors.title = "Title is required";
  if (input.author.trim().length === 0) errors.author = "Author is required";
  if (!isBookCategory(input.category)) errors.category = "Choose a category";
  return errors;
}

export function validateBorrowerName(name: string): FieldErrors {
  const errors: FieldErrors = {};
  if (name.trim().length === 0) errors.borrowerName = "Enter who has the book";
  return errors;
}

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBook(draft: BookDraft): Book {
  return {
    id: makeId(),
    title: draft.title.trim(),
    author: draft.author.trim(),
    category: draft.category,
    borrowerName: null,
  };
}

export function isLent(book: Book): boolean {
  return book.borrowerName !== null && book.borrowerName.trim().length > 0;
}

export function lendBook(book: Book, borrowerName: string): Book {
  const name = borrowerName.trim();
  if (name.length === 0) return book;
  return { ...book, borrowerName: name };
}

export function returnBook(book: Book): Book {
  if (book.borrowerName === null) return book;
  return { ...book, borrowerName: null };
}

export function updateBook(book: Book, draft: BookDraft): Book {
  return {
    ...book,
    title: draft.title.trim(),
    author: draft.author.trim(),
    category: draft.category,
  };
}

export function countLentOut(books: Book[]): number {
  return books.reduce((count, book) => (isLent(book) ? count + 1 : count), 0);
}

export function filterBooks(books: Book[], status: BookStatus): Book[] {
  switch (status) {
    case "lent":
      return books.filter(isLent);
    case "home":
      return books.filter((book) => !isLent(book));
    case "all":
    default:
      return books;
  }
}

/** Rebuild a safe Book from raw persisted data, or null if it cannot be salvaged. */
export function sanitizeBook(raw: unknown): Book | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  if (typeof record.title !== "string" || record.title.trim().length === 0) return null;
  if (typeof record.author !== "string" || record.author.trim().length === 0) return null;
  if (!isBookCategory(record.category)) return null;
  const borrowerName =
    typeof record.borrowerName === "string" && record.borrowerName.trim().length > 0
      ? (record.borrowerName as string).trim()
      : null;
  return {
    id: record.id,
    title: (record.title as string).trim(),
    author: (record.author as string).trim(),
    category: record.category,
    borrowerName,
  };
}

export function sanitizeBookList(raw: unknown): Book[] {
  if (!Array.isArray(raw)) return [];
  const result: Book[] = [];
  for (const item of raw) {
    const book = sanitizeBook(item);
    if (book) result.push(book);
  }
  return result;
}
