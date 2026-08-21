import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

function booksList() {
  return screen.getByRole("list", { name: "Books" });
}

describe("Home Library app", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("adds a book and shows it in the all-books list with an updated count", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/haven't added any books yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "The Hobbit");
    await user.type(screen.getByLabelText("Author"), "Tolkien");
    await user.selectOptions(screen.getByLabelText("Category"), "Novel");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText(/by Tolkien/)).toBeInTheDocument();
    expect(within(booksList()).getByText(/^At home$/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 1 book currently lent out/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("home-library.books.v1") !== null).toBe(true);
  });

  it("blocks adding a book without a title and shows an error", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Author"), "Tolkien");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.queryByText(/by Tolkien/)).not.toBeInTheDocument();
  });

  it("lends a book to someone, then marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Title"), "Kitchen Confidential");
    await user.type(screen.getByLabelText("Author"), "Bourdain");
    await user.selectOptions(screen.getByLabelText("Category"), "Cookbook");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText("Borrowed by"), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    expect(screen.getByText(/Lent to Sam/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 book currently lent out/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lend out" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    expect(within(booksList()).getByText(/^At home$/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 1 book currently lent out/i)).toBeInTheDocument();
  });

  it("requires a borrower name before lending", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Title"), "Ref Book");
    await user.type(screen.getByLabelText("Author"), "Author");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.click(screen.getByRole("button", { name: "Lend out" }));
    expect(screen.getByText("Enter who has the book")).toBeInTheDocument();
    expect(within(booksList()).getByText(/^At home$/)).toBeInTheDocument();
  });

  it("filters to only books currently lent out", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Title"), "Novel One");
    await user.type(screen.getByLabelText("Author"), "Author A");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.type(screen.getByLabelText("Title"), "Ref Book");
    await user.type(screen.getByLabelText("Author"), "Author B");
    await user.selectOptions(screen.getByLabelText("Category"), "Reference");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    // Lend only the Reference book.
    const lendButtons = screen.getAllByRole("button", { name: "Lend out" });
    await user.click(lendButtons[1]);
    await user.type(screen.getByLabelText("Borrowed by"), "Lee");
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    await user.click(screen.getByRole("radio", { name: "Lent out" }));
    let list = booksList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Ref Book")).toBeInTheDocument();
    expect(within(list).queryByText("Novel One")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "At home" }));
    list = booksList();
    expect(within(list).getByText("Novel One")).toBeInTheDocument();
    expect(within(list).queryByText("Ref Book")).not.toBeInTheDocument();
  });

  it("edits a book's title, author and category", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Title"), "Old Title");
    await user.type(screen.getByLabelText("Author"), "Old Author");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const titleInput = screen.getByDisplayValue("Old Title");
    const authorInput = screen.getByDisplayValue("Old Author");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.clear(authorInput);
    await user.type(authorInput, "New Author");
    await user.selectOptions(screen.getByLabelText("Category"), "Reference");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("New Title")).toBeInTheDocument();
    expect(screen.getByText(/by New Author/)).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
    expect(screen.queryByText("Old Title")).not.toBeInTheDocument();
  });

  it("deletes a book after confirming", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Title"), "Gone Soon");
    await user.type(screen.getByLabelText("Author"), "Someone");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Remove "Gone Soon"/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(screen.queryByText("Gone Soon")).not.toBeInTheDocument();
    expect(screen.getByText(/haven't added any books yet/i)).toBeInTheDocument();
  });

  it("keeps books after a refresh by reading from localStorage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.type(screen.getByLabelText("Title"), "Persisted Book");
    await user.type(screen.getByLabelText("Author"), "Persisting");
    await user.selectOptions(screen.getByLabelText("Category"), "Biography");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    // Simulate a page refresh: drop React state and remount from storage.
    unmount();
    render(<App />);

    expect(await screen.findByText("Persisted Book")).toBeInTheDocument();
    expect(screen.getByText(/by Persisting/)).toBeInTheDocument();
    expect(screen.getByText("Biography")).toBeInTheDocument();
    expect(within(booksList()).getByText(/^At home$/)).toBeInTheDocument();
  });

  it("keeps the loan on a previously lent book when remounted", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.type(screen.getByLabelText("Title"), "Loaned Book");
    await user.type(screen.getByLabelText("Author"), "Author");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    await user.click(screen.getByRole("button", { name: "Lend out" }));
    await user.type(screen.getByLabelText("Borrowed by"), "Dana");
    await user.click(screen.getByRole("button", { name: "Lend out" }));

    unmount();
    render(<App />);

    expect(await screen.findByText(/Lent to Dana/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 book currently lent out/i)).toBeInTheDocument();
  });
});
