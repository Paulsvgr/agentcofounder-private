import type { Book, BookDraft, BookId } from "./types.js";

/**
 * Pure domain operations for the book collection. No persistence or UI concerns.
 * Each function returns a new array; nothing is mutated in place.
 */

export function addBook(books: Book[], draft: BookDraft, id: BookId): Book[] {
  return [...books, toBook(draft, id)];
}

export function updateBook(
  books: Book[],
  id: BookId,
  draft: BookDraft,
): Book[] {
  return books.map((book) =>
    book.id === id ? { ...book, ...normalize(draft) } : book,
  );
}

export function deleteBook(books: Book[], id: BookId): Book[] {
  return books.filter((book) => book.id !== id);
}

/** Set a borrower (lending the book out). An empty/blank borrower returns it home. */
export function lendBook(books: Book[], id: BookId, borrower: string): Book[] {
  const trimmed = borrower.trim();
  return books.map((book) =>
    book.id === id ? { ...book, borrower: trimmed } : book,
  );
}

/** Clear the borrower, marking the book as returned home. */
export function returnBook(books: Book[], id: BookId): Book[] {
  return books.map((book) =>
    book.id === id ? { ...book, borrower: "" } : book,
  );
}

export function toBook(draft: BookDraft, id: BookId): Book {
  return { id, ...normalize(draft), borrower: "" };
}

function normalize(draft: BookDraft): BookDraft {
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    category: draft.category.trim(),
  };
}

/** Validation shared by add and edit. Returns the first field that is invalid, or null. */
export function validateDraft(draft: BookDraft): string | null {
  if (!draft.title.trim()) return "title";
  if (!draft.author.trim()) return "author";
  if (!draft.category.trim()) return "category";
  return null;
}
