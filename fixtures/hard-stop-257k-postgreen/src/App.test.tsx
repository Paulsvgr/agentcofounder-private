import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  category?: string,
) {
  if (category) {
    await user.selectOptions(screen.getByLabelText(/category/i), category);
  }
  await user.type(screen.getByPlaceholderText(/e\.g\. the lord/i), title);
  await user.type(screen.getByPlaceholderText(/e\.g\. j\.r\.r/i), author);
  await user.click(screen.getByRole("button", { name: /add to shelf/i }));
}

describe("Bookshelf app", () => {
  it("adds books, edits a book, and deletes a book", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "The Pragmatic Programmer", "Hunt & Thomas", "Reference");
    await addBook(user, "Dune", "Frank Herbert", "Novel");

    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.getByText("Dune")).toBeInTheDocument();
    const summary = screen.getByLabelText(/bookshelf summary/i);
    expect(summary).toHaveTextContent("2 total books");
    expect(summary).toHaveTextContent("0 lent out now");

    // --- Edit ---
    await user.click(screen.getByRole("button", { name: /edit dune/i }));
    const titleInput = await screen.findByDisplayValue("Dune");
    await user.clear(titleInput);
    await user.type(titleInput, "Dune: Revised Edition");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Dune: Revised Edition")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();

    // --- Delete the revised book ---
    await user.click(screen.getByRole("button", { name: /delete dune/i }));

    expect(screen.queryByText("Dune: Revised Edition")).not.toBeInTheDocument();
    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.getByLabelText(/bookshelf summary/i)).toHaveTextContent("1 total books");
  });

  it("lends a book to someone, filters to lent-out, and marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Salt Fat Acid Heat", "Samin Nosrat", "Cookbook");

    expect(screen.getByLabelText(/bookshelf summary/i)).toHaveTextContent("0 lent out now");

    const bookItem = screen.getByText("Salt Fat Acid Heat").closest("li")!;

    // --- Lend it out ---
    await user.click(screen.getByRole("button", { name: /lend salt fat acid heat out/i }));
    await user.type(
      within(bookItem).getByPlaceholderText(/who is borrowing/i),
      "Sarah",
    );
    await user.click(within(bookItem).getByRole("button", { name: /^lend$/i }));

    // Borrower is shown — the "On loan to Sarah" paragraph
    expect(screen.getByText(/on loan to sarah/i)).toBeInTheDocument();

    // Summary updated
    const summary = screen.getByLabelText(/bookshelf summary/i);
    expect(summary).toHaveTextContent("1 lent out now");
    expect(summary).toHaveTextContent("0 at home");

    // --- Filter to lent-out only ---
    await user.click(screen.getByRole("button", { name: /lent out \(1\)/i }));
    expect(screen.getByText("Salt Fat Acid Heat")).toBeInTheDocument();

    // Add another book that is at home — it should NOT show in borrowed filter
    await addBook(user, "Sapiens", "Yuval Harari", "History");
    expect(screen.queryByText("Sapiens")).not.toBeInTheDocument();

    // --- Mark returned ---
    await user.click(screen.getByRole("button", { name: /mark salt fat acid heat returned/i }));

    expect(screen.queryByText(/on loan/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/bookshelf summary/i)).toHaveTextContent("0 lent out now");
  });

  it("persists books across a remount (localStorage)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await addBook(user, "The Odyssey", "Homer", "Poetry");
    unmount();

    render(<App />);
    expect(screen.getByText("The Odyssey")).toBeInTheDocument();
    expect(screen.getByLabelText(/bookshelf summary/i)).toHaveTextContent("1 total books");
  });

  it("does not add a book with empty title or author", async () => {
    const user = userEvent.setup();
    render(<App />);

    const addBtn = screen.getByRole("button", { name: /add to shelf/i });
    expect(addBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/e\.g\. the lord/i), "Title Only");
    expect(addBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/e\.g\. j\.r\.r/i), "Some Author");
    expect(addBtn).not.toBeDisabled();
  });
});
