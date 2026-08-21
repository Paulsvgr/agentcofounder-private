import { describe, it, expect } from "vitest";
import {
  Book,
  BookCategory,
  countLentOut,
  createBook,
  filterBooks,
  isBookCategory,
  isLent,
  lendBook,
  returnBook,
  sanitizeBookList,
  updateBook,
  validateBookDraft,
  validateBorrowerName,
} from "./domain.js";

describe("domain", () => {
  describe("createBook", () => {
    it("trims fields and assigns an id with no borrower", () => {
      const book = createBook({ title: "  The Hobbit  ", author: " Tolkien ", category: "Novel" });
      expect(book.title).toBe("The Hobbit");
      expect(book.author).toBe("Tolkien");
      expect(book.category).toBe("Novel");
      expect(book.borrowerName).toBeNull();
      expect(book.id).toBeTruthy();
    });

    it("produces unique ids", () => {
      const a = createBook({ title: "A", author: "X", category: "Novel" });
      const b = createBook({ title: "A", author: "X", category: "Novel" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("validation", () => {
    it("rejects empty title and author", () => {
      const errors = validateBookDraft({ title: "   ", author: "", category: "Novel" });
      expect(errors.title).toBeTruthy();
      expect(errors.author).toBeTruthy();
      expect(errors.category).toBeUndefined();
    });

    it("rejects an unknown category", () => {
      const errors = validateBookDraft({ title: "T", author: "A", category: "Comic" as BookCategory });
      expect(errors.category).toBeTruthy();
    });

    it("accepts a complete draft", () => {
      expect(validateBookDraft({ title: "T", author: "A", category: "Cookbook" })).toEqual({});
    });

    it("validates borrower name", () => {
      expect(validateBorrowerName("  ").borrowerName).toBeTruthy();
      expect(validateBorrowerName("Sam").borrowerName).toBeUndefined();
    });

    it("isBookCategory narrows correctly", () => {
      expect(isBookCategory("Novel")).toBe(true);
      expect(isBookCategory("novel")).toBe(false);
      expect(isBookCategory(undefined)).toBe(false);
    });
  });

  describe("lend and return", () => {
    const home: Book = {
      id: "1",
      title: "T",
      author: "A",
      category: "Novel",
      borrowerName: null,
    };

    it("lends to a named borrower and reports lent state", () => {
      const lent = lendBook(home, "  Sam  ");
      expect(lent.borrowerName).toBe("Sam");
      expect(isLent(lent)).toBe(true);
      expect(isLent(home)).toBe(false);
    });

    it("ignores an empty borrower name", () => {
      const lent = lendBook(home, "   ");
      expect(lent).toBe(home);
    });

    it("returns a lent book to home", () => {
      const lent = lendBook(home, "Sam");
      const back = returnBook(lent);
      expect(back.borrowerName).toBeNull();
      expect(isLent(back)).toBe(false);
      // returning an already-home book is a no-op
      expect(returnBook(home)).toBe(home);
    });
  });

  describe("derived values and filtering", () => {
    const books: Book[] = [
      { id: "1", title: "A", author: "X", category: "Novel", borrowerName: null },
      { id: "2", title: "B", author: "Y", category: "Cookbook", borrowerName: "Sam" },
      { id: "3", title: "C", author: "Z", category: "Reference", borrowerName: "Lee" },
    ];

    it("counts how many are lent out", () => {
      expect(countLentOut(books)).toBe(2);
      expect(countLentOut([])).toBe(0);
    });

    it("filters by status", () => {
      expect(filterBooks(books, "lent").map((b) => b.id)).toEqual(["2", "3"]);
      expect(filterBooks(books, "home").map((b) => b.id)).toEqual(["1"]);
      expect(filterBooks(books, "all")).toHaveLength(3);
    });

    it("treats a whitespace-only borrower as not lent", () => {
      const weird: Book = { ...books[0], borrowerName: "   " };
      expect(isLent(weird)).toBe(false);
      expect(filterBooks([weird], "lent")).toHaveLength(0);
      expect(filterBooks([weird], "home")).toHaveLength(1);
    });
  });

  describe("updateBook", () => {
    it("updates fields and trims", () => {
      const book: Book = { id: "1", title: "A", author: "X", category: "Novel", borrowerName: "Pat" };
      const updated = updateBook(book, { title: " New ", author: " Name ", category: "Reference" });
      expect(updated.title).toBe("New");
      expect(updated.author).toBe("Name");
      expect(updated.category).toBe("Reference");
      expect(updated.borrowerName).toBe("Pat"); // unaffected
    });
  });

  describe("sanitizeBookList", () => {
    it("keeps valid books and drops malformed entries", () => {
      const raw = [
        { id: "1", title: "A", author: "X", category: "Novel", borrowerName: "Sam" },
        { id: "", title: "Bad", author: "X", category: "Novel" }, // missing id
        { id: "2", title: "B", author: "Y", category: "Mystery" }, // bad category
        { id: "3", title: "C", author: "Z", category: "Cookbook", borrowerName: "   " }, // home
        "not-an-object",
        null,
        { id: "4", title: "D", author: "W", category: "Reference", borrowerName: 123 }, // bad lender -> home
      ];
      const result = sanitizeBookList(raw);
      expect(result.map((b) => b.id)).toEqual(["1", "3", "4"]);
      expect(result[1].borrowerName).toBeNull();
      expect(result[2].borrowerName).toBeNull();
    });

    it("returns empty for non-array input", () => {
      expect(sanitizeBookList({ not: "array" })).toEqual([]);
      expect(sanitizeBookList("string")).toEqual([]);
      expect(sanitizeBookList(null)).toEqual([]);
    });
  });
});
