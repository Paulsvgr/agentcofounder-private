import { describe, it, expect } from "vitest";
import {
  type Book,
  parseBook,
  isBookCategory,
  isLentOut,
  countLentOut,
  lentOutBooks,
  homeBooks,
  cleanText,
  BOOK_CATEGORIES,
} from "./books";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    category: "Fiction",
    borrower: "",
    ...overrides,
  };
}

describe("isBookCategory", () => {
  it("returns true for known categories", () => {
    expect(isBookCategory("Fiction")).toBe(true);
    expect(isBookCategory("Cookbook")).toBe(true);
  });

  it("returns false for unknown categories", () => {
    expect(isBookCategory("Mystery")).toBe(false);
    expect(isBookCategory(123)).toBe(false);
    expect(isBookCategory(null)).toBe(false);
  });
});

describe("parseBook", () => {
  it("parses a valid book object", () => {
    const book = parseBook({
      id: "1",
      title: "Dune",
      author: "Frank Herbert",
      category: "Fiction",
      borrower: "Alice",
    });
    expect(book).toEqual({
      id: "1",
      title: "Dune",
      author: "Frank Herbert",
      category: "Fiction",
      borrower: "Alice",
    });
  });

  it("returns null for non-objects", () => {
    expect(parseBook(null)).toBeNull();
    expect(parseBook("hello")).toBeNull();
    expect(parseBook(42)).toBeNull();
  });

  it("returns null for missing or empty id", () => {
    expect(parseBook({ id: "", title: "x", author: "y", category: "Fiction", borrower: "" })).toBeNull();
    expect(parseBook({ title: "x", author: "y", category: "Fiction", borrower: "" })).toBeNull();
  });

  it("returns null for missing or blank title", () => {
    expect(parseBook({ id: "1", title: "", author: "y", category: "Fiction", borrower: "" })).toBeNull();
    expect(parseBook({ id: "1", author: "y", category: "Fiction", borrower: "" })).toBeNull();
  });

  it("returns null for missing or blank author", () => {
    expect(parseBook({ id: "1", title: "x", author: "", category: "Fiction", borrower: "" })).toBeNull();
    expect(parseBook({ id: "1", title: "x", category: "Fiction", borrower: "" })).toBeNull();
  });

  it("returns null for invalid category", () => {
    expect(parseBook({ id: "1", title: "x", author: "y", category: "Sci-Fi", borrower: "" })).toBeNull();
    expect(parseBook({ id: "1", title: "x", author: "y", borrower: "" })).toBeNull();
  });

  it("returns null when borrower is not a string", () => {
    expect(parseBook({ id: "1", title: "x", author: "y", category: "Fiction", borrower: 123 })).toBeNull();
    expect(parseBook({ id: "1", title: "x", author: "y", category: "Fiction" })).toBeNull();
  });

  it("treats blank borrower as valid (book at home)", () => {
    const book = parseBook({ id: "1", title: "x", author: "y", category: "Fiction", borrower: "" });
    expect(book).not.toBeNull();
    expect(book?.borrower).toBe("");
  });
});

describe("cleanText", () => {
  it("trims leading/trailing whitespace", () => {
    expect(cleanText("  hello  ")).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(cleanText("  F.    Scott   Fitzgerald  ")).toBe("F. Scott Fitzgerald");
  });
});

describe("isLentOut", () => {
  it("returns true when borrower is non-empty", () => {
    expect(isLentOut(makeBook({ borrower: "Alice" }))).toBe(true);
  });

  it("returns false when borrower is empty", () => {
    expect(isLentOut(makeBook({ borrower: "" }))).toBe(false);
  });

  it("returns false when borrower is whitespace-only", () => {
    expect(isLentOut(makeBook({ borrower: "  " }))).toBe(false);
  });
});

describe("countLentOut", () => {
  it("counts lent out books", () => {
    const books = [
      makeBook({ id: "1", borrower: "" }),
      makeBook({ id: "2", borrower: "Alice" }),
      makeBook({ id: "3", borrower: "Bob" }),
      makeBook({ id: "4", borrower: "" }),
    ];
    expect(countLentOut(books)).toBe(2);
  });

  it("returns 0 for empty list", () => {
    expect(countLentOut([])).toBe(0);
  });
});

describe("lentOutBooks", () => {
  it("returns only lent out books sorted by borrower then title", () => {
    const books = [
      makeBook({ id: "1", title: "Zebra", author: "A", category: "Fiction", borrower: "Alice" }),
      makeBook({ id: "2", title: "Apple", author: "B", category: "Fiction", borrower: "" }),
      makeBook({ id: "3", title: "Mango", author: "C", category: "Fiction", borrower: "Bob" }),
      makeBook({ id: "4", title: "Apricot", author: "D", category: "Fiction", borrower: "Alice" }),
    ];
    const result = lentOutBooks(books);
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Apricot"); // Alice, A before M
    expect(result[1].title).toBe("Zebra"); // Alice, Z
    expect(result[2].title).toBe("Mango"); // Bob
  });
});

describe("homeBooks", () => {
  it("returns only home books sorted by title", () => {
    const books = [
      makeBook({ id: "1", title: "Zebra", author: "A", category: "Fiction", borrower: "" }),
      makeBook({ id: "2", title: "Apple", author: "B", category: "Fiction", borrower: "Alice" }),
      makeBook({ id: "3", title: "Mango", author: "C", category: "Fiction", borrower: "" }),
    ];
    const result = homeBooks(books);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Mango");
    expect(result[1].title).toBe("Zebra");
  });
});

describe("BOOK_CATEGORIES", () => {
  it("includes common categories", () => {
    expect(BOOK_CATEGORIES).toContain("Fiction");
    expect(BOOK_CATEGORIES).toContain("Cookbook");
    expect(BOOK_CATEGORIES).toContain("Reference");
  });

  it("contains Other as a catch-all", () => {
    expect(BOOK_CATEGORIES).toContain("Other");
  });
});
