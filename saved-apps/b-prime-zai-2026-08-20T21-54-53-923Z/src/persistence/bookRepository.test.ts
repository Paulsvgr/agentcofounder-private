import { describe, expect, it } from "vitest";
import { createBookRepository } from "./bookRepository.js";
import type { Book } from "../domain/book.js";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "b1",
    title: "The Hobbit",
    author: "Tolkien",
    category: "Novel",
    borrower: null,
    ...overrides,
  };
}

describe("bookRepository", () => {
  it("round-trips books through storage", () => {
    const store = new Map<string, string>();
    const storage = makeStorage(store);
    const repo = createBookRepository(storage);

    const books = [makeBook(), makeBook({ id: "b2", borrower: "Sam" })];
    repo.saveAll(books);
    const loaded = repo.loadAll();

    expect(loaded).toEqual(books);
  });

  it("survives a refresh by loading previously saved books", () => {
    const store = new Map<string, string>();
    const storage = makeStorage(store);
    const repo1 = createBookRepository(storage);
    repo1.saveAll([makeBook({ id: "saved", borrower: "Merry" })]);

    // Simulate a fresh app start with the same storage.
    const repo2 = createBookRepository(storage);
    const loaded = repo2.loadAll();
    expect(loaded).toEqual([
      { ...makeBook(), id: "saved", borrower: "Merry" },
    ]);
  });

  it("drops malformed persisted data", () => {
    const store = new Map<string, string>();
    const storage = makeStorage(store);
    storage.setItem(
      "home-library.books.v1",
      JSON.stringify([
        makeBook(),
        { id: "x", title: "", author: "y", category: "Novel" },
        { id: "z", title: "Z", author: "A", category: "Bogus" },
        "not-an-object",
        null,
        { id: "good", title: "Good", author: "A", category: "Reference" },
      ]),
    );
    const repo = createBookRepository(storage);
    const loaded = repo.loadAll();
    expect(loaded.map((b) => b.id)).toEqual(["b1", "good"]);
  });

  it("returns empty when storage is unavailable", () => {
    const repo = createBookRepository(null);
    expect(repo.loadAll()).toEqual([]);
    expect(() => repo.saveAll([makeBook()])).not.toThrow();
  });

  it("recovers from corrupt JSON", () => {
    const store = new Map<string, string>();
    const storage = makeStorage(store);
    storage.setItem("home-library.books.v1", "{not json");
    const repo = createBookRepository(storage);
    expect(repo.loadAll()).toEqual([]);
  });
});

function makeStorage(store: Map<string, string>): Storage {
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}
