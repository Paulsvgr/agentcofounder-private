import { describe, it, expect, beforeEach } from "vitest";
import {
  createBook,
  isBook,
  isBookCategory,
  filterBooks,
  countLent,
  hasDuplicate,
  lendBook,
  returnBook,
  updateBook,
  validateNewBook,
  validateBorrower,
} from "./book";
import type { Book } from "../types";

const base: Book = {
  id: "1",
  title: "Dune",
  author: "Frank Herbert",
  category: "Novel",
  borrower: null,
};

describe("domain validation", () => {
  it("requires a title and author", () => {
    expect(validateNewBook({ title: "", author: "", category: "Novel" })).toBe(
      "Title is required",
    );
    expect(
      validateNewBook({ title: "Dune", author: "", category: "Novel" }),
    ).toBe("Author is required");
    expect(
      validateNewBook({ title: "Dune", author: "x", category: "Bad" }),
    ).toBe("Please choose a valid category");
    expect(
      validateNewBook({ title: "Dune", author: "x", category: "Novel" }),
    ).toBeNull();
  });

  it("requires a borrower name", () => {
    expect(validateBorrower("   ")).toBe("Borrower name is required");
    expect(validateBorrower("Mum")).toBeNull();
  });
});

describe("domain guards", () => {
  it("validates persisted book shape", () => {
    expect(isBook(null)).toBe(false);
    expect(isBook({})).toBe(false);
    expect(isBook({ ...base, category: "Nope" })).toBe(false);
    expect(isBook(base)).toBe(true);
    expect(
      isBook({ ...base, borrower: "Mum" }),
    ).toBe(true);
  });

  it("recognises valid categories", () => {
    expect(isBookCategory("Novel")).toBe(true);
    expect(isBookCategory("Cookbook")).toBe(true);
    expect(isBookCategory("Mystery")).toBe(false);
  });
});

describe("domain operations", () => {
  it("creates, lends and returns a book", () => {
    const book = createBook(
      { title: "Dune", author: "Frank Herbert", category: "Novel" },
      "x",
    );
    expect(book.borrower).toBeNull();

    const lent = lendBook(book, "Mum");
    expect(lent.borrower).toBe("Mum");

    const back = returnBook(lent);
    expect(back.borrower).toBeNull();
  });

  it("updates a book", () => {
    const updated = updateBook(base, {
      title: "Dune revised",
      category: "Reference",
    });
    expect(updated.title).toBe("Dune revised");
    expect(updated.category).toBe("Reference");
    expect(updated.author).toBe("Frank Herbert");
  });

  it("filters and counts lent books", () => {
    const books = [
      base,
      { ...base, id: "2", borrower: "Dad" },
      { ...base, id: "3", borrower: "Sue" },
    ];
    expect(countLent(books)).toBe(2);
    expect(filterBooks(books, "lent")).toHaveLength(2);
    expect(filterBooks(books, "all")).toHaveLength(3);
  });

  it("detects duplicates by title+author ignoring case", () => {
    const input = {
      title: "  dune ",
      author: "frank herbert",
      category: "Novel" as const,
    };
    expect(hasDuplicate([base], input)).toBe(true);
    expect(hasDuplicate([base], input, base.id)).toBe(false);
    expect(
      hasDuplicate([base], {
        title: "Other",
        author: "frank herbert",
        category: "Novel" as const,
      }),
    ).toBe(false);
  });
});
