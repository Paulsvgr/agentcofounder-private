import { describe, it, expect, beforeEach } from "vitest";
import { createLocalBookRepository, STORAGE_KEY, countLentOut } from "./storage";
import type { Book } from "./types";
import { isLentOut } from "./repository";

function clearStorage() {
  localStorage.clear();
}

function seed(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

describe("BookRepository (localStorage-backed)", () => {
  beforeEach(() => clearStorage());

  it("starts empty with no stored data", () => {
    const repo = createLocalBookRepository();
    expect(repo.list()).toHaveLength(0);
  });

  it("adds a book that appears in the list", () => {
    const repo = createLocalBookRepository();
    const book = repo.add({ title: "The Hobbit", author: "Tolkien", category: "Novel" });
    expect(book.title).toBe("The Hobbit");
    expect(repo.list()).toHaveLength(1);
    expect(repo.list()[0].borrower).toBe("");
  });

  it("edits an existing book's details", () => {
    const repo = createLocalBookRepository();
    const book = repo.add({ title: "Draft", author: "A", category: "Novel" });
    repo.update(book.id, { title: "Final", author: "B", category: "Cookbook" });
    const updated = repo.list().find((b) => b.id === book.id)!;
    expect(updated.title).toBe("Final");
    expect(updated.author).toBe("B");
    expect(updated.category).toBe("Cookbook");
  });

  it("deletes a book added by mistake", () => {
    const repo = createLocalBookRepository();
    const book = repo.add({ title: "Mistake", author: "X", category: "Novel" });
    repo.remove(book.id);
    expect(repo.list()).toHaveLength(0);
  });

  it("lends a book out to someone and clears it on return", () => {
    const repo = createLocalBookRepository();
    const book = repo.add({ title: "Lent", author: "Y", category: "Novel" });
    repo.lend(book.id, "Sam");
    expect(isLentOut(repo.list()[0])).toBe(true);
    expect(repo.list()[0].borrower).toBe("Sam");
    repo.returnBook(book.id);
    expect(isLentOut(repo.list()[0])).toBe(false);
    expect(repo.list()[0].borrower).toBe("");
  });

  it("reports how many books are lent out", () => {
    const repo = createLocalBookRepository();
    const a = repo.add({ title: "A", author: "x", category: "Novel" });
    const b = repo.add({ title: "B", author: "y", category: "Cookbook" });
    repo.add({ title: "C", author: "z", category: "Reference" });
    repo.lend(a.id, "Sam");
    repo.lend(b.id, "Jo");
    expect(countLentOut(repo.list())).toBe(2);
  });

  it("persists and reloads books across a fresh repository instance (page refresh)", () => {
    const repo = createLocalBookRepository();
    const a = repo.add({ title: "Persisted", author: "P", category: "Novel" });
    repo.lend(a.id, "Sam");
    // Simulate a refresh by creating a new repository reading the same storage.
    const reloaded = createLocalBookRepository();
    const list = reloaded.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Persisted");
    expect(list[0].borrower).toBe("Sam");
  });

  it("recovers from malformed persisted data by returning an empty list", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const repo = createLocalBookRepository();
    expect(repo.list()).toEqual([]);
  });

  it("drops corrupted entries but keeps valid ones", () => {
    seed([
      { id: "1", title: "Good", author: "A", category: "Novel", borrower: "" },
      { garbage: true } as unknown as Book,
      { id: "2", title: "", author: "", category: "Novel", borrower: "" },
    ]);
    const repo = createLocalBookRepository();
    expect(repo.list()).toHaveLength(1);
    expect(repo.list()[0].title).toBe("Good");
  });

  it("normalises whitespace-only lenders so they are not counted as out", () => {
    const repo = createLocalBookRepository();
    const book = repo.add({ title: "X", author: "Y", category: "Novel" });
    repo.lend(book.id, "   ");
    // countLentOut trims, so whitespace-only borrowers are treated as at-home.
    expect(countLentOut(repo.list())).toBe(0);
  });
});
