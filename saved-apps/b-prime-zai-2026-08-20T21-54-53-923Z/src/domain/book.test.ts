import { describe, expect, it } from "vitest";
import {
  BOOK_CATEGORIES,
  countLentOut,
  createBook,
  editBook,
  isLentOut,
  lendBook,
  returnBook,
  validateBookInput,
} from "./book.js";
import type { BookInput } from "./book.js";

const validInput: BookInput = {
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
  category: "Novel",
};

describe("book domain", () => {
  it("creates a book that is at home by default", () => {
    const book = createBook(validInput, "b1");
    expect(book).toEqual({
      id: "b1",
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      category: "Novel",
      borrower: null,
    });
    expect(isLentOut(book)).toBe(false);
  });

  it("lends a book out and clears it on return", () => {
    let book = createBook(validInput, "b1");
    expect(isLentOut(book)).toBe(false);

    book = lendBook(book, "Sam");
    expect(book.borrower).toBe("Sam");
    expect(isLentOut(book)).toBe(true);

    book = returnBook(book);
    expect(book.borrower).toBe(null);
    expect(isLentOut(book)).toBe(false);
  });

  it("trims borrower names and ignores blank lenders", () => {
    const book = lendBook(createBook(validInput, "b1"), "  Merry  ");
    expect(book.borrower).toBe("Merry");

    const blank = lendBook(createBook(validInput, "b2"), "   ");
    expect(blank.borrower).toBe(null);
  });

  it("counts and filters lent-out books", () => {
    const home = createBook(validInput, "b1");
    const out = lendBook(createBook(validInput, "b2"), "Pippin");
    expect(countLentOut([home, out])).toBe(1);
  });

  it("edits title/author/category without touching borrower state", () => {
    let book = lendBook(createBook(validInput, "b1"), "Frodo");
    book = editBook(book, {
      title: "The Lord of the Rings",
      author: "Tolkien",
      category: "Other",
    });
    expect(book.title).toBe("The Lord of the Rings");
    expect(book.category).toBe("Other");
    expect(book.borrower).toBe("Frodo");
  });

  describe("validation", () => {
    it("rejects missing title and author", () => {
      const errors = validateBookInput({
        title: "  ",
        author: "",
        category: "Novel",
      });
      expect(errors.map((e) => e.field).sort()).toEqual([
        "author",
        "title",
      ]);
    });

    it("rejects unknown categories", () => {
      const errors = validateBookInput({
        title: "x",
        author: "y",
        category: "Sci-Fi",
      });
      expect(errors.some((e) => e.field === "category")).toBe(true);
    });

    it("accepts a known category", () => {
      expect(BOOK_CATEGORIES).toContain("Cookbook");
      const errors = validateBookInput({
        title: "x",
        author: "y",
        category: "Cookbook",
      });
      expect(errors).toHaveLength(0);
    });
  });
});
