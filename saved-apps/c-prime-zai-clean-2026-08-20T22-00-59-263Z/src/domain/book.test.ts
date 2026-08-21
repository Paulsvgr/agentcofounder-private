import { describe, it, expect } from "vitest";
import {
  type Book,
  BOOK_CATEGORIES,
  createBook,
  isLentOut,
  lentOutCount,
  lendBook,
  returnBook,
  toIsoDate,
  updateBook,
  validateBookInput,
  validateLending,
  normalizeBook,
  isBookCategory,
} from "./book.js";

const validInput = { title: "The Pragmatic Programmer", author: "Hunt", category: "other" as const };

describe("book domain", () => {
  it("creates a book that is not lent out", () => {
    const book = createBook("b1", validInput);
    expect(book.title).toBe("The Pragmatic Programmer");
    expect(book.author).toBe("Hunt");
    expect(book.category).toBe("other");
    expect(book.borrowerName).toBeNull();
    expect(book.lentOn).toBeNull();
    expect(isLentOut(book)).toBe(false);
  });

  it("trims whitespace in title and author", () => {
    const book = createBook("b2", {
      title: "  Dune  ",
      author: "  Frank Herbert  ",
      category: "novel",
    });
    expect(book.title).toBe("Dune");
    expect(book.author).toBe("Frank Herbert");
  });

  it("validates empty title and author", () => {
    const errors = validateBookInput({ title: "   ", author: "", category: "novel" });
    expect(errors).toContainEqual({ field: "title", reason: "empty" });
    expect(errors).toContainEqual({ field: "author", reason: "empty" });
    expect(errors).not.toContainEqual({ field: "category", reason: "invalid" });
  });

  it("rejects an invalid category", () => {
    const errors = validateBookInput({
      title: "X",
      author: "Y",
      category: "comic",
    });
    expect(errors).toContainEqual({ field: "category", reason: "invalid" });
  });

  it("exposes the four supported categories", () => {
    const cats = BOOK_CATEGORIES.map((c) => c.value);
    expect(cats).toEqual(["novel", "cookbook", "reference", "other"]);
    expect(isBookCategory("novel")).toBe(true);
    expect(isBookCategory("comic")).toBe(false);
  });

  it("marks a book lent out with a date and counts it", () => {
    const base = createBook("b3", { ...validInput, category: "novel" });
    const lent = lendBook(base, "  Alice  ", new Date("2024-01-15T10:00:00Z"));
    expect(lent.borrowerName).toBe("Alice");
    expect(lent.lentOn).toBe("2024-01-15");
    expect(isLentOut(lent)).toBe(true);

    const others: Book[] = [base, lent, createBook("b4", validInput)];
    expect(lentOutCount(others)).toBe(1);
  });

  it("returns a lent book, clearing borrower and date", () => {
    const base = createBook("b5", { ...validInput, category: "cookbook" });
    const lent = lendBook(base, "Bob", new Date("2024-02-01T00:00:00Z"));
    const back = returnBook(lent);
    expect(back.borrowerName).toBeNull();
    expect(back.lentOn).toBeNull();
    expect(isLentOut(back)).toBe(false);
  });

  it("rejects lending with an empty borrower name", () => {
    expect(validateLending("   ")).toEqual([
      { field: "borrowerName", reason: "empty" },
    ]);
    expect(validateLending("Carol")).toEqual([]);
  });

  it("updates editable fields while preserving lending state", () => {
    const lent = lendBook(
      createBook("b6", { ...validInput, category: "reference" }),
      "Dan",
      new Date("2024-03-03T00:00:00Z"),
    );
    const edited = updateBook(lent, { title: "Ref Ed", category: "other" });
    expect(edited.title).toBe("Ref Ed");
    expect(edited.category).toBe("other");
    expect(edited.borrowerName).toBe("Dan");
    expect(edited.lentOn).toBe("2024-03-03");
  });

  it("formats an ISO date from a Date", () => {
    expect(toIsoDate(new Date("2024-12-31T23:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes a valid stored book", () => {
    const raw = {
      id: "b7",
      title: "T",
      author: "A",
      category: "novel",
      borrowerName: "Eve",
      lentOn: "2024-04-04",
    };
    expect(normalizeBook(raw)).toEqual(raw);
  });

  it("rejects malformed stored data", () => {
    expect(normalizeBook(null)).toBeNull();
    expect(normalizeBook("nope")).toBeNull();
    expect(normalizeBook({ id: "x", title: "" })).toBeNull(); // missing fields
    expect(
      normalizeBook({ id: "x", title: "T", author: "A", category: "comic" }),
    ).toBeNull(); // bad category
  });

  it("clears an empty borrower name on load", () => {
    const norm = normalizeBook({
      id: "b8",
      title: "T",
      author: "A",
      category: "novel",
      borrowerName: "   ",
      lentOn: "",
    });
    expect(norm?.borrowerName).toBeNull();
    expect(norm?.lentOn).toBeNull();
  });
});
