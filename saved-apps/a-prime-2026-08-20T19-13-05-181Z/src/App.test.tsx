import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

afterEach(() => {
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

function form() {
  return within(screen.getByRole("form", { name: "Book details" }));
}

async function fillBook(
  user: ReturnType<typeof userEvent.setup>,
  overrides: { title?: string; author?: string; category?: string } = {},
) {
  await user.type(form().getByLabelText("Title"), overrides.title ?? "Dune");
  await user.type(form().getByLabelText("Author"), overrides.author ?? "Frank Herbert");
  if (overrides.category) {
    await user.selectOptions(form().getByLabelText("Category"), overrides.category);
  }
}

describe("home library user journeys", () => {
  it("adds a book and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user);
    await user.click(screen.getByRole("button", { name: "Add book" }));

    const list = screen.getByRole("list", { name: "Books" });
    expect(within(list).getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(within(list).getByText(/by Frank Herbert/)).toBeInTheDocument();
    expect(within(list).getByText("Novel")).toBeInTheDocument();
  });

  it("blocks adding a book with empty title or author", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Author is required")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Books" })).toBeNull();
  });

  it("edits a book to fix a mistake", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user, { title: "Dune", author: "Author X" });
    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const titleInput = form().getByLabelText("Title") as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "Dune Messiah");
    await user.selectOptions(form().getByLabelText("Category"), "Reference");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const list = screen.getByRole("list", { name: "Books" });
    expect(within(list).getByText("Dune Messiah")).toBeInTheDocument();
    expect(within(list).queryByText("Dune")).toBeNull();
    expect(within(list).getByText("Reference")).toBeInTheDocument();
  });

  it("deletes a book from the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user);
    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.click(screen.getByRole("button", { name: "Delete Dune" }));

    expect(screen.getByText(/No books match this view/)).toBeInTheDocument();
  });

  it("lends a book out and marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user);
    await user.click(screen.getByRole("button", { name: "Add book" }));

    // Lend out
    await user.type(screen.getByPlaceholderText("Borrower's name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    const list = screen.getByRole("list", { name: "Books" });
    expect(within(list).getByText(/On loan to/)).toBeInTheDocument();
    expect(within(list).getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("1 of 1 lent out")).toBeInTheDocument();

    // Mark returned
    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    expect(within(list).getByText("On the shelf")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 lent out")).toBeInTheDocument();
  });

  it("does not lend out without a borrower name", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user);
    await user.click(screen.getByRole("button", { name: "Add book" }));
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    expect(screen.getByText("Enter who is borrowing the book")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 lent out")).toBeInTheDocument();
  });

  it("narrows to just the lent-out books", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user, { title: "On the shelf", author: "A" });
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await fillBook(user, { title: "Lent one", author: "B", category: "Cookbook" });
    await user.click(screen.getByRole("button", { name: "Add book" }));
    const lentItem = screen.getByRole("listitem", { name: /Lent one/ });
    await user.type(within(lentItem).getByPlaceholderText("Borrower's name"), "Pat");
    await user.click(within(lentItem).getByRole("button", { name: "Lend out" }));

    await user.selectOptions(screen.getByLabelText("Status"), "lent");

    const list = screen.getByRole("list", { name: "Books" });
    expect(within(list).getByText("Lent one")).toBeInTheDocument();
    expect(within(list).queryByText("On the shelf")).toBeNull();
    expect(screen.getByText("1 of 2 lent out")).toBeInTheDocument();
  });

  it("narrows by category using the shelf filter", async () => {
    const user = userEvent.setup();
    render(<App />);

    await fillBook(user, { title: "Novel A", author: "A", category: "Novel" });
    await user.click(screen.getByRole("button", { name: "Add book" }));
    await fillBook(user, { title: "Recipe Book", author: "B", category: "Cookbook" });
    await user.click(screen.getByRole("button", { name: "Add book" }));

    const shelf = screen.getByLabelText("Category", { selector: "#category-filter" });
    await user.selectOptions(shelf, "Cookbook");

    const list = screen.getByRole("list", { name: "Books" });
    expect(within(list).getByText("Recipe Book")).toBeInTheDocument();
    expect(within(list).queryByText("Novel A")).toBeNull();
  });
});

describe("persistence", () => {
  it("preserves books across a page refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await fillBook(user, { title: "Persists", author: "Across Reload" });
    await user.click(screen.getByRole("button", { name: "Add book" }));

    // Simulate a browser refresh: drop the React tree and mount again.
    unmount();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Persists" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 1 lent out")).toBeInTheDocument();
  });
});
