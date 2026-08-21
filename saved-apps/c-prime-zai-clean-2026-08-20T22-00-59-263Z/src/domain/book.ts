// Pure domain logic for the home library. No storage, no UI.

export type BookCategory = "novel" | "cookbook" | "reference" | "other";

export const BOOK_CATEGORIES: { value: BookCategory; label: string }[] = [
  { value: "novel", label: "Novel" },
  { value: "cookbook", label: "Cookbook" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABELS: Record<BookCategory, string> = {
  novel: "Novel",
  cookbook: "Cookbook",
  reference: "Reference",
  other: "Other",
};

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrowerName: string | null;
  lentOn: string | null; // ISO date (YYYY-MM-DD)
}

export interface BookInput {
  title: string;
  author: string;
  category: BookCategory;
}

export type BookValidationError =
  | { field: "title"; reason: "empty" }
  | { field: "author"; reason: "empty" }
  | { field: "category"; reason: "invalid" };

export function validateBookInput(input: {
  title: string;
  author: string;
  category: string;
}): BookValidationError[] {
  const errors: BookValidationError[] = [];
  if (!input.title.trim()) errors.push({ field: "title", reason: "empty" });
  if (!input.author.trim()) errors.push({ field: "author", reason: "empty" });
  if (!isBookCategory(input.category))
    errors.push({ field: "category", reason: "invalid" });
  return errors;
}

export function isBookCategory(value: string): value is BookCategory {
  return (
    value === "novel" ||
    value === "cookbook" ||
    value === "reference" ||
    value === "other"
  );
}

export function createBook(
  id: string,
  input: BookInput,
  now: Date = new Date(),
): Book {
  return {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    borrowerName: null,
    lentOn: null,
  };
}

export function isLentOut(book: Book): boolean {
  return book.borrowerName !== null && book.borrowerName.trim() !== "";
}

export function lentOutCount(books: Book[]): number {
  return books.filter(isLentOut).length;
}

export interface LentValidationError {
  field: "borrowerName";
  reason: "empty";
}

export function validateLending(borrowerName: string): LentValidationError[] {
  if (!borrowerName.trim()) return [{ field: "borrowerName", reason: "empty" }];
  return [];
}

export function lendBook(
  book: Book,
  borrowerName: string,
  now: Date = new Date(),
): Book {
  return {
    ...book,
    borrowerName: borrowerName.trim(),
    lentOn: toIsoDate(now),
  };
}

export function returnBook(book: Book): Book {
  return { ...book, borrowerName: null, lentOn: null };
}

export function updateBook(
  book: Book,
  changes: Partial<BookInput>,
): Book {
  return {
    ...book,
    title: changes.title !== undefined ? changes.title.trim() : book.title,
    author:
      changes.author !== undefined ? changes.author.trim() : book.author,
    category: changes.category !== undefined ? changes.category : book.category,
  };
}

// Generate a stable-ish unique id without external deps.
export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalise/repair a raw value loaded from storage into a valid Book, or null if unrecoverable. */
export function normalizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const title = typeof r.title === "string" ? r.title : "";
  const author = typeof r.author === "string" ? r.author : "";
  const category = typeof r.category === "string" ? r.category : "";
  if (!id || !title || !author || !isBookCategory(category)) return null;
  const borrowerName =
    typeof r.borrowerName === "string" && r.borrowerName.trim() !== ""
      ? r.borrowerName
      : null;
  const lentOn =
    typeof r.lentOn === "string" && r.lentOn.trim() !== "" ? r.lentOn : null;
  return { id, title, author, category, borrowerName, lentOn };
}
