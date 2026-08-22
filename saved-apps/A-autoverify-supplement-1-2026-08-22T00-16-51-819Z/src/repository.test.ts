import { describe, expect, it } from "vitest";
import {
  InMemoryBookRepository,
  LocalStorageBookRepository,
  newId,
} from "./repository.js";
import type { Book } from "./types.js";

const sample = (over: Partial<Book> = {}): Book => ({
  id: "b1",
  title: "T",
  author: "A",
  category: "Novel",
  borrower: "",
  ...over,
});

describe("LocalStorageBookRepository", () => {
  function withStorage<T>(fn: (repo: LocalStorageBookRepository, write: (key: string, value: string) => void) => T): T {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      configurable: true,
    });
    const repo = new LocalStorageBookRepository("test-shelf");
    const write = (key: string, value: string) => fakeStorage.setItem(key, value);
    try {
      return fn(repo, write);
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  }

  it("returns an empty list when nothing is stored", () => {
    withStorage((repo) => {
      expect(repo.load()).toEqual([]);
    });
  });

  it("round-trips books through save and load", () => {
    withStorage((repo) => {
      const books = [sample(), sample({ id: "b2", borrower: "Sam" })];
      repo.save(books);
      expect(repo.load()).toEqual(books);
    });
  });

  it("discards malformed stored data instead of throwing", () => {
    withStorage((repo, write) => {
      write("test-shelf", "{ not json");
      expect(repo.load()).toEqual([]);
    });
  });

  it("discards stored data that is not a valid book list", () => {
    withStorage((repo, write) => {
      write("test-shelf", JSON.stringify([{ id: 1 }]));
      expect(repo.load()).toEqual([]);
    });
  });

  it("coerces a stale-but-shaped book into safe defaults", () => {
    withStorage((repo, write) => {
      write(
        "test-shelf",
        JSON.stringify([
          { id: "x", title: "T", author: "A", category: "Novel", borrower: null, extra: 1 },
        ]),
      );
      const loaded = repo.load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].borrower).toBe("");
    });
  });


  it("survives when storage is unavailable", () => {
    const repo = new LocalStorageBookRepository("test-shelf");
    // Simulate storage being absent (e.g. private mode) by removing window.localStorage.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(repo.load()).toEqual([]);
      expect(() => repo.save([sample()])).not.toThrow();
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("generates unique-ish ids", () => {
    const ids = new Set(Array.from({ length: 50 }, newId));
    expect(ids.size).toBe(50);
  });
});

describe("InMemoryBookRepository", () => {
  it("persists between load calls via save", () => {
    const repo = new InMemoryBookRepository();
    repo.save([sample()]);
    expect(repo.load()).toEqual([sample()]);
    // load returns copies, not the same reference
    expect(repo.load()).not.toBe(repo.load());
  });
});
