import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { localBookRepository } from "./storage";

function clearStorage() {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
}

async function fillAddBookForm(user: ReturnType<typeof userEvent.setup>, opts: {
  title: string;
  author: string;
  category?: string;
}) {
  await user.type(screen.getByRole("textbox", { name: /title/i }), opts.title);
  await user.type(screen.getByRole("textbox", { name: /author/i }), opts.author);
  if (opts.category) {
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), opts.category);
  }
  await user.click(screen.getByRole("button", { name: /add book/i }));
}

describe("My Book Shelf", () => {
  beforeEach(() => {
    clearStorage();
    localBookRepository.load(); // ensure repo is primed
  });
  afterEach(() => {
    cleanup();
    clearStorage();
  });

  it("adds a book and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/your shelf is empty/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "The Hobbit", author: "J.R.R. Tolkien", category: "Novel" });

    const list = screen.getByRole("list", { name: /books/i });
    expect(within(list).getByText(/the hobbit/i)).toBeInTheDocument();
    expect(within(list).getByText(/j.r.r. tolkien/i)).toBeInTheDocument();
    expect(within(list).getByText("Novel")).toBeInTheDocument();
    expect(within(list).getByText("On shelf")).toBeInTheDocument();
    expect(screen.queryByText(/your shelf is empty/i)).not.toBeInTheDocument();
  });

  it("rejects adding a book with empty title/author and shows validation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await user.click(screen.getByRole("button", { name: /add book/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/author is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/your shelf is empty/i)).toBeInTheDocument();
  });

  it("trims whitespace when adding a book", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "  Dune  ", author: "  Frank Herbert  " });

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText(/frank herbert/i)).toBeInTheDocument();
  });

  it("edits an existing book's details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert", category: "Novel" });

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const titleInput = screen.getByRole("textbox", { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, "Dune Messiah");
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "Reference");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByText("Dune Messiah")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
  });

  it("deletes a book after confirming", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByText(/your shelf is empty/i)).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("cancels deletion and keeps the book", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^keep$/i }));

    expect(screen.getByText("Dune")).toBeInTheDocument();
  });

  it("lends a book to someone and shows them as the borrower", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByRole("textbox", { name: /borrower name/i }), "Mum");
    await user.click(screen.getByRole("button", { name: /confirm loan/i }));

    expect(screen.getByText(/out: mum/i)).toBeInTheDocument();
    expect(screen.queryByText("On shelf")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lend out/i })).not.toBeInTheDocument();
  });

  it("marks a lent book as returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });
    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByRole("textbox", { name: /borrower name/i }), "Dad");
    await user.click(screen.getByRole("button", { name: /confirm loan/i }));

    await user.click(screen.getByRole("button", { name: /mark returned/i }));

    expect(screen.getByText("On shelf")).toBeInTheDocument();
    expect(screen.queryByText(/out: dad/i)).not.toBeInTheDocument();
  });

  it("prevents lending without a borrower name", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });
    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.click(screen.getByRole("button", { name: /confirm loan/i }));

    expect(screen.getByText(/borrower name is required/i)).toBeInTheDocument();
    // Still on the shelf, not lent out.
    expect(screen.getByText("On shelf")).toBeInTheDocument();
  });

  it("filters to only lent-out books", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "The Hobbit", author: "J.R.R. Tolkien" });
    // Lend out Dune.
    const rows = screen.getAllByRole("listitem");
    const duneRow = rows.find((r) => within(r).queryByText("Dune"));
    expect(duneRow).toBeTruthy();
    await user.click(within(duneRow!).getByRole("button", { name: /lend out/i }));
    await user.type(within(duneRow!).getByRole("textbox", { name: /borrower name/i }), "Mum");
    await user.click(within(duneRow!).getByRole("button", { name: /confirm loan/i }));

    await user.click(screen.getByRole("button", { name: /lent out/i }));

    const list = screen.getByRole("list", { name: /books/i });
    expect(within(list).getByText("Dune")).toBeInTheDocument();
    expect(within(list).queryByText("The Hobbit")).not.toBeInTheDocument();
  });

  it("shows an empty state for the lent-out filter when none are out", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    await user.click(screen.getByRole("button", { name: /lent out/i }));
    expect(screen.getByText(/no books are currently lent out/i)).toBeInTheDocument();
  });

  it("displays the count of currently lent-out books", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });

    expect(screen.getByTestId("lent-count")).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByRole("textbox", { name: /borrower name/i }), "Mum");
    await user.click(screen.getByRole("button", { name: /confirm loan/i }));

    expect(screen.getByTestId("lent-count")).toHaveTextContent("1");
  });

  it("persists books across a page refresh (remount)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: /add a book/i }));
    await fillAddBookForm(user, { title: "Dune", author: "Frank Herbert" });
    // Lend it out so we also confirm borrower survives.
    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByRole("textbox", { name: /borrower name/i }), "Mum");
    await user.click(screen.getByRole("button", { name: /confirm loan/i }));

    unmount();
    render(<App />); // simulate remount / refresh

    expect(await screen.findByText("Dune")).toBeInTheDocument();
    expect(screen.getByText(/out: mum/i)).toBeInTheDocument();
    expect(screen.getByTestId("lent-count")).toHaveTextContent("1");
  });

  it("recovers from malformed persisted data by dropping bad records", () => {
    // Seed corrupted + valid data directly into storage.
    window.localStorage.setItem(
      "book-tracker.books.v1",
      JSON.stringify([
        { id: "good", title: "Dune", author: "Frank Herbert", category: "Novel", borrower: null },
        { id: "bad", title: "", author: "x", category: "NotACategory", borrower: "y" },
        { category: "Novel" }, // missing fields
        "not-an-object",
        null,
      ]),
    );

    render(<App />);

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.queryByText("bad")).not.toBeInTheDocument();
    expect(screen.getByText(/1 book in your library/i)).toBeInTheDocument();
  });
});
