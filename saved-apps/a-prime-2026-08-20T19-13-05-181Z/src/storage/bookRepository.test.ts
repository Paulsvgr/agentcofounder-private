import { beforeEach, describe, expect, it } from "vitest";
import { Book } from "../domain/book.js";
import {
  BOOK_STORAGE_KEY,
  clearBooks,
  loadBooks,
  saveBooks,
} from "./bookRepository.js";

beforeEach(() => {
  localStorage.clear();
});

describe("book repository", () => {
  it("round-trips books through localStorage", () => {
    const books: Book[] = [
      { id: "1", title: "Dune", author: "Herbert", category: "Novel", borrower: null },
      {
        id: "2",
        title: "Salt Fat Acid Heat",
        author: "Nosrat",
        category: "Cookbook",
        borrower: "Sam",
      },
    ];
    saveBooks(books);
    expect(loadBooks()).toEqual(books);
  });

  it("starts empty when storage is empty", () => {
    expect(loadBooks()).toEqual([]);
  });

  it("recovers from corrupt JSON", () => {
    localStorage.setItem(BOOK_STORAGE_KEY, "{not valid json");
    expect(loadBooks()).toEqual([]);
  });

  it("recovers from a non-array value", () => {
    localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(loadBooks()).toEqual([]);
  });

  it("drops malformed entries and fixes bad categories", () => {
    localStorage.setItem(
      BOOK_STORAGE_KEY,
      JSON.stringify([
        { id: "a", title: "Good", author: "A", category: "Novel", borrower: null },
        "not-an-object",
        null,
        { id: "b", title: "Mismatch", author: "A", category: "Magazine", borrower: "  " },
      ]),
    );
    const loaded = loadBooks();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].title).toBe("Good");
    expect(loaded[1].category).toBe("Other");
    expect(loaded[1].borrower).toBeNull();
  });

  it("assigns an id to entries missing one", () => {
    localStorage.setItem(
      BOOK_STORAGE_KEY,
      JSON.stringify([{ title: "NoId", author: "A", category: "Novel", borrower: null }]),
    );
    const loaded = loadBooks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBeTruthy();
  });

  it("can clear stored books", () => {
    saveBooks([
      { id: "1", title: "Dune", author: "Herbert", category: "Novel", borrower: null },
    ]);
    clearBooks();
    expect(loadBooks()).toEqual([]);
  });
});
