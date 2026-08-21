import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";
import {
  createMemoryBookRepository,
  createLocalBookRepository,
  type BookRepository,
} from "./persistence/bookRepository.js";
import type { Book } from "./domain/book.js";

function freshRepository(): BookRepository {
  return createMemoryBookRepository([]);
}

function renderApp(repo?: BookRepository) {
  return render(<App repository={repo ?? freshRepository()} />);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Adding and listing books", () => {
  it("adds a book and shows it in the list with a derived total count", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByPlaceholderText(/Lord of the Rings/), "The Hobbit");
    await user.type(screen.getByPlaceholderText(/Tolkien/), "J. R. R. Tolkien");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    const item = await screen.findByText("The Hobbit");
    expect(item).toBeInTheDocument();
    expect(screen.getByText(/J\. R\. R\. Tolkien/)).toBeInTheDocument();

    // Derived count: one book total, zero lent out.
    const stat = screen.getByTestId("lent-count");
    expect(within(stat).getByText("0")).toBeInTheDocument();
    expect(within(stat).getByText(/lent out of 1/)).toBeInTheDocument();
  });

  it("shows an empty state before any book is added", () => {
    renderApp();
    expect(screen.getByText(/No books yet/)).toBeInTheDocument();
  });

  it("rejects a blank title and author instead of adding an empty book", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Author is required")).toBeInTheDocument();
    expect(screen.getByText(/No books yet/)).toBeInTheDocument();
  });
});

describe("Filtering the list", () => {
  it("shows all books by default and narrows to lent-out books", async () => {
    const user = userEvent.setup();
    renderApp();

    // Add two books.
    await addBook(user, "The Hobbit", "J. R. R. Tolkien");
    await addBook(user, "Garden Cookbook", "Alice Green");

    // Lend the second one.
    vi.spyOn(window, "prompt").mockReturnValue("Mum");
    await user.click(screen.getByRole("button", { name: /Lend Garden Cookbook/i }));

    expect(screen.getByText("Mum")).toBeInTheDocument();

    // Filter to lent out.
    await user.click(screen.getByLabelText(/Lent out/));

    expect(screen.getByText("Garden Cookbook")).toBeInTheDocument();
    expect(screen.queryByText("The Hobbit")).not.toBeInTheDocument();

    // Back to all.
    await user.click(screen.getByLabelText(/^All/));
    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText("Garden Cookbook")).toBeInTheDocument();
  });
});

describe("Lending and returning", () => {
  it("records a borrower and marks the book, then clears it when returned", async () => {
    const user = userEvent.setup();
    renderApp();

    await addBook(user, "The Hobbit", "J. R. R. Tolkien");

    vi.spyOn(window, "prompt").mockReturnValue("Dad");
    await user.click(screen.getByRole("button", { name: /Lend The Hobbit/i }));

    expect(screen.getByText(/Out with/)).toBeInTheDocument();
    expect(screen.getByText("Dad")).toBeInTheDocument();
    // Derived lent count updates.
    const stat = screen.getByTestId("lent-count");
    expect(within(stat).getByText("1")).toBeInTheDocument();

    // Return it.
    await user.click(screen.getByRole("button", { name: /Mark The Hobbit as returned/ }));
    expect(screen.getByText("On the shelf")).toBeInTheDocument();
    expect(within(stat).getByText("0")).toBeInTheDocument();
  });

  it("ignores a blank borrower name", async () => {
    const user = userEvent.setup();
    renderApp();

    await addBook(user, "The Hobbit", "J. R. R. Tolkien");

    vi.spyOn(window, "prompt").mockReturnValue("   ");
    await user.click(screen.getByRole("button", { name: /Lend The Hobbit/i }));

    expect(screen.getByText("On the shelf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark The Hobbit as returned/ })).not.toBeInTheDocument();
  });

  it("does nothing when the lend prompt is cancelled", async () => {
    const user = userEvent.setup();
    renderApp();

    await addBook(user, "The Hobbit", "J. R. R. Tolkien");

    vi.spyOn(window, "prompt").mockReturnValue(null);
    await user.click(screen.getByRole("button", { name: /Lend The Hobbit/i }));

    expect(screen.getByText("On the shelf")).toBeInTheDocument();
  });
});

describe("Editing and deleting", () => {
  it("edits an existing book's details", async () => {
    const user = userEvent.setup();
    renderApp();

    await addBook(user, "The Hobit", "Tolkien");

    await user.click(screen.getByRole("button", { name: /^Edit$/i }));
    const titleInput = screen.getByDisplayValue("The Hobit");
    await user.clear(titleInput);
    await user.type(titleInput, "The Hobbit");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.queryByText("The Hobit")).not.toBeInTheDocument();
  });

  it("deletes a book from the list", async () => {
    const user = userEvent.setup();
    renderApp();

    await addBook(user, "The Hobbit", "J. R. R. Tolkien");

    await user.click(screen.getByRole("button", { name: /Delete The Hobbit/i }));
    expect(screen.queryByText("The Hobbit")).not.toBeInTheDocument();
    expect(screen.getByText(/No books yet/)).toBeInTheDocument();
  });
});

describe("Persistence across refresh", () => {
  it("keeps books and borrow state when the repository is reloaded", async () => {
    const repo = createMemoryBookRepository();
    const { unmount } = render(<App repository={repo} />);

    const user = userEvent.setup();
    await addBook(user, "The Hobbit", "J. R. R. Tolkien");
    vi.spyOn(window, "prompt").mockReturnValue("Sister");
    await user.click(screen.getByRole("button", { name: /Lend The Hobbit/i }));

    // Simulate a refresh by unmounting and re-rendering against the same repo.
    unmount();
    render(<App repository={repo} />);

    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText("Sister")).toBeInTheDocument();
  });

  it("survives the built-in localStorage repository across a reload", async () => {
    const store = new MemoryStorage();
    const repo1 = createLocalBookRepositoryWith(store);
    const user = userEvent.setup();
    const { unmount } = render(<App repository={repo1} />);

    await addBook(user, "Garden Cookbook", "Alice Green");

    unmount();
    // New repository instance reading from the same simulated storage.
    render(<App repository={createLocalBookRepositoryWith(store)} />);

    expect(screen.getByText("Garden Cookbook")).toBeInTheDocument();
  });
});

// Helpers ------------------------------------------------------------------

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
) {
  const form = screen.getByRole("form", { name: "Add a book" });
  await user.type(within(form).getByPlaceholderText(/Lord of the Rings/), title);
  await user.type(within(form).getByPlaceholderText(/Tolkien/), author);
  await user.click(within(form).getByRole("button", { name: "Add book" }));
  await screen.findByText(title);
}

// A minimal Storage implementation for testing the localStorage repository.
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

function createLocalBookRepositoryWith(storage: Storage): BookRepository {
  return createLocalBookRepository(storage);
}

describe("Persisted data recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("drops malformed entries and keeps the good ones", () => {
    const store = new MemoryStorage();
    const good: Book = {
      id: "b1",
      title: "The Hobbit",
      author: "Tolkien",
      category: "Novel",
      borrower: null,
    };
    store.setItem(
      "bookshelf.books.v1",
      JSON.stringify([
        good,
        { id: "x", title: "", author: "nobody" }, // missing author becomes nobody; but title empty -> dropped
        "not-an-object",
        null,
      ]),
    );
    const repo = createLocalBookRepository(store);
    const loaded = repo.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe("The Hobbit");
  });

  it("recovers from corrupt JSON by returning an empty shelf", () => {
    const store = new MemoryStorage();
    store.setItem("bookshelf.books.v1", "{not valid json");
    const repo = createLocalBookRepository(store);
    expect(repo.load()).toEqual([]);
  });
});
