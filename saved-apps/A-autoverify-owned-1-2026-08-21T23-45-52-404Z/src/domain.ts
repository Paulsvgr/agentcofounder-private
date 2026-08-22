// Domain layer: pure types and logic with no UI or storage dependencies.

export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Poetry"
  | "Children's"
  | "Other";

export const BOOK_CATEGORIES: readonly BookCategory[] = [
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
  borrower: string | null;
}

export interface BookInput {
  title: string;
  author: string;
  category: BookCategory;
}

export function isBookCategory(value: unknown): value is BookCategory {
  return (
    typeof value === "string" &&
    (BOOK_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Trim a string and return null when empty so borrower can be normalized. */
function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export type FieldErrors = Partial<Record<"title" | "author", string>>;

export function validateBookInput(input: {
  title: string;
  author: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (normalize(input.title) === null) {
    errors.title = "Title is required.";
  }
  if (normalize(input.author) === null) {
    errors.author = "Author is required.";
  }
  return errors;
}

/** Canonical form of a book record after normalization; rejects malformed data. */
export function normalizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const author = typeof r.author === "string" ? r.author.trim() : "";
  const category = isBookCategory(r.category) ? r.category : null;
  const borrowerRaw = r.borrower;
  const borrower =
    typeof borrowerRaw === "string" && borrowerRaw.trim().length > 0
      ? borrowerRaw.trim()
      : null;

  if (!id || !title || !author || !category) return null;
  return { id, title, author, category, borrower };
}

export function normalizeBorrowerName(value: string): string | null {
  return normalize(value);
}

export function isLentOut(book: Book): boolean {
  return book.borrower !== null;
}

export function countLentOut(books: readonly Book[]): number {
  return books.reduce((n, b) => (isLentOut(b) ? n + 1 : n), 0);
}

/** Stable key used to detect likely duplicates while typing. */
export function bookKey(input: { title: string; author: string }): string {
  return `${input.title.trim().toLowerCase()}::${input.author.trim().toLowerCase()}`;
}

export function isLikelyDuplicate(
  candidate: { title: string; author: string },
  existing: readonly Book[],
  ignoreId?: string,
): boolean {
  const key = bookKey(candidate);
  return existing.some((b) => b.id !== ignoreId && bookKey(b) === key);
}
