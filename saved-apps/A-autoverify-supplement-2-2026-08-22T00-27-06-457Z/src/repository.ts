import type { Book, BookDraft } from "./types";

export interface BookRepository {
  list(): Book[];
  add(draft: BookDraft): Book;
  update(id: string, draft: BookDraft): void;
  remove(id: string): void;
  lend(id: string, borrower: string): void;
  returnBook(id: string): void;
}

export function isLentOut(book: Book): boolean {
  return book.borrower.trim().length > 0;
}

export function createId(): string {
  // Prefer the platform-provided id when available; fall back to a robust
  // random string for environments without crypto.randomUUID.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
