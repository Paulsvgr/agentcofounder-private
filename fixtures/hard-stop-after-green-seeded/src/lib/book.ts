export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Poetry"
  | "History"
  | "Science"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "Poetry",
  "History",
  "Science",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrowedBy: string | null;
}

function isBookCategory(value: unknown): value is BookCategory {
  return typeof value === "string" && BOOK_CATEGORIES.includes(value as BookCategory);
}

/**
 * Parse one stored array entry into a validated Book, or null if invalid.
 * Used by the collection store so corrupted entries are silently dropped
 * rather than crashing the whole app.
 */
export function parseBook(raw: unknown): Book | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : null;
  const title = typeof obj.title === "string" ? obj.title.trim() : null;
  const author = typeof obj.author === "string" ? obj.author.trim() : null;
  const category = isBookCategory(obj.category) ? obj.category : null;
  if (!id || !title || !author || !category) return null;
  const borrowedBy =
    typeof obj.borrowedBy === "string" && obj.borrowedBy.trim() !== ""
      ? obj.borrowedBy.trim()
      : null;
  return { id, title, author, category, borrowedBy };
}
