import { describe, it, expect } from "vitest";
import {
  createBook,
  lendBook,
  returnBook,
  updateBook,
  isLentOut,
  countLentOut,
  validateBookInput,
  createId,
  isBookKind,
} from "./domain";
import type { Book } from "./types";
import { BOOK_KINDS } from "./types";

const baseBook: Book = {
  id: "b1",
  title: "The Hobbit",
  author: "Tolkien",
  kind: "Novel",
  borrower: null,
};

describe("createBook", () => {
  it("creates a book that is not lent out", () => {
    const book = createBook({ title: "Dune", author: "Herbert", kind: "Novel" });
    expect(book.title).toBe("Dune");
    expect(book.author).toBe("Herbert");
    expect(book.kind).toBe("Novel");
    expect(book.borrower).toBeNull();
    expect(book.id).toBeTruthy();
  });
});

describe("lendBook", () => {
  it("sets the borrower on an available book", () => {
    const next = lendBook(baseBook, "Alice");
    expect(next.borrower).toBe("Alice");
  });

  it("refuses to lend a book that is already out", () => {
    const out = { ...baseBook, borrower: "Alice" };
    expect(() => lendBook(out, "Bob")).toThrow();
  });

  it("trims borrower name and rejects blanks", () => {
    expect(() => lendBook(baseBook, "   ")).toThrow();
    const next = lendBook(baseBook, "  Alice  ");
    expect(next.borrower).toBe("Alice");
  });
});

describe("returnBook", () => {
  it("clears the borrower when returning a lent book", () => {
    const out = { ...baseBook, borrower: "Alice" };
    expect(returnBook(out).borrower).toBeNull();
  });

  it("is idempotent when a book is already home", () => {
    expect(returnBook(baseBook).borrower).toBeNull();
  });
});

describe("updateBook", () => {
  it("updates editable fields without touching lending state", () => {
    const out = { ...baseBook, borrower: "Alice" };
    const next = updateBook(out, { title: "The Hobbit 2", author: "J.R.R. Tolkien", kind: "Novel" });
    expect(next.title).toBe("The Hobbit 2");
    expect(next.author).toBe("J.R.R. Tolkien");
    expect(next.borrower).toBe("Alice");
  });

  it("trims updated title/author and rejects blanks", () => {
    expect(() => updateBook(baseBook, { title: "  ", author: "x", kind: "Novel" })).toThrow();
    const next = updateBook(baseBook, { title: " T ", author: " A ", kind: "Novel" });
    expect(next.title).toBe("T");
    expect(next.author).toBe("A");
  });
});

describe("isLentOut / countLentOut", () => {
  it("flags lent books and counts them", () => {
    const home = baseBook;
    const out = { ...baseBook, borrower: "Alice" };
    expect(isLentOut(home)).toBe(false);
    expect(isLentOut(out)).toBe(true);
    expect(countLentOut([home, out, out])).toBe(2);
  });
});

describe("validateBookInput", () => {
  it("returns errors for blank title and author", () => {
    const errors = validateBookInput({ title: "  ", author: "", kind: "Novel" });
    expect(errors.title).toBeTruthy();
    expect(errors.author).toBeTruthy();
    expect(errors.kind).toBeFalsy();
  });

  it("returns no errors for a valid input", () => {
    const errors = validateBookInput({ title: "T", author: "A", kind: "Novel" });
    expect(errors).toEqual({});
  });

  it("rejects unknown kinds", () => {
    const errors = validateBookInput({ title: "T", author: "A", kind: "Bogus" as never });
    expect(errors.kind).toBeTruthy();
  });
});

describe("createId", () => {
  it("produces unique, non-empty ids", () => {
    const a = createId();
    const b = createId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("isBookKind", () => {
  it("recognizes valid kinds and rejects others", () => {
    expect(isBookKind("Novel")).toBe(true);
    expect(isBookKind("Cookbook")).toBe(true);
    expect(isBookKind("bogus")).toBe(false);
    expect(BOOK_KINDS.length).toBeGreaterThan(0);
  });
});
