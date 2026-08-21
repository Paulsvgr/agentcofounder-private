import { describe, it, expect, beforeEach } from "vitest";
import {
  createBook,
  lendBook,
  returnBook,
  countLentOut,
  validateBookInput,
  validateBorrower,
  isLentOut,
} from "./domain.js";
import { createLocalStorageRepository } from "./persistence.js";
import type { Book } from "./types.js";

const baseInput = {
  title: " The Pragmatic Programmer ",
  author: "Andrew Hunt",
  category: "reference" as const,
};

describe("domain", () => {
  it("creates a book with trimmed fields and an id", () => {
    const book = createBook(baseInput);
    expect(book.id).toMatch(/^b_/);
    expect(book.title).toBe("The Pragmatic Programmer");
    expect(book.author).toBe("Andrew Hunt");
    expect(book.category).toBe("reference");
    expect(book.borrowerName).toBeNull();
    expect(isLentOut(book)).toBe(false);
  });

  it("lends a book and clears it on return", () => {
    const book = createBook(baseInput);
    const lent = lendBook(book, "  Mum  ");
    expect(lent.borrowerName).toBe("Mum");
    expect(isLentOut(lent)).toBe(true);
    expect(countLentOut([book, lent])).toBe(1);
    const home = returnBook(lent);
    expect(home.borrowerName).toBeNull();
    expect(isLentOut(home)).toBe(false);
    expect(countLentOut([home])).toBe(0);
  });

  it("re-lending updates the borrower name", () => {
    const book = createBook(baseInput);
    const lent = lendBook(book, "Mum");
    const relit = lendBook(lent, "Dad");
    expect(relit.borrowerName).toBe("Dad");
  });

  it("rejects empty titles and authors", () => {
    expect(validateBookInput({ ...baseInput, title: "   " }).title).toBeDefined();
    expect(validateBookInput({ ...baseInput, author: "" }).author).toBeDefined();
    expect(validateBorrower("  ")).toHaveProperty("borrowerName");
  });
});

describe("persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips books through localStorage", () => {
    const repo = createLocalStorageRepository();
    const book: Book = {
      id: "b_1",
      title: "Moby Dick",
      author: "Herman Melville",
      category: "novel",
      borrowerName: "Sue",
    };
    repo.saveAll([book]);
    const loaded = repo.loadAll();
    expect(loaded).toEqual([book]);
  });

  it("drops malformed stored entries instead of crashing", () => {
    window.localStorage.setItem(
      "book-shelf.books.v1",
      JSON.stringify([
        { id: "b_1", title: "Good", author: "A", category: "novel", borrowerName: null },
        { id: "b_2", title: "", author: "A", category: "novel" }, // missing borrowerName ok? no -> borrowerName undefined -> not null -> drop
        "not-an-object",
        { id: "b_3", title: "Bad", author: "A", category: "magazine", borrowerName: null },
        { id: "b_4", title: "Good2", author: "B", category: "cookbook", borrowerName: "Ed" },
      ]),
    );
    const repo = createLocalStorageRepository();
    const loaded = repo.loadAll();
    expect(loaded.map((b) => b.id)).toEqual(["b_1", "b_4"]);
  });

  it("returns empty array when storage is empty or unreadable", () => {
    const repo = createLocalStorageRepository();
    expect(repo.loadAll()).toEqual([]);
  });
});
