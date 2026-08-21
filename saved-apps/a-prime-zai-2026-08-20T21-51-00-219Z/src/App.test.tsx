import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import type { Book } from "./types";
import type { BookRepository } from "./repository";

function freshRepo(): BookRepository {
  let data: Book[] = [];
  return {
    load() {
      return data;
    },
    save(books: Book[]) {
      data = [...books];
    },
  };
}

describe("Book shelf user journeys", () => {
  let originalError: typeof console.error;
  beforeEach(() => {
    originalError = console.error;
    // Silence React act warnings from crypto.randomUUID in jsdom if any.
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? "");
      if (msg.includes("not wrapped in act")) return;
      originalError(...args as Parameters<typeof console.error>);
    };
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("adds a book, sees it in the list, and sees the count update", async () => {
    const user = userEvent.setup();
    render(<App repository={freshRepo()} />);

    await user.type(screen.getByLabelText("Book title"), "Dune");
    await user.type(screen.getByLabelText("Book author"), "Frank Herbert");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("by Frank Herbert")).toBeInTheDocument();
    expect(screen.getByTestId("out-count")).toHaveTextContent("0");
    expect(screen.getByText(/1 book tracked/)).toBeInTheDocument();
  });

  it("prevents adding a book without a title or author", async () => {
    const user = userEvent.setup();
    render(<App repository={freshRepo()} />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/required/i);
  });

  it("lends a book out, marks it returned, and the count changes", async () => {
    const user = userEvent.setup();
    render(<App repository={freshRepo()} />);

    await user.type(screen.getByLabelText("Book title"), "The Hobbit");
    await user.type(screen.getByLabelText("Book author"), "Tolkien");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText("Borrower name for The Hobbit"), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend" }));

    expect(screen.getByText(/Out with Sam/)).toBeInTheDocument();
    expect(screen.getByTestId("out-count")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    expect(screen.queryByText(/Out with Sam/)).not.toBeInTheDocument();
    expect(screen.getByTestId("out-count")).toHaveTextContent("0");
  });

  it("filters to only show books currently out with someone", async () => {
    const user = userEvent.setup();
    const repo = freshRepo();
    render(<App repository={repo} />);

    const add = async (title: string, author: string) => {
      await user.clear(screen.getByLabelText("Book title"));
      await user.clear(screen.getByLabelText("Book author"));
      await user.type(screen.getByLabelText("Book title"), title);
      await user.type(screen.getByLabelText("Book author"), author);
      await user.click(screen.getByRole("button", { name: "Add book" }));
    };

    await add("Book One", "Author A");
    await add("Book Two", "Author B");

    // Lend out Book Two
    const items = screen.getAllByRole("listitem");
    const second = items[1];
    await user.click(within(second).getByRole("button", { name: "Lend out" }));
    await user.type(
      within(second).getByLabelText("Borrower name for Book Two"),
      "Jo",
    );
    await user.click(within(second).getByRole("button", { name: "Lend" }));

    await user.click(screen.getByRole("button", { name: "Out with someone" }));

    expect(screen.getByText("Book Two")).toBeInTheDocument();
    expect(screen.queryByText("Book One")).not.toBeInTheDocument();
  });

  it("edits an existing book's details", async () => {
    const user = userEvent.setup();
    render(<App repository={freshRepo()} />);

    await user.type(screen.getByLabelText("Book title"), "Old Title");
    await user.type(screen.getByLabelText("Book author"), "Old Author");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const titleInput = screen.getByLabelText("Edit title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("New Title")).toBeInTheDocument();
    expect(screen.queryByText("Old Title")).not.toBeInTheDocument();
  });

  it("deletes a book added by mistake", async () => {
    const user = userEvent.setup();
    render(<App repository={freshRepo()} />);

    await user.type(screen.getByLabelText("Book title"), "Mistake");
    await user.type(screen.getByLabelText("Book author"), "Me");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Delete Mistake" }));

    expect(screen.queryByText("Mistake")).not.toBeInTheDocument();
    expect(screen.getByText(/No books here yet/)).toBeInTheDocument();
  });

  it("persists books across a refresh (re-reads from the repository)", async () => {
    const user = userEvent.setup();
    const repo = freshRepo();
    const { unmount } = render(<App repository={repo} />);

    await user.type(screen.getByLabelText("Book title"), "Persisted");
    await user.type(screen.getByLabelText("Book author"), "Writer");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    unmount();

    render(<App repository={repo} />);
    expect(screen.getByText("Persisted")).toBeInTheDocument();
  });

  it("shows an empty state and offers category selection", async () => {
    render(<App repository={freshRepo()} />);
    expect(screen.getByText(/No books here yet/)).toBeInTheDocument();
    // Cookbook category option exists
    const select = screen.getByLabelText("Book kind") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(
      Array.from(select.options).map((o) => o.value),
    ).toContain("Cookbook");
  });
});
