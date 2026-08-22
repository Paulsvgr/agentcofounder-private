import { describe, expect, it } from "vitest";
import {
  addBook,
  deleteBook,
  lendBook,
  returnBook,
  updateBook,
  validateDraft,
} from "./domain.js";
import { isLent } from "./types.js";

const draft = { title: "The Pragmatic Programmer", author: "Hunt", category: "Reference" };
const draft2 = { title: "Salt Fat Acid Heat", author: "Nosrat", category: "Cookbook" };

describe("domain operations", () => {
  it("adds a book with a fresh id and at-home status", () => {
    const books = addBook([], draft, "b1");
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id: "b1",
      title: "The Pragmatic Programmer",
      author: "Hunt",
      category: "Reference",
      borrower: "",
    });
    expect(isLent(books[0])).toBe(false);
  });

  it("trims whitespace on add and edit", () => {
    const books = addBook(
      [],
      { title: "  Novel  ", author: "  Author ", category: "  Novel " },
      "b1",
    );
    expect(books[0].title).toBe("Novel");
    expect(books[0].author).toBe("Author");
    expect(books[0].category).toBe("Novel");
  });

  it("edits an existing book without changing its borrower", () => {
    let books = addBook([], draft, "b1");
    books = lendBook(books, "b1", "Sam");
    books = updateBook(books, "b1", draft2);
    expect(books[0]).toMatchObject({
      id: "b1",
      ...draft2,
      borrower: "Sam",
    });
  });

  it("does not mutate other books when editing one", () => {
    let books = addBook([], draft, "b1");
    books = addBook(books, draft2, "b2");
    books = updateBook(books, "b1", { ...draft, title: "Updated" });
    expect(books[1].title).toBe("Salt Fat Acid Heat");
    expect(books[0].title).toBe("Updated");
  });

  it("deletes only the targeted book", () => {
    let books = addBook([], draft, "b1");
    books = addBook(books, draft2, "b2");
    books = deleteBook(books, "b1");
    expect(books.map((b) => b.id)).toEqual(["b2"]);
  });

  it("lends a book out and marks it returned", () => {
    let books = addBook([], draft, "b1");
    expect(isLent(books[0])).toBe(false);
    books = lendBook(books, "b1", " Jordan ");
    expect(books[0].borrower).toBe("Jordan");
    expect(isLent(books[0])).toBe(true);
    books = returnBook(books, "b1");
    expect(books[0].borrower).toBe("");
    expect(isLent(books[0])).toBe(false);
  });

  it("lending with a blank name effectively returns the book", () => {
    let books = addBook([], draft, "b1");
    books = lendBook(books, "b1", "Sam");
    books = lendBook(books, "b1", "   ");
    expect(books[0].borrower).toBe("");
    expect(isLent(books[0])).toBe(false);
  });

  it("validates drafts, rejecting empty title/author/category", () => {
    expect(validateDraft({ title: "", author: "A", category: "Novel" })).toBe("title");
    expect(validateDraft({ title: "T", author: "", category: "Novel" })).toBe("author");
    expect(validateDraft({ title: "T", author: "A", category: "   " })).toBe("category");
    expect(validateDraft(draft)).toBeNull();
  });

  it("is unaffected by operations on unknown ids", () => {
    let books = addBook([], draft, "b1");
    const before = books;
    books = updateBook(books, "missing", draft2);
    books = deleteBook(books, "missing");
    books = lendBook(books, "missing", "Sam");
    books = returnBook(books, "missing");
    // New arrays are returned, but contents are equivalent.
    expect(books).toHaveLength(1);
    expect(books[0]).toEqual(before[0]);
  });
});
