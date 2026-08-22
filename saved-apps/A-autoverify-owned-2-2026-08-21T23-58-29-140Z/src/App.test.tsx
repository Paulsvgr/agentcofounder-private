import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";
import { type Book, repairBooks } from "./domain/book.js";
import { createLocalStorageRepository, STORAGE_KEY } from "./storage/bookRepository.js";
import { createBookService } from "./services/bookService.js";

function seedBooks(books: Book[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function readBooks(): Book[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return repairBooks(JSON.parse(raw));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function setup() {
  return render(<App />);
}

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  category: string,
) {
  await user.type(screen.getByLabelText("Title"), title);
  await user.type(screen.getByLabelText("Author"), author);
  await user.selectOptions(screen.getByLabelText("Category"), category);
  await user.click(screen.getByRole("button", { name: "Add book" }));
}

describe("Bookshelf app", () => {
  it("adds a book and shows it in the list, surviving a refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = setup();

    await addBook(user, "The Hobbit", "J.R.R. Tolkien", "Novel");

    const list = await screen.findByRole("list", { name: "Book list" });
    expect(within(list).getByText("The Hobbit")).toBeInTheDocument();

    // Persisted to localStorage.
    const stored = readBooks();
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("The Hobbit");

    // A fresh mount (simulated page refresh) re-reads persisted data.
    unmount();
    setup();
    expect(await screen.findByText("The Hobbit")).toBeInTheDocument();
  });

  it("edits an existing book and updates the list", async () => {
    const user = userEvent.setup();
    seedBooks([
      { id: "b1", title: "Old Title", author: "Old Author", category: "Novel", borrower: "" },
    ]);
    setup();

    await screen.findByText("Old Title");
    await user.click(screen.getByRole("button", { name: "Edit Old Title" }));

    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("New Title")).toBeInTheDocument();
    expect(screen.queryByText("Old Title")).not.toBeInTheDocument();

    const stored = readBooks();
    expect(stored[0].title).toBe("New Title");
    expect(stored[0].author).toBe("Old Author");
  });

  it("deletes a book from the list and storage", async () => {
    const user = userEvent.setup();
    seedBooks([
      { id: "b1", title: "Gone Book", author: "Someone", category: "Cookbook", borrower: "" },
    ]);
    setup();

    await screen.findByText("Gone Book");
    await user.click(screen.getByRole("button", { name: "Delete Gone Book" }));

    expect(screen.queryByText("Gone Book")).not.toBeInTheDocument();
    expect(readBooks()).toHaveLength(0);
  });

  it("marks a book lent out, filters to out-only, then marks it returned", async () => {
    const user = userEvent.setup();
    seedBooks([
      { id: "b1", title: "Lendable Book", author: "Author A", category: "Novel", borrower: "" },
    ]);
    setup();

    await screen.findByText("Lendable Book");
    await user.type(screen.getByPlaceholderText("Borrower name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    expect(screen.getByText(/Out with/)).toBeInTheDocument();
    expect(screen.getByTestId("lend-count")).toHaveTextContent(/1 book is lent out/);

    await user.click(screen.getByRole("button", { name: "Currently out" }));
    const list = screen.getByRole("list", { name: "Book list" });
    expect(within(list).getByText("Lendable Book")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark Lendable Book as returned" }));

    // The returned book leaves the "out" filter; switch back to all to confirm.
    await user.click(screen.getByRole("button", { name: "All books" }));
    expect(screen.getByText("On the shelf")).toBeInTheDocument();
    expect(screen.getByTestId("lend-count")).toHaveTextContent(/0 books are lent out/);
    expect(readBooks()[0].borrower).toBe("");
  });

  it("rejects adding a book with empty fields and shows validation errors", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(await screen.findByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Author is required.")).toBeInTheDocument();
    expect(readBooks()).toHaveLength(0);
  });

  it("prevents lending out without a borrower name", async () => {
    const user = userEvent.setup();
    seedBooks([
      { id: "b1", title: "Untouchable", author: "A", category: "Novel", borrower: "" },
    ]);
    setup();

    await screen.findByText("Untouchable");
    await user.click(screen.getByRole("button", { name: "Lend out" }));
    expect(await screen.findByText("Enter a borrower's name.")).toBeInTheDocument();
    expect(readBooks()[0].borrower).toBe("");
  });

  it("recovers from malformed persisted data without crashing", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ wat: "nope" }, { id: "x" }]));
    expect(() => setup()).not.toThrow();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows the derived lent-out count for multiple books", () => {
    seedBooks([
      { id: "a", title: "A", author: "Au", category: "Novel", borrower: "Pat" },
      { id: "b", title: "B", author: "Au", category: "Cookbook", borrower: "Pat" },
      { id: "c", title: "C", author: "Au", category: "Reference", borrower: "" },
    ]);
    setup();
    expect(screen.getByTestId("lend-count")).toHaveTextContent(/2 books are lent out/);
  });
});

describe("BookService unit logic", () => {
  it("lending twice to the same book is blocked", () => {
    const repo = createLocalStorageRepository(window.localStorage);
    const service = createBookService(repo);
    service.addBook({ title: "T", author: "A", category: "Novel" });
    const id = service.listAll()[0].id;
    expect(service.lendBook(id, "Pat").ok).toBe(true);
    expect(service.lendBook(id, "Pat2").ok).toBe(false);
  });

  it("returning a book that is already home is idempotent", () => {
    const repo = createLocalStorageRepository(window.localStorage);
    const service = createBookService(repo);
    service.addBook({ title: "T", author: "A", category: "Novel" });
    const id = service.listAll()[0].id;
    service.returnBook(id);
    service.returnBook(id);
    expect(service.lendCount()).toBe(0);
  });
});
