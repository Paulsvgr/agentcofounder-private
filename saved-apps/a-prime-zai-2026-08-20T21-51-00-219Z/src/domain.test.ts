import { describe, expect, it } from "vitest";
import {
  applyFilter,
  countOut,
  createBook,
  lendBook,
  returnBook,
  sanitizeBooks,
  validateBookInput,
  validateBorrower,
} from "./domain";

describe("domain", () => {
  it("creates a book that is not lent out", () => {
    const book = createBook("Dune", "Frank Herbert", "Novel");
    expect(book.title).toBe("Dune");
    expect(book.author).toBe("Frank Herbert");
    expect(book.borrower).toBeNull();
  });

  it("counts and filters lent out books", () => {
    const a = createBook("A", "X", "Novel");
    const b = lendBook(createBook("B", "Y", "Cookbook"), "Sam");
    const books = [a, b];
    expect(countOut(books)).toBe(1);
    expect(applyFilter(books, "out")).toEqual([b]);
    expect(applyFilter(books, "all")).toHaveLength(2);
  });

  it("returns a lent book back to the shelf", () => {
    const lent = lendBook(createBook("C", "Z", "Reference"), "Jo");
    expect(returnBook(lent).borrower).toBeNull();
  });

  it("validates book input", () => {
    expect(validateBookInput("", "Author")).not.toBeNull();
    expect(validateBookInput("Title", "")).not.toBeNull();
    expect(validateBookInput("Title", "Author")).toBeNull();
  });

  it("validates borrower name", () => {
    expect(validateBorrower("")).not.toBeNull();
    expect(validateBorrower("Sam")).toBeNull();
  });

  it("drops malformed persisted entries and trims whitespace", () => {
    const raw = [
      { id: "1", title: "  Clean  ", author: "Author", category: "Novel", borrower: "  " },
      { id: "2", title: "", author: "NoTitle", category: "Novel" },
      "not-an-object",
      null,
      { title: "NoAuthor", author: "" },
    ];
    const result = sanitizeBooks(raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Clean");
    expect(result[0].borrower).toBeNull();
  });
});
