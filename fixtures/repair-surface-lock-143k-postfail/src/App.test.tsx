import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
});

describe("Add a book", () => {
  it("adds a book to the shelf with title, author, and category", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Book title"), "The Great Gatsby");
    await user.type(screen.getByLabelText("Book author"), "F. Scott Fitzgerald");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    const list = screen.getByRole("list", { name: "Book list" });
    expect(within(list).getByText("The Great Gatsby")).toBeInTheDocument();
    expect(within(list).getByText("by F. Scott Fitzgerald")).toBeInTheDocument();
    expect(within(list).getByText("Fiction")).toBeInTheDocument();
  });

  it("shows an error when title or author is missing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter both a title and an author.",
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("can pick a different category", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Book title"), "Joy of Cooking");
    await user.type(screen.getByLabelText("Book author"), "Irma S. Rombauer");
    await user.selectOptions(screen.getByLabelText("Book category"), "Cookbook");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    const list = screen.getByRole("list", { name: "Book list" });
    expect(within(list).getByText("Cookbook")).toBeInTheDocument();
  });
});

describe("Edit and remove a book", () => {
  it("edits the title and author of an existing book", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Wrong Title", "Wrong Author", "Fiction");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const titleInput = screen.getAllByLabelText("Book title")[0];
    const authorInput = screen.getAllByLabelText("Book author")[0];
    await user.clear(titleInput);
    await user.type(titleInput, "Correct Title");
    await user.clear(authorInput);
    await user.type(authorInput, "Correct Author");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const list = screen.getByRole("list", { name: "Book list" });
    expect(within(list).getByText("Correct Title")).toBeInTheDocument();
    expect(within(list).getByText("by Correct Author")).toBeInTheDocument();
    expect(within(list).queryByText("Wrong Title")).not.toBeInTheDocument();
  });

  it("removes a book after confirming", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "To Delete", "Some Author", "Fiction");
    expect(screen.getByText("To Delete")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
  });

  it("can cancel removal", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Keep Me", "Some Author", "Fiction");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByText("Keep Me")).toBeInTheDocument();
  });
});

describe("Lend out and return", () => {
  it("marks a book as borrowed and shows the borrower name", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "The Hobbit", "J.R.R. Tolkien", "Fiction");

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText("Borrower name"), "Sarah");
    await user.click(screen.getByRole("button", { name: "Lend" }));

    expect(screen.getByText("Borrowed by Sarah")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lend out" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return" })).toBeInTheDocument();
  });

  it("returns a borrowed book home", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "The Hobbit", "J.R.R. Tolkien", "Fiction");
    await lendBook(user, "Sarah");

    await user.click(screen.getByRole("button", { name: "Return" }));

    expect(screen.queryByText("Borrowed by Sarah")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lend out" })).toBeInTheDocument();
  });
});

describe("View all, lent, and home", () => {
  it("shows all books by default and filters to lent / home", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Home Book", "Author A", "Fiction");
    await addBook(user, "Lent Book", "Author B", "Cookbook");
    await lendBook(user, "Alice");

    // All view shows both
    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("Home Book")).toBeInTheDocument();
    expect(screen.getByText("Lent Book")).toBeInTheDocument();

    // Lent view shows only the borrowed one
    await user.click(screen.getByRole("tab", { name: /Lent out/ }));
    expect(screen.queryByText("Home Book")).not.toBeInTheDocument();
    expect(screen.getByText("Lent Book")).toBeInTheDocument();

    // Home view shows only the home one
    await user.click(screen.getByRole("tab", { name: "At home" }));
    expect(screen.getByText("Home Book")).toBeInTheDocument();
    expect(screen.queryByText("Lent Book")).not.toBeInTheDocument();
  });

  it("shows an empty state when no books match the filter", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Home Book", "Author A", "Fiction");

    await user.click(screen.getByRole("tab", { name: /Lent out/ }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "No books are currently lent out.",
    );
  });
});

describe("Lent out count", () => {
  it("shows the count of lent out books in the header and tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Book One", "Author A", "Fiction");
    await addBook(user, "Book Two", "Author B", "Fiction");
    await addBook(user, "Book Three", "Author C", "Fiction");

    expect(screen.getByTestId("stat-lent-out")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-total")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-at-home")).toHaveTextContent("3");

    await lendBook(user, "Alice");
    await addBook(user, "Book Four", "Author D", "Fiction");
    await lendBook(user, "Bob");

    expect(screen.getByTestId("stat-lent-out")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-total")).toHaveTextContent("4");
    expect(screen.getByTestId("stat-at-home")).toHaveTextContent("2");

    expect(screen.getByRole("tab", { name: /Lent out/ })).toHaveTextContent(
      "Lent out (2)",
    );
  });
});

// --- Helpers ---

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  category: string,
) {
  await user.type(screen.getByLabelText("Book title"), title);
  await user.type(screen.getByLabelText("Book author"), author);
  await user.selectOptions(screen.getByLabelText("Book category"), category);
  await user.click(screen.getByRole("button", { name: "Add book" }));
}

async function lendBook(
  user: ReturnType<typeof userEvent.setup>,
  borrower: string,
) {
  await user.click(screen.getByRole("button", { name: "Lend out" }));
  await user.type(screen.getByLabelText("Borrower name"), borrower);
  await user.click(screen.getByRole("button", { name: "Lend" }));
}
