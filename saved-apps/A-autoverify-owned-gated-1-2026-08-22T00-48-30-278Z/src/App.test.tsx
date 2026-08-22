import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import type { Book } from "./types";
import {
  createLocalStorageRepository,
} from "./data/bookRepository";

const KEY = "shelf-app-test";

function seed(books: Book[]) {
  window.localStorage.setItem(KEY, JSON.stringify(books));
}

function renderApp() {
  const repository = createLocalStorageRepository(window.localStorage, KEY);
  render(<App repository={repository} />);
}

function freshStorage() {
  window.localStorage.clear();
}

function getRows() {
  return screen.getAllByTestId("book-item");
}

describe("Book shelf journeys", () => {
  beforeEach(freshStorage);

  it("starts with an empty state", () => {
    renderApp();
    expect(
      screen.getByText(/No books yet. Add your first book above./i),
    ).toBeInTheDocument();
  });

  it("adds a book and shows it in the list", async () => {
    renderApp();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Book title"), "Dune");
    await user.type(screen.getByLabelText("Book author"), "Frank Herbert");
    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(
      await screen.findByText("Dune"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Frank Herbert/)).toBeInTheDocument();
    expect(screen.getByText("All 1 book on the shelf.")).toBeInTheDocument();
  });

  it("blocks adding a book without a title", async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });

  it("blocks duplicate books", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
    ]);
    renderApp();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Book title"), "Dune");
    await user.type(screen.getByLabelText("Book author"), "Frank Herbert");
    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(
      await screen.findByText(/already on your shelf/i),
    ).toBeInTheDocument();
    expect(getRows()).toHaveLength(1);
  });

  it("lends a book out and back", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
    ]);
    renderApp();
    const user = userEvent.setup();

    // Lend
    await user.click(screen.getByRole("button", { name: /Lend Dune out/i }));
    await user.type(
      screen.getByLabelText("Borrower name for Dune"),
      "Mum",
    );
    await user.click(screen.getByRole("button", { name: "Confirm lend" }));

    const row = await screen.findByTestId("book-item");
    expect(within(row).getByText("Mum")).toBeInTheDocument();
    expect(
      screen.getByText(/1 of 1 book lent out/),
    ).toBeInTheDocument();

    // Return
    await user.click(
      screen.getByRole("button", { name: /Mark Dune as returned/i }),
    );
    expect(
      await screen.findByText("All 1 book on the shelf."),
    ).toBeInTheDocument();
  });

  it("blocks lending without a borrower name", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
    ]);
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lend Dune out/i }));
    await user.click(screen.getByRole("button", { name: "Confirm lend" }));
    expect(
      await screen.findByText("Borrower name is required"),
    ).toBeInTheDocument();
  });

  it("edits a book", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
    ]);
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Edit Dune/i }));
    const editForm = screen.getByRole("form", { name: "Edit book" });
    const titleInput = within(editForm).getByLabelText("Book title");
    await user.clear(titleInput);
    await user.type(titleInput, "Dune Messiah");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Dune Messiah")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("removes a book added by mistake", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
      {
        id: "2",
        title: "Joy of Cooking",
        author: "Rombauer",
        category: "Cookbook",
        borrower: null,
      },
    ]);
    renderApp();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /Remove Joy of Cooking/i }),
    );
    expect(getRows()).toHaveLength(1);
    expect(screen.queryByText("Joy of Cooking")).not.toBeInTheDocument();
  });

  it("filters to only lent books", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
      {
        id: "2",
        title: "Joy of Cooking",
        author: "Rombauer",
        category: "Cookbook",
        borrower: "Dad",
      },
    ]);
    renderApp();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /^Lent out$/ }),
    );
    const rows = screen.getAllByTestId("book-item");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Joy of Cooking")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("persists across a refresh (component remount)", async () => {
    seed([
      {
        id: "1",
        title: "Dune",
        author: "Frank Herbert",
        category: "Novel",
        borrower: null,
      },
    ]);
    const repository = createLocalStorageRepository(window.localStorage, KEY);
    const { unmount } = render(<App repository={repository} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lend Dune out/i }));
    await user.type(
      screen.getByLabelText("Borrower name for Dune"),
      "Sue",
    );
    await user.click(screen.getByRole("button", { name: "Confirm lend" }));
    unmount();

    render(<App repository={repository} />);
    expect(
      await screen.findByText(/1 of 1 book lent out/),
    ).toBeInTheDocument();
    expect(screen.getByText("Sue")).toBeInTheDocument();
  });
});
