// Persistence boundary. The UI never touches localStorage directly so a
// different client or backend could be swapped in without a UI rewrite.
import { Book, isCategory, makeId } from "../domain/book.js";

const STORAGE_KEY = "family-library/books/v1";

/** Load books from storage, recovering as gracefully as possible. */
export function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(deserializeBook)
      .filter((b): b is Book => b !== null);
  } catch {
    // Corrupt JSON or storage that is blocked: start from an empty shelf.
    return [];
  }
}

function deserializeBook(value: unknown): Book | null {
  if (typeof value !== "object" || value === null) return null;
  const rec = value as Record<string, unknown>;
  const id = typeof rec.id === "string" && rec.id ? rec.id : makeId();
  const title = typeof rec.title === "string" ? rec.title : "";
  const author = typeof rec.author === "string" ? rec.author : "";
  const category = isCategory(rec.category) ? rec.category : "Other";
  const borrower =
    typeof rec.borrower === "string" && rec.borrower.trim().length > 0
      ? rec.borrower.trim()
      : null;
  return { id, title, author, category, borrower };
}

/** Persist books to storage, failing silently when storage is unavailable. */
export function saveBooks(books: Book[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // Quota exceeded or storage disabled: app keeps working in-memory.
  }
}

export function clearBooks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const BOOK_STORAGE_KEY = STORAGE_KEY;
