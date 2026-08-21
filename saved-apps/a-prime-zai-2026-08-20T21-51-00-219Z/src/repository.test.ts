import { describe, expect, it } from "vitest";
import { createLocalBookRepository } from "./repository";
import { STORAGE_KEY } from "./domain";
import type { Book } from "./types";

function makeStore(): { store: Record<string, string>; storage: Storage } {
  const store: Record<string, string> = {};
  const storage: Storage = {
    get length() {
      return Object.keys(store).length;
    },
    key(i: number) {
      return Object.keys(store)[i] ?? null;
    },
    getItem(k: string) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k: string, v: string) {
      store[k] = String(v);
    },
    removeItem(k: string) {
      delete store[k];
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  return { store, storage };
}

describe("local book repository", () => {
  it("round-trips books through storage", () => {
    const { store, storage } = makeStore();
    const repo = createLocalBookRepository(storage);
    const book: Book = {
      id: "abc",
      title: "Dune",
      author: "Frank Herbert",
      category: "Novel",
      borrower: null,
    };
    repo.save([book]);
    expect(store[STORAGE_KEY]).toContain("Dune");
    expect(repo.load()).toEqual([book]);
  });

  it("returns empty list when storage is empty or corrupt", () => {
    const { storage } = makeStore();
    const repo = createLocalBookRepository(storage);
    expect(repo.load()).toEqual([]);
    storage.setItem(STORAGE_KEY, "{not json");
    expect(repo.load()).toEqual([]);
  });
});
