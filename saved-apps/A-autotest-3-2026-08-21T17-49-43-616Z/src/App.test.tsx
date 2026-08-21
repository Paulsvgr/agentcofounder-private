import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";
import {
  MemoryBookRepository,
  LocalBookRepository,
} from "./repository.js";
import { Bookshelf } from "./bookshelf.js";
import type { Book } from "./types.js";

/**
 * App reads from LocalBookRepository directly. For tests we control state via
 * localStorage (the same channel the app uses), clearing it before each test so
 * journeys are isolated.
 */
beforeEach(() => {
  window.localStorage.clear();
});

function freshShelf(): Bookshelf {
  return new Bookshelf(new MemoryBookRepository());
}

function seed(books: Book[]): void {
  new LocalBookRepository().saveAll(books);
}

describe("domain Bookshelf", () => {
  it("adds, edits, lends, returns, deletes and counts books", () => {
    const s = freshShelf();
    const b = s.add({ title: "Dune", author: "Frank Herbert", category: "Novel" });
    expect(s.list()).toHaveLength(1);

    s.update(b.id, { title: "Dune", author: "Frank Herbert", category: "Reference" });
    expect(s.list()[0].category).toBe("Reference");

    s.lend(b.id, "Alice");
    expect(s.lentCount()).toBe(1);
    expect(s.list()[0].borrower).toBe("Alice");

    s.returnBook(b.id);
    expect(s.lentCount()).toBe(0);
    expect(s.list()[0].borrower).toBeNull();

    expect(s.remove(b.id)).toBe(true);
    expect(s.list()).toHaveLength(0);
  });

  it("ignores invalid ids and duplicate removals", () => {
    const s = freshShelf();
    const b = s.add({ title: "X", author: "Y", category: "Novel" });
    expect(s.update("nope", { title: "a", author: "b", category: "Novel" })).toBeNull();
    expect(s.lend("nope", "Z")).toBeNull();
    expect(s.returnBook("nope")).toBeNull();
    expect(s.remove("nope")).toBe(false);
    expect(s.remove(b.id)).toBe(true);
    expect(s.remove(b.id)).toBe(false);
  });
});

describe("repository", () => {
  it("skips malformed persisted entries on load", () => {
    window.localStorage.setItem(
      "bookshelf.books.v1",
      JSON.stringify([{ id: 1 }, { title: "bad" }]),
    );
    expect(new LocalBookRepository().loadAll()).toEqual([]);
  });

  it("persists and reloads books across instances", () => {
    const book: Book = {
      id: "abc",
      title: "T",
      author: "A",
      category: "Novel",
      borrower: null,
    };
    new LocalBookRepository().saveAll([book]);
    const reloaded = new LocalBookRepository().loadAll();
    expect(reloaded).toEqual([book]);
  });
});

describe("App user journeys", () => {
  it("adds a book and shows it in the list with the lent-out count at zero", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/title/i), "The Pragmatic Programmer");
    await user.type(screen.getByLabelText(/author/i), "Hunt & Thomas");
    await user.selectOptions(screen.getByLabelText(/category/i), "Reference");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.getByText("1 book")).toBeInTheDocument();
    expect(screen.getByText("0 lent out")).toBeInTheDocument();
  });

  it("blocks adding a book without a title or author", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Author is required.")).toBeInTheDocument();
  });

  it("lends a book to someone, filters to lent-out, and returns it", async () => {
    const user = userEvent.setup();
    const b: Book = {
      id: "b1",
      title: "Moby-Dick",
      author: "Herman Melville",
      category: "Novel",
      borrower: null,
    };
    seed([b]);

    render(<App />);
    expect(await screen.findByText("Moby-Dick")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText(/borrower name/i), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend it out" }));

    expect(screen.getByText(/lent to/i)).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("1 lent out")).toBeInTheDocument();

    // Filter to lent-out only.
    await user.click(screen.getByLabelText("Lent out"));
    expect(screen.getByText("Moby-Dick")).toBeInTheDocument();
    expect(screen.queryByText("On the shelf")).not.toBeInTheDocument();

    // Return the book.
    await user.click(screen.getByRole("button", { name: "Returned" }));
    expect(screen.getByText("0 lent out")).toBeInTheDocument();
    // Under the lent-out filter the returned book is now hidden -> empty state.
    expect(screen.getByText(/no books here yet/i)).toBeInTheDocument();

    // Switch back to "All" to confirm the book is on the shelf again.
    await user.click(screen.getByLabelText("All"));
    expect(screen.getByText("On the shelf")).toBeInTheDocument();
  });

  it("blocks lending when borrower name is empty", async () => {
    const user = userEvent.setup();
    const b: Book = {
      id: "b2",
      title: "Cookbook A",
      author: "Chef B",
      category: "Cookbook",
      borrower: null,
    };
    seed([b]);

    render(<App />);
    await screen.findByText("Cookbook A");
    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.click(screen.getByRole("button", { name: "Lend it out" }));
    expect(screen.getByText("Enter who is borrowing this book.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("edits an existing book", async () => {
    const user = userEvent.setup();
    const b: Book = {
      id: "b3",
      title: "Old Title",
      author: "Old Author",
      category: "Novel",
      borrower: null,
    };
    seed([b]);

    render(<App />);
    await screen.findByText("Old Title");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: /edit book/i });
    const title = within(dialog).getByLabelText(/title/i);
    await user.clear(title);
    await user.type(title, "New Title");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("New Title")).toBeInTheDocument();
    expect(screen.queryByText("Old Title")).not.toBeInTheDocument();
  });

  it("deletes a book after confirming", async () => {
    const user = userEvent.setup();
    const b: Book = {
      id: "b4",
      title: "To Delete",
      author: "Author",
      category: "Poetry",
      borrower: null,
    };
    seed([b]);

    render(<App />);
    await screen.findByText("To Delete");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: /confirm delete/i });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
    expect(screen.getByText("0 books")).toBeInTheDocument();
  });

  it("cancels deleting a book", async () => {
    const user = userEvent.setup();
    const b: Book = {
      id: "b5",
      title: "Keep Me",
      author: "Author",
      category: "Novel",
      borrower: null,
    };
    seed([b]);

    render(<App />);
    await screen.findByText("Keep Me");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByText("Keep Me")).toBeInTheDocument();
  });

  it("preserves books across a refresh (re-mount)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.type(screen.getByLabelText(/title/i), "Persists");
    await user.type(screen.getByLabelText(/author/i), "Writer");
    await user.click(screen.getByRole("button", { name: "Add book" }));
    unmount();

    render(<App />);
    expect(await screen.findByText("Persists")).toBeInTheDocument();
  });

  it("sorts books by title alphabetically", async () => {
    const books: Book[] = [
      { id: "1", title: "Zebra", author: "A", category: "Novel", borrower: null },
      { id: "2", title: "Apple", author: "B", category: "Novel", borrower: null },
    ];
    seed(books);

    render(<App />);
    const list = await screen.findByRole("list", { name: /your books/i });
    const titles = within(list)
      .getAllByText(/^Zebra$|^Apple$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["Apple", "Zebra"]);
  });
});
