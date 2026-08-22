import type { Book, BookKind, NewBookInput } from "./types";
import { BOOK_KINDS } from "./types";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isBookKind(value: unknown): value is BookKind {
  return typeof value === "string" && (BOOK_KINDS as string[]).includes(value);
}

function trim(value: string): string {
  return value.trim();
}

export function validateBookInput(input: NewBookInput): Partial<Record<keyof NewBookInput, string>> {
  const errors: Partial<Record<keyof NewBookInput, string>> = {};
  if (trim(input.title) === "") errors.title = "Title is required";
  if (trim(input.author) === "") errors.author = "Author is required";
  if (!isBookKind(input.kind)) errors.kind = "Select a valid kind";
  return errors;
}

export function createBook(input: NewBookInput): Book {
  const errors = validateBookInput(input);
  if (Object.keys(errors).length > 0) {
    throw new Error(errors.title ?? errors.author ?? errors.kind ?? "Invalid book");
  }
  return {
    id: createId(),
    title: trim(input.title),
    author: trim(input.author),
    kind: input.kind,
    borrower: null,
  };
}

export function lendBook(book: Book, borrowerName: string): Book {
  const name = trim(borrowerName);
  if (name === "") throw new Error("Borrower name is required");
  if (book.borrower !== null) throw new Error("That book is already lent out");
  return { ...book, borrower: name };
}

export function returnBook(book: Book): Book {
  if (book.borrower === null) return book;
  return { ...book, borrower: null };
}

export function updateBook(book: Book, changes: NewBookInput): Book {
  const errors = validateBookInput(changes);
  if (Object.keys(errors).length > 0) {
    throw new Error(errors.title ?? errors.author ?? errors.kind ?? "Invalid book");
  }
  return {
    ...book,
    title: trim(changes.title),
    author: trim(changes.author),
    kind: changes.kind,
  };
}

export function isLentOut(book: Book): boolean {
  return book.borrower !== null && book.borrower !== "";
}

export function countLentOut(books: Book[]): number {
  return books.filter(isLentOut).length;
}

export function sanitizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() !== "" ? r.id : createId();
  const title = typeof r.title === "string" ? r.title : "";
  const author = typeof r.author === "string" ? r.author : "";
  const kind = isBookKind(r.kind) ? r.kind : "Other";
  const borrower =
    typeof r.borrower === "string" && r.borrower.trim() !== "" ? r.borrower.trim() : null;
  return { id, title, author, kind, borrower };
}
