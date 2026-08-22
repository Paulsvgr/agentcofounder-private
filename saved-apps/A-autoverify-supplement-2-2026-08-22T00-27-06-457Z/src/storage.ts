import type { Book } from "./types";
import type { BookRepository } from "./repository";
import { createId, isLentOut } from "./repository";

const STORAGE_KEY = "home-library.books.v1";

/**
 * Reads persisted books from localStorage. Returns [] when storage is empty
 * or contains malformed data, so the UI always renders from a valid array.
 * Malformed individual entries are dropped rather than crashing the app.
 */
function loadBooks(): Book[] {
  if (typeof localStorage === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (privacy mode, disabled); degrade to empty.
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const books: Book[] = [];
  for (const entry of parsed) {
    const normalised = normaliseBook(entry);
    if (normalised) books.push(normalised);
  }
  return books;
}

function normaliseBook(entry: unknown): Book | null {
  if (typeof entry !== "object" || entry === null) return null;
  const e = entry as Record<string, unknown>;
  const id = typeof e.id === "string" && e.id ? e.id : createId();
  const title = typeof e.title === "string" ? e.title : "";
  const author = typeof e.author === "string" ? e.author : "";
  const category = typeof e.category === "string" ? e.category : "Other";
  const borrower = typeof e.borrower === "string" ? e.borrower : "";
  // Skip fully-empty entries so corrupted saves do not surface blank rows.
  if (!title.trim() && !author.trim()) return null;
  return { id, title, author, category: category as Book["category"], borrower };
}

function saveBooks(books: Book[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // Writing failed (quota / privacy mode). The in-memory state still works
    // for the session; we silently swallow so the UI keeps functioning.
  }
}

/**
 * A repository backed by localStorage. State is held in memory and mirrored
 * to storage on every mutation so a refresh restores the latest list.
 */
export function createLocalBookRepository(): BookRepository {
  let books: Book[] = loadBooks();

  function persist() {
    saveBooks(books);
  }

  return {
    list() {
      return books.map((b) => ({ ...b }));
    },
    add(draft) {
      const book: Book = { ...draft, id: createId(), borrower: "" };
      books = [...books, book];
      persist();
      return { ...book };
    },
    update(id, draft) {
      books = books.map((b) =>
        b.id === id ? { ...b, ...draft } : b,
      );
      persist();
    },
    remove(id) {
      books = books.filter((b) => b.id !== id);
      persist();
    },
    lend(id, borrower) {
      books = books.map((b) =>
        b.id === id ? { ...b, borrower } : b,
      );
      persist();
    },
    returnBook(id) {
      books = books.map((b) =>
        b.id === id ? { ...b, borrower: "" } : b,
      );
      persist();
    },
  };
}

export function countLentOut(books: Book[]): number {
  return books.filter(isLentOut).length;
}

export { STORAGE_KEY };
