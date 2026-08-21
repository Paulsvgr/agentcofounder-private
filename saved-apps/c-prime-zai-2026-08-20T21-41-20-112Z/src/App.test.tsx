import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

const STORAGE_KEY = "book-shelf.books.v1";

describe("Book shelf user journeys", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a book, lists it, and counts lent out as zero", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));

    await user.type(screen.getByLabelText(/title/i), "Moby Dick");
    await user.type(screen.getByLabelText(/author/i), "Herman Melville");
    await user.selectOptions(screen.getByLabelText(/kind of book/i), "novel");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));

    expect(
      await screen.findByText("No books are lent out right now."),
    ).toBeInTheDocument();

    const list = screen.getByRole("list", { name: /books on my shelf/i });
    expect(within(list).getByText("Moby Dick")).toBeInTheDocument();
    expect(within(list).getByText("by Herman Melville")).toBeInTheDocument();
  });

  it("prevents adding a book without a title", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/author/i), "Someone");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("lends a book, shows it as out, and updates the lent-out count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/title/i), "Cookbook");
    await user.type(screen.getByLabelText(/author/i), "Chef");
    await user.selectOptions(screen.getByLabelText(/kind of book/i), "cookbook");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));

    await user.click(
      await screen.findByRole("button", { name: /lend cookbook/i }),
    );
    await user.type(screen.getByLabelText(/borrower name/i), "Mum");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("1 book currently lent out."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Out with Mum")).toBeInTheDocument();
  });

  it("returns a lent book and clears the borrower", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/title/i), "Ref Book");
    await user.type(screen.getByLabelText(/author/i), "Scholar");
    await user.selectOptions(screen.getByLabelText(/kind of book/i), "reference");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));

    await user.click(
      await screen.findByRole("button", { name: /lend ref book/i }),
    );
    await user.type(screen.getByLabelText(/borrower name/i), "Dad");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByText("1 book currently lent out.");
    await user.click(
      await screen.findByRole("button", { name: /mark ref book as returned/i }),
    );

    expect(
      await screen.findByText("No books are lent out right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("On the shelf")).toBeInTheDocument();
  });

  it("filters to only the currently out books", async () => {
    const user = userEvent.setup();
    render(<App />);

    const addBook = async (title: string, author: string, category: string) => {
      await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
      await user.type(screen.getByLabelText(/title/i), title);
      await user.type(screen.getByLabelText(/author/i), author);
      await user.selectOptions(screen.getByLabelText(/kind of book/i), category);
      await user.click(screen.getByRole("button", { name: /^add book$/i }));
      await screen.findByText(title);
    };

    await addBook("Home Book", "H", "novel");
    await addBook("Out Book", "O", "novel");

    await user.click(await screen.findByRole("button", { name: /lend out book/i }));
    await user.type(screen.getByLabelText(/borrower name/i), "Mum");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText("1 book currently lent out.");

    await user.click(screen.getByLabelText(/currently out/i));

    const list = screen.getByRole("list", { name: /books on my shelf/i });
    expect(within(list).getByText("Out Book")).toBeInTheDocument();
    expect(within(list).queryByText("Home Book")).not.toBeInTheDocument();
  });

  it("edits an existing book's details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/title/i), "Old Title");
    await user.type(screen.getByLabelText(/author/i), "Old Author");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));
    await screen.findByText("Old Title");

    await user.click(screen.getByRole("button", { name: /edit old title/i }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("New Title")).toBeInTheDocument();
    expect(screen.queryByText("Old Title")).not.toBeInTheDocument();
  });

  it("deletes a book from the shelf", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/title/i), "To Delete");
    await user.type(screen.getByLabelText(/author/i), "Author");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));
    await screen.findByText("To Delete");

    await user.click(screen.getByRole("button", { name: /delete to delete/i }));

    expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
  });

  it("persists books across a page refresh (component reload)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(await screen.findByRole("button", { name: /add a book to the shelf/i }));
    await user.type(screen.getByLabelText(/title/i), "Persistent");
    await user.type(screen.getByLabelText(/author/i), "Author");
    await user.selectOptions(screen.getByLabelText(/kind of book/i), "novel");
    await user.click(screen.getByRole("button", { name: /^add book$/i }));
    await screen.findByText("Persistent");

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]")).toHaveLength(1);

    unmount();
    render(<App />);

    expect(await screen.findByText("Persistent")).toBeInTheDocument();
  });
});
