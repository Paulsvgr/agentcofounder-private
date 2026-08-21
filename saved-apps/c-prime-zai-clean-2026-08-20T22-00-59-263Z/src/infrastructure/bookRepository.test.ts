import { describe, it, expect, beforeEach } from "vitest";
import {
  LocalStorageBookRepository,
  InMemoryBookRepository,
} from "./bookRepository.js";
import { type Book } from "../domain/book.js";

describe("LocalStorageBookRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips books through localStorage", () => {
    const repo = new LocalStorageBookRepository("test.key");
    const books: Book[] = [
      {
        id: "b1",
        title: "Dune",
        author: "Herbert",
        category: "novel",
        borrowerName: "Alice",
        lentOn: "2024-01-02",
      },
      {
        id: "b2",
        title: "Ref",
        author: "Author",
        category: "reference",
        borrowerName: null,
        lentOn: null,
      },
    ];
    repo.saveAll(books);
    expect(repo.loadAll()).toEqual(books);
  });

  it("returns empty list when nothing stored", () => {
    const repo = new LocalStorageBookRepository("empty.key");
    expect(repo.loadAll()).toEqual([]);
  });

  it("drops malformed entries on load", () => {
    window.localStorage.setItem(
      "malformed.key",
      JSON.stringify([
        { id: "good", title: "T", author: "A", category: "novel" },
        { id: "bad", title: "" },
      ]),
    );
    const repo = new LocalStorageBookRepository("malformed.key");
    const loaded = repo.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("good");
  });

  it("returns empty when stored JSON is corrupt", () => {
    window.localStorage.setItem("bad.json", "{not json");
    const repo = new LocalStorageBookRepository("bad.json");
    expect(repo.loadAll()).toEqual([]);
  });
});

describe("InMemoryBookRepository", () => {
  it("stores and reloads books in memory", () => {
    const repo = new InMemoryBookRepository();
    const books: Book[] = [
      {
        id: "x",
        title: "T",
        author: "A",
        category: "cookbook",
        borrowerName: null,
        lentOn: null,
      },
    ];
    repo.saveAll(books);
    expect(repo.loadAll()).toEqual(books);
  });
});
