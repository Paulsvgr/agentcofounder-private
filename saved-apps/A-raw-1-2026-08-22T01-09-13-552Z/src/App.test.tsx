import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => {
  window.localStorage.clear();
});

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  kind: string,
) {
  await user.click(await screen.findByRole("button", { name: /add a book/i }));
  await user.type(screen.getByRole("textbox", { name: /^title$/i }), title);
  await user.type(screen.getByRole("textbox", { name: /^author$/i }), author);
  await user.selectOptions(screen.getByRole("combobox", { name: /^kind$/i }), kind);
  await user.click(screen.getByRole("button", { name: /add book/i }));
}

function rowFor(title: string) {
  return screen.getByText(title).closest("li")!;
}

describe("Book lending tracker user journeys", () => {
  it("adds a book and shows it in the collection, surviving a refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await addBook(user, "The Hobbit", "J.R.R. Tolkien", "Novel");

    expect(await screen.findByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText(/by J.R.R. Tolkien/i)).toBeInTheDocument();
    expect(screen.getByText("Novel")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toHaveTextContent("1 book in total");
    expect(screen.getByTestId("lent-count")).toHaveTextContent("0");

    // Data persisted in localStorage and reloaded on a fresh mount (simulated refresh)
    const stored = window.localStorage.getItem("book-tracker.books.v1");
    expect(stored).toContain("The Hobbit");
    unmount();
    render(<App />);
    expect(await screen.findByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toHaveTextContent("1 book in total");
  });

  it("lends a book out, filters to Lent out, then marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Dune", "Frank Herbert", "Novel");
    const row = rowFor("Dune");

    await user.type(within(row).getByPlaceholderText(/borrower name/i), "Alice");
    await user.click(within(row).getByRole("button", { name: /lend out/i }));

    expect(within(row).getByTestId("book-status")).toHaveTextContent(/lent to Alice/i);
    expect(screen.getByTestId("lent-count")).toHaveTextContent("1");

    // Switch to Lent out filter; the book is still listed, "All" returns it too
    await user.click(screen.getByLabelText("Lent out"));
    expect(
      await within(screen.getByRole("list", { name: /books/i })).findByText("Dune"),
    ).toBeInTheDocument();

    // Return it while still on Lent out filter (book disappears from this filter)
    await user.click(
      within(rowFor("Dune")).getByRole("button", { name: /mark returned/i }),
    );
    expect(screen.getByTestId("lent-count")).toHaveTextContent("0");

    // Switching back to All shows the book at home again
    await user.click(screen.getByLabelText("All"));
    const homeRow = rowFor("Dune");
    expect(within(homeRow).getByTestId("book-status")).toHaveTextContent(/at home/i);
  });

  it("edits an existing book's details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Dune", "Frank Herbert", "Novel");
    const row = rowFor("Dune");
    await user.click(within(row).getByRole("button", { name: /edit/i }));

    const titleField = screen.getByRole("textbox", { name: /^title$/i }) as HTMLInputElement;
    await user.clear(titleField);
    await user.type(titleField, "Dune: Revised");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Dune: Revised")).toBeInTheDocument();
    expect(screen.queryByText(/^Dune$/)).not.toBeInTheDocument();
  });

  it("removes a book from the collection with confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Temporary", "Some Author", "Reference");
    expect(await screen.findByText("Temporary")).toBeInTheDocument();

    const row = rowFor("Temporary");
    await user.click(within(row).getByRole("button", { name: /remove/i }));
    await user.click(within(row).getByRole("button", { name: /yes, remove/i }));

    expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
    expect(screen.getByTestId("summary")).toHaveTextContent("0 books in total");
  });

  it("blocks adding a book with blank fields and shows validation errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await user.click(screen.getByRole("button", { name: /add book/i }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(await screen.findByText("Author is required")).toBeInTheDocument();
    expect(screen.queryByText(/The Hobbit|Dune/i)).not.toBeInTheDocument();
  });

  it("prevents lending the same book twice and trims borrower input", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addBook(user, "Cookbook 1", "Chef", "Cookbook");
    const row = rowFor("Cookbook 1");
    await user.type(within(row).getByPlaceholderText(/borrower name/i), "  Alice  ");
    await user.click(within(row).getByRole("button", { name: /lend out/i }));

    expect(within(row).getByTestId("book-status")).toHaveTextContent(/lent to Alice/i);
    // While lent out, there is no lend form to lend again
    expect(within(row).queryByPlaceholderText(/borrower name/i)).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no books", () => {
    render(<App />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(/no books yet/i);
  });
});
