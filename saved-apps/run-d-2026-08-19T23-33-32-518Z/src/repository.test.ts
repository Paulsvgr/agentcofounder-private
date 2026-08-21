import { describe, it, expect, beforeEach } from "vitest";
import { createLocalStorageRepository } from "./repository.js";
import { createBook, lendBook, Book } from "./domain.js";

describe("localStorage repository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    const repo = createLocalStorageRepository();
    expect(repo.load()).toEqual([]);
  });

  it("round-trips books including lend state", () => {
    const repo = createLocalStorageRepository();
    let book = createBook({ title: "The Hobbit", author: "Tolkien", category: "Novel" });
    book = lendBook(book, "Sam");
    repo.save([
      book,
      createBook({ title: "Salt Fat Acid Heat", author: "Nosrat", category: "Cookbook" }),
    ]);

    const loaded = repo.load();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].title).toBe("The Hobbit");
    expect(loaded[0].borrowerName).toBe("Sam");
    expect(loaded[1].borrowerName).toBeNull();
  });

  it("survives malformed JSON by returning an empty list", () => {
    window.localStorage.setItem("home-library.books.v1", "{not valid json");
    const repo = createLocalStorageRepository();
    expect(repo.load()).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    window.localStorage.setItem(
      "home-library.books.v1",
      JSON.stringify([
        { id: "1", title: "A", author: "X", category: "Novel", borrowerName: "Sam" },
        { title: "no id" },
        { id: "2", title: "B", author: "Y", category: "Bogus" },
      ]),
    );
    const repo = createLocalStorageRepository();
    const loaded = repo.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("1");
  });

  it("clear removes stored books", () => {
    const repo = createLocalStorageRepository();
    const book: Book = createBook({ title: "A", author: "X", category: "Novel" });
    repo.save([book]);
    expect(repo.load()).toHaveLength(1);
    repo.clear();
    expect(repo.load()).toEqual([]);
  });
});
