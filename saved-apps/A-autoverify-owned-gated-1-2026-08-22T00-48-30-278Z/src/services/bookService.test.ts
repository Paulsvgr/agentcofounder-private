import { describe, it, expect, beforeEach } from "vitest";
import {
  createBookService,
  createPersistentBookService,
} from "./bookService";
import { createLocalStorageRepository } from "../data/bookRepository";
import type { Book } from "../types";

function seed(): Book[] {
  return [
    { id: "a", title: "Dune", author: "Frank Herbert", category: "Novel", borrower: null },
    { id: "b", title: "Joy of Cooking", author: "Rombauer", category: "Cookbook", borrower: "Mum" },
  ];
}

describe("BookService", () => {
  it("adds a valid book", () => {
    const s = createBookService([]);
    const result = s.add({
      title: "Dune",
      author: "Frank Herbert",
      category: "Novel",
    });
    expect(result.ok).toBe(true);
    expect(s.getAll()).toHaveLength(1);
  });

  it("rejects missing fields", () => {
    const s = createBookService([]);
    const result = s.add({ title: "", author: "", category: "Novel" });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate books", () => {
    const s = createBookService(seed());
    const result = s.add({
      title: "Dune",
      author: "Frank Herbert",
      category: "Novel",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already/i);
  });

  it("edits a book and blocks duplicate edits", () => {
    const s = createBookService(seed());
    const editResult = s.edit("a", {
      title: "Dune Messiah",
      author: "Frank Herbert",
      category: "Novel",
    });
    expect(editResult.ok).toBe(true);
    expect(s.getAll().find((b) => b.id === "a")?.title).toBe("Dune Messiah");

    // editing 'a' to match 'b' should fail
    const dup = s.edit("a", {
      title: "Joy of Cooking",
      author: "Rombauer",
      category: "Cookbook",
    });
    expect(dup.ok).toBe(false);
  });

  it("removes a book", () => {
    const s = createBookService(seed());
    expect(s.remove("a").ok).toBe(true);
    expect(s.getAll()).toHaveLength(1);
    expect(s.remove("missing").ok).toBe(false);
  });

  it("lends and returns a book", () => {
    const s = createBookService(seed());
    expect(s.lend("a", "Sue").ok).toBe(true);
    expect(s.getAll().find((b) => b.id === "a")?.borrower).toBe("Sue");
    expect(s.lend("a", "   ").ok).toBe(false);
    expect(s.returnLent("a").ok).toBe(true);
    expect(s.getAll().find((b) => b.id === "a")?.borrower).toBeNull();
  });
});

describe("persistent BookService", () => {
  it("persists mutations through the repository", () => {
    const repo = createLocalStorageRepository(
      typeof window !== "undefined" ? window.localStorage : undefined,
      "shelf-test-persist",
    );
    repo.save(seed());
    const s = createPersistentBookService(repo.load(), (b) => repo.save(b));
    s.add({ title: "New", author: "Person", category: "Other" });
    const reloaded = repo.load();
    expect(reloaded).toHaveLength(3);
  });
});
