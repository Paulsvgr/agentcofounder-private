import { describe, it, expect } from "vitest";
import { createBookRepository } from "./repository";
import type { Book } from "./types";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function freshRepo() {
  return createBookRepository(new MemoryStorage());
}

describe("repository", () => {
  it("adds, lists, edits, lends, returns, and removes a book", () => {
    const repo = freshRepo();
    const book = repo.add({ title: "Dune", author: "Herbert", kind: "Novel" });
    expect(repo.list()).toHaveLength(1);

    const edited = repo.edit(book.id, { title: "Dune 2", author: "Herbert", kind: "Novel" });
    expect(edited.title).toBe("Dune 2");

    const lent = repo.lend(book.id, "Alice");
    expect(lent.borrower).toBe("Alice");
    expect(repo.list()[0].borrower).toBe("Alice");

    const returned = repo.returnBook(book.id);
    expect(returned.borrower).toBeNull();

    repo.remove(book.id);
    expect(repo.list()).toHaveLength(0);
  });

  it("returns an empty list when storage is empty or malformed", () => {
    const store = new MemoryStorage();
    store.setItem("book-tracker.books.v1", "{ not json");
    const repo = createBookRepository(store);
    expect(repo.list()).toEqual([]);
  });

  it("sanitizes malformed persisted books into safe entries", () => {
    const store = new MemoryStorage();
    store.setItem(
      "book-tracker.books.v1",
      JSON.stringify([
        { id: "x", title: "Old", author: "A", kind: "Novel", borrower: "  " },
        { id: "y", title: "Bad", author: "B", kind: "Mystery" },
        { title: "NoId", author: "C" },
        "garbage",
        null,
      ]),
    );
    const repo = createBookRepository(store);
    const books = repo.list();
    expect(books).toHaveLength(3);
    const ids = books.map((b) => b.id);
    expect(ids).toContain("x");
    expect(ids).toContain("y");
    const noId = books.find((b) => b.title === "NoId") as Book;
    expect(noId.id).toBeTruthy();
    expect(noId.kind).toBe("Other");
    const sanitized = books.find((b) => b.id === "y") as Book;
    expect(sanitized.kind).toBe("Other");
    const cleared = books.find((b) => b.id === "x") as Book;
    expect(cleared.borrower).toBeNull();
  });
});
