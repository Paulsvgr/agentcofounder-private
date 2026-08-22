import { describe, expect, it } from "vitest";
import { createRepository } from "./repository.js";
import { createBookService } from "./service.js";

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

describe("book service with repository", () => {
  it("lends and returns a book and persists state", () => {
    const storage = makeMemoryStorage();
    const repo = createRepository(storage);
    const svc = createBookService(repo);

    const book = svc.add({
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      category: "Novel",
    });
    svc.lend(book.id, "Sue");
    let books = svc.list();
    expect(books[0].borrower).toBe("Sue");

    svc.returnBook(book.id);
    books = svc.list();
    expect(books[0].borrower).toBeNull();

    // Updated via repo backed by storage survives reload
    svc.lend(book.id, "Bob");
    const reloaded = createBookService(createRepository(storage)).list();
    expect(reloaded[0].borrower).toBe("Bob");
  });

  it("ignores empty borrower names", () => {
    const svc = createBookService(createRepository(makeMemoryStorage()));
    const book = svc.add({
      title: "X",
      author: "Y",
      category: "Novel",
    });
    svc.lend(book.id, "   ");
    expect(svc.list()[0].borrower).toBeNull();
  });

  it("filters out malformed entries from corrupted storage", () => {
    const storage = makeMemoryStorage();
    storage.setItem(
      "bookshelf.books.v1",
      JSON.stringify([
        { id: "1", title: "Good", author: "A", category: "Novel", borrower: null },
        { id: "2", title: 123 },
        "not a book",
        null,
      ]),
    );
    const svc = createBookService(createRepository(storage));
    const books = svc.list();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Good");
  });
});
