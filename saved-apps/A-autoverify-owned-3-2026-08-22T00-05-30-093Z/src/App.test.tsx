import { describe, afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./App.js";
import { createRepository } from "./repository.js";
import { createBookService, type BookService } from "./service.js";

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

function makeService(): BookService {
  return createBookService(createRepository(makeMemoryStorage()));
}

function renderApp() {
  render(<App service={makeService()} />);
}

function addBook(title: string, author: string, category = "Novel") {
  fireEvent.change(screen.getByLabelText("Book title"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Book author"), {
    target: { value: author },
  });
  fireEvent.change(screen.getByLabelText("Book category"), {
    target: { value: category },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add book" }));
}

afterEach(() => {
  cleanup();
});

describe("Book shelf app", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows an empty state before any book is added", () => {
    renderApp();
    expect(
      screen.getByText(/Your bookshelf is empty/i),
    ).toBeInTheDocument();
  });

  it("adds a book and shows it in the collection", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien", "Novel");
    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText(/J.R.R. Tolkien/)).toBeInTheDocument();
    expect(screen.getByText(/· Novel/)).toBeInTheDocument();
    expect(screen.getByText(/On the shelf/i)).toBeInTheDocument();
  });

  it("rejects adding a book without a title or author", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));
    expect(
      screen.getByText(/Title and author are required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your bookshelf is empty/i),
    ).toBeInTheDocument();
  });

  it("edits an existing book", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien", "Novel");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Book title"), {
      target: { value: "The Lord of the Rings" },
    });
    fireEvent.change(screen.getByLabelText("Book category"), {
      target: { value: "Reference" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("The Lord of the Rings")).toBeInTheDocument();
    expect(screen.getByText(/· Reference/)).toBeInTheDocument();
    expect(screen.queryByText("The Hobbit")).not.toBeInTheDocument();
  });

  it("removes a book from the collection", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(
      screen.getByText(/Your bookshelf is empty/i),
    ).toBeInTheDocument();
  });

  it("lends a book to someone and marks it as lent", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien");
    fireEvent.click(screen.getByRole("button", { name: "Lend out" }));
    fireEvent.change(screen.getByLabelText("Borrower's name"), {
      target: { value: "Sue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lend" }));
    expect(screen.getByText(/Lent to Sue/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lend out" })).toBeNull();
  });

  it("clears the borrower when a book is returned", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien");
    fireEvent.click(screen.getByRole("button", { name: "Lend out" }));
    fireEvent.change(screen.getByLabelText("Borrower's name"), {
      target: { value: "Sue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lend" }));
    fireEvent.click(screen.getByRole("button", { name: "Returned" }));
    expect(screen.getByText(/On the shelf/i)).toBeInTheDocument();
    expect(screen.queryByText(/Lent to Sue/i)).toBeNull();
  });

  it("filters to only lent-out books", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien");
    addBook("Mastering the Art of French Cooking", "Julia Child", "Cookbook");
    // Lend the first book
    const items = screen.getAllByRole("listitem");
    fireEvent.click(within(items[0]).getByRole("button", { name: "Lend out" }));
    fireEvent.change(screen.getByLabelText("Borrower's name"), {
      target: { value: "Sue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lend" }));

    fireEvent.click(screen.getByRole("button", { name: "Lent out" }));
    const lentItems = screen.getAllByRole("listitem");
    expect(lentItems).toHaveLength(1);
    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(
      screen.queryByText("Mastering the Art of French Cooking"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the count of currently lent-out books", () => {
    renderApp();
    addBook("The Hobbit", "J.R.R. Tolkien");
    addBook("Cookbook A", "Author B", "Cookbook");
    expect(screen.getByText(/0 lent out/i)).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    fireEvent.click(within(items[0]).getByRole("button", { name: "Lend out" }));
    fireEvent.change(screen.getByLabelText("Borrower's name"), {
      target: { value: "Sue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lend" }));
    expect(screen.getByText(/1 lent out/i)).toBeInTheDocument();
  });

  it("persists books across a re-render simulating a page refresh", () => {
    const storage = makeMemoryStorage();
    const firstService = createBookService(createRepository(storage));
    render(<App service={firstService} />);
    addBook("The Hobbit", "J.R.R. Tolkien", "Novel");
    fireEvent.click(screen.getByRole("button", { name: "Lend out" }));
    fireEvent.change(screen.getByLabelText("Borrower's name"), {
      target: { value: "Sue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lend" }));

    // Simulate refresh: fresh service reading the same storage, fresh render
    cleanup();
    const reloadedService = createBookService(createRepository(storage));
    render(<App service={reloadedService} />);
    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText(/Lent to Sue/i)).toBeInTheDocument();
  });

  it("survives malformed persisted data without crashing", () => {
    localStorage.setItem("bookshelf.books.v1", "{not json");
    renderApp();
    expect(
      screen.getByText(/Your bookshelf is empty/i),
    ).toBeInTheDocument();
    addBook("The Hobbit", "J.R.R. Tolkien");
    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
  });
});
