import { describe, expect, it } from "vitest";
import {
  createBook,
  isLentOut,
  lendBook,
  returnBook,
  updateBook,
  validateBookInput,
  validateBorrower,
} from "./book.js";

describe("book domain", () => {
  it("creates a book on the shelf with no borrower", () => {
    const book = createBook({
      title: " The Lord of the Rings ",
      author: "J.R.R. Tolkien",
      category: "Novel",
    });
    expect(book.title).toBe("The Lord of the Rings");
    expect(book.author).toBe("J.R.R. Tolkien");
    expect(book.category).toBe("Novel");
    expect(book.borrower).toBeNull();
    expect(isLentOut(book)).toBe(false);
  });

  it("lends a book and returns it to the shelf", () => {
    const book = createBook({ title: "Sapiens", author: "Harari", category: "Other" });
    const lent = lendBook(book, " Sam ");
    expect(isLentOut(lent)).toBe(true);
    expect(lent.borrower).toBe("Sam");
    const home = returnBook(lent);
    expect(isLentOut(home)).toBe(false);
    expect(home.borrower).toBeNull();
  });

  it("updates editable details without touching the loan", () => {
    const lent = lendBook(
      createBook({ title: "Old", author: "A", category: "Novel" }),
      "Pat",
    );
    const updated = updateBook(lent, { title: "New", author: "B", category: "Cookbook" });
    expect(updated.title).toBe("New");
    expect(updated.author).toBe("B");
    expect(updated.category).toBe("Cookbook");
    expect(updated.borrower).toBe("Pat");
  });

  it("validates required book fields", () => {
    expect(validateBookInput({ title: "   ", author: "A", category: "Novel" }).title).toBe(
      "Title is required",
    );
    expect(validateBookInput({ title: "T", author: "", category: "Novel" }).author).toBe(
      "Author is required",
    );
    expect(
      validateBookInput({ title: "T", author: "A", category: "Magazine" }).category,
    ).toBe("Choose a category");
    expect(Object.keys(validateBookInput({ title: "T", author: "A", category: "Novel" }))).toHaveLength(0);
  });

  it("requires a borrower name when lending", () => {
    expect(validateBorrower("   ")).toBe("Enter who is borrowing the book");
    expect(validateBorrower("Pat")).toBeUndefined();
  });

  it("treats a whitespace-only borrower as not lent out", () => {
    const book = lendBook(
      createBook({ title: "T", author: "A", category: "Novel" }),
      "   ",
    );
    // The lend helper trims, but a book that somehow ended up with an empty
    // stored borrower should still read as on the shelf.
    expect(isLentOut({ ...book, borrower: "   " })).toBe(false);
  });
});
