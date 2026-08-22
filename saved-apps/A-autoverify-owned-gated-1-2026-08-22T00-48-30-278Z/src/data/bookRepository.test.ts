import { describe, it, expect, beforeEach } from "vitest";
import { createLocalStorageRepository } from "./bookRepository";
import type { Book } from "../types";

function store() {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

const KEY = "shelf-test-repo";

const good: Book = {
  id: "1",
  title: "Dune",
  author: "Frank Herbert",
  category: "Novel",
  borrower: null,
};

describe("localStorage repository", () => {
  beforeEach(() => {
    store()?.removeItem(KEY);
  });

  it("returns empty list when nothing stored", () => {
    const repo = createLocalStorageRepository(store(), KEY);
    expect(repo.load()).toEqual([]);
  });

  it("round-trips books", () => {
    const repo = createLocalStorageRepository(store(), KEY);
    repo.save([good]);
    expect(repo.load()).toEqual([good]);
  });

  it("drops malformed entries silently", () => {
    store()?.setItem(KEY, JSON.stringify([{ junk: true }, good, "nope"]));
    const repo = createLocalStorageRepository(store(), KEY);
    expect(repo.load()).toEqual([good]);
  });

  it("returns empty list on malformed JSON", () => {
    store()?.setItem(KEY, "{not json");
    const repo = createLocalStorageRepository(store(), KEY);
    expect(repo.load()).toEqual([]);
  });

  it("survives when storage is unavailable", () => {
    const repo = createLocalStorageRepository(undefined, KEY);
    expect(repo.load()).toEqual([]);
    expect(() => repo.save([good])).not.toThrow();
  });
});
