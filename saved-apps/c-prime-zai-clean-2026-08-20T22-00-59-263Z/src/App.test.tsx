import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

beforeEach(() => {
  window.localStorage.clear();
});

async function fillAdd(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  category?: string,
) {
  await user.type(screen.getByLabelText("Book title"), title);
  await user.type(screen.getByLabelText("Book author"), author);
  if (category) {
    await user.selectOptions(screen.getByLabelText("Book category"), category);
  }
}

async function clickAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add book" }));
}

describe("Home Library", () => {
  it("adds a book and shows it in the list with the lent-out count at 0", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "Dune", "Frank Herbert", "novel");
    await clickAdd(user);

    const list = screen.getByTestId("book-list");
    expect(within(list).getByText("Dune")).toBeInTheDocument();
    expect(screen.getByTestId("out-count")).toHaveTextContent("0");
    expect(screen.getByTestId("summary")).toHaveTextContent("1 book");
  });

  it("rejects a book with empty fields and shows errors", async () => {
    const user = userEvent.setup();
    render(<App />);
    await clickAdd(user);
    expect(await screen.findByTestId("add-errors")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("lends a book out, then marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "The Joy of Cooking", "Rombauer", "cookbook");
    await clickAdd(user);

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText("Borrower name"), "Alice");
    await user.click(screen.getByRole("button", { name: "Mark lent out" }));

    expect(screen.getByTestId("out-badge")).toHaveTextContent(/Alice/);
    expect(screen.getByTestId("out-count")).toHaveTextContent("1");

    // Filter to just the out books.
    await user.click(screen.getByRole("button", { name: /^Out/ }));
    expect(screen.getAllByTestId("book-item")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    // After returning, switch back to All to see the on-shelf book.
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByTestId("in-badge")).toHaveTextContent("On shelf");
    expect(screen.getByTestId("out-count")).toHaveTextContent("0");
  });

  it("edits an existing book's title and category", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "Ref", "Author", "novel");
    await clickAdd(user);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const titleInput = screen.getByLabelText("Edit book title");
    await user.clear(titleInput);
    await user.type(titleInput, "Reference Handbook");
    await user.selectOptions(
      screen.getByLabelText("Edit book category"),
      "reference",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Reference Handbook")).toBeInTheDocument();
    const meta = screen.getByTestId(/^book-meta-/);
    expect(meta).toHaveTextContent("by Author · Reference");
  });

  it("deletes a book added by mistake", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "Mistake", "Me", "other");
    await clickAdd(user);
    expect(screen.getByText("Mistake")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Mistake" }));
    expect(screen.queryByText("Mistake")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("preserves books across a component re-mount (localStorage)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await fillAdd(user, "Persistent", "P. Author", "reference");
    await clickAdd(user);

    unmount();
    render(<App />);
    expect(screen.getByText("Persistent")).toBeInTheDocument();
  });

  it("shows an empty 'Out' state when filtering with nothing lent out", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "On Shelf", "Author", "novel");
    await clickAdd(user);

    await user.click(screen.getByRole("button", { name: /^Out/ }));
    expect(
      screen.getByText("No books are currently lent out."),
    ).toBeInTheDocument();
  });

  it("prevents lending with an empty borrower name", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillAdd(user, "A Book", "Author", "novel");
    await clickAdd(user);

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.click(screen.getByRole("button", { name: "Mark lent out" }));
    expect(screen.getByTestId("lend-error")).toBeInTheDocument();
  });
});
