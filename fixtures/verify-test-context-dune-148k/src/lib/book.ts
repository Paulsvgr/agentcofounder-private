import { normalizeText } from "./text";

export type BookCategory =
  | "Fiction"
  | "Non-fiction"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Poetry"
  | "Children's"
  | "Other";

export const BOOK_CATEGORIES: readonly BookCategory[] = [
  "Fiction",
  "Non-fiction",
  "Cookbook",
  "Reference",
  "Biography",
  "Poetry",
  "Children's",
  "Other",
] as const;

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrower: string | null;
}

/** Validate and normalise a single persisted book entry. Returns null if invalid. */
export function parseBook(raw: unknown): Book | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" && r.id.length > 0 ? r.id : null;
  const title = typeof r.title === "string" ? normalizeText(r.title) : "";
  const author = typeof r.author === "string" ? normalizeText(r.author) : "";
  const category =
    typeof r.category === "string" && BOOK_CATEGORIES.includes(r.category as BookCategory)
      ? (r.category as BookCategory)
      : null;

  const borrowerRaw = r.borrower;
  const borrower =
    typeof borrowerRaw === "string" && normalizeText(borrowerRaw).length > 0
      ? normalizeText(borrowerRaw)
      : null;

  if (!id || title.length === 0 || author.length === 0 || category === null) return null;

  return { id, title, author, category, borrower };
}

export interface BookInput {
  title: string;
  author: string;
  category: BookCategory;
}

export function makeBookFields(input: BookInput): Omit<Book, "id"> {
  return {
    title: normalizeText(input.title),
    author: normalizeText(input.author),
    category: input.category,
    borrower: null,
  };
}
