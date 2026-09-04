import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("Bookshelf app — critical journeys", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("adds a book and shows it in the all-books list", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/Your bookshelf is empty/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.type(screen.getByLabelText("Title"), "The Hobbit");
    await user.type(screen.getByLabelText("Author"), "J.R.R. Tolkien");
    // Category defaults to Fiction, which is fine.
    await user.click(screen.getByRole("button", { name: "Save book" }));

    expect(await screen.findByRole("heading", { name: "The Hobbit" })).toBeInTheDocument();
    expect(screen.getByText(/by J.R.R. Tolkien/i)).toBeInTheDocument();
    expect(screen.getByText("Fiction")).toBeInTheDocument();
  });

  it("lends a book, counts it as lent, and marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Add a book first
    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.type(screen.getByLabelText("Title"), "Dune");
    await user.type(screen.getByLabelText("Author"), "Frank Herbert");
    await user.click(screen.getByRole("button", { name: "Save book" }));

    // Lend it out
    const duneItem = await screen.findByRole("heading", { name: "Dune" });
    let row = duneItem.closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Lend out" }));
    await user.type(within(row).getByLabelText("Borrower's name"), "Sarah");
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    // Lent indicator + summary count
    expect(await screen.findByText(/Lent to Sarah/i)).toBeInTheDocument();

    // Switch to "Lent out" filter — should still show Dune
    await user.click(screen.getByRole("button", { name: /^Lent out/i }));
    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();

    // The status banner says one book lent out
    expect(screen.getByText(/1 book is currently lent out/i)).toBeInTheDocument();

    // Mark returned
    row = screen.getByRole("heading", { name: "Dune" }).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Mark returned" }));
    expect(screen.queryByText(/Lent to Sarah/i)).not.toBeInTheDocument();

    // "Lend out" button is back
    row = screen.getByRole("heading", { name: "Dune" }).closest("li")!;
    expect(within(row).getByRole("button", { name: "Lend out" })).toBeInTheDocument();

    // Lent count banner is gone, Lent-out filter is empty
    await user.click(screen.getByRole("button", { name: /^Lent out/i }));
    expect(screen.getByText(/No books are currently lent out/i)).toBeInTheDocument();
  });

  it("edits a book's title, author, and category", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.type(screen.getByLabelText("Title"), "Cooking Basics");
    await user.type(screen.getByLabelText("Author"), "Sam Cook");
    await user.click(screen.getByRole("button", { name: "Save book" }));

    const heading = await screen.findByRole("heading", { name: "Cooking Basics" });
    const row = heading.closest("li")!;

    await user.click(within(row).getByRole("button", { name: "Edit" }));

    const editForm = within(row).getByRole("form", { name: "Edit Cooking Basics" });
    const titleInput = within(editForm).getByLabelText("Title");
    const authorInput = within(editForm).getByLabelText("Author");
    const categorySelect = within(editForm).getByLabelText("Category");

    await user.clear(titleInput);
    await user.type(titleInput, "Mastering Cooking");
    await user.clear(authorInput);
    await user.type(authorInput, "Gordon Ramsay");
    await user.selectOptions(categorySelect, "Cookbook");
    await user.click(within(editForm).getByRole("button", { name: "Save changes" }));

    expect(await within(row).findByRole("heading", { name: "Mastering Cooking" })).toBeInTheDocument();
    expect(within(row).getByText(/by Gordon Ramsay/i)).toBeInTheDocument();
    expect(within(row).getByText("Cookbook")).toBeInTheDocument();
  });

  it("removes a book from the shelf", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.type(screen.getByLabelText("Title"), "ToDelete");
    await user.type(screen.getByLabelText("Author"), "Nobody");
    await user.click(screen.getByRole("button", { name: "Save book" }));

    expect(await screen.findByRole("heading", { name: "ToDelete" })).toBeInTheDocument();

    const row = screen.getByRole("heading", { name: "ToDelete" }).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Remove" }));

    expect(screen.queryByRole("heading", { name: "ToDelete" })).not.toBeInTheDocument();
  });

  it("persists books across re-mount (localStorage)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.type(screen.getByLabelText("Title"), "Persisted Book");
    await user.type(screen.getByLabelText("Author"), "Author Name");
    await user.click(screen.getByRole("button", { name: "Save book" }));

    unmount();

    // Re-mount simulates a page refresh — data should still be there
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Persisted Book" })).toBeInTheDocument();
    expect(screen.getByText(/by Author Name/i)).toBeInTheDocument();
  });

  it("does not add a book when title is missing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.type(screen.getByLabelText("Author"), "Some Author");
    await user.click(screen.getByRole("button", { name: "Save book" }));

    expect(await screen.findByText(/Please enter a title/i)).toBeInTheDocument();
    // Form stays open
    expect(screen.getByRole("button", { name: "Save book" })).toBeInTheDocument();
  });
});
