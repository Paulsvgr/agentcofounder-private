import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";
import { InMemoryBookRepository, type BookRepository } from "./repository.js";
import type { Book } from "./types.js";

function makeRepo(initial: Book[] = []): BookRepository {
  const repo = new InMemoryBookRepository();
  repo.save(initial);
  return repo;
}

const book = (over: Partial<Book> = {}): Book => ({
  id: "b1",
  title: "The Pragmatic Programmer",
  author: "Hunt & Thomas",
  category: "Reference",
  borrower: "",
  ...over,
});

async function addBookViaForm(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
  categoryLabel: string,
) {
  await user.type(screen.getByLabelText("Book title"), title);
  await user.type(screen.getByLabelText("Book author"), author);
  await user.selectOptions(screen.getByLabelText("Book category"), categoryLabel);
  await user.click(screen.getByRole("button", { name: "Add book" }));
}

describe("Book Shelf app journeys", () => {
  it("shows an empty state and a zero lent-out count initially", () => {
    render(<App repository={makeRepo()} />);
    expect(
      screen.getByText(/0 books are lent out right now/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your shelf is empty/i)).toBeInTheDocument();
  });

  it("adds a book and shows it in the list with the derived lent-out count", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo()} />);

    await addBookViaForm(user, "The Hobbit", "Tolkien", "Novel");

    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText(/by Tolkien/i)).toBeInTheDocument();
    expect(screen.getAllByText("Novel").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/0 books are lent out right now/i),
    ).toBeInTheDocument();
  });

  it("rejects an empty title with an inline error and does not add", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo()} />);

    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(screen.getByText(/Your shelf is empty/i)).toBeInTheDocument();
  });

  it("lends a book out and updates the count, then returns it", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);

    await user.type(screen.getByLabelText("Borrower for The Pragmatic Programmer"), "Sam");
    await user.click(screen.getByRole("button", { name: /Lend The Pragmatic Programmer out/i }));

    expect(await screen.findByText(/Out with Sam/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1 book is lent out right now/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark The Pragmatic Programmer as returned/i }));
    expect(await screen.findByText("At home")).toBeInTheDocument();
    expect(
      screen.getByText(/0 books are lent out right now/i),
    ).toBeInTheDocument();
  });

  it("ignores an empty borrower name when lending", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);

    await user.click(screen.getByRole("button", { name: /Lend The Pragmatic Programmer out/i }));
    // No borrower entered -> still at home, count unchanged.
    expect(screen.getByText("At home")).toBeInTheDocument();
    expect(
      screen.getByText(/0 books are lent out right now/i),
    ).toBeInTheDocument();
  });

  it("filters to only books currently lent out", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={makeRepo([
          book({ id: "b1", title: "Home One" }),
          book({ id: "b2", title: "Out One", borrower: "Sam" }),
        ])}
      />,
    );

    expect(screen.getByText("Home One")).toBeInTheDocument();
    expect(screen.getByText("Out One")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Lent out/i }));

    expect(screen.queryByText("Home One")).not.toBeInTheDocument();
    expect(screen.getByText("Out One")).toBeInTheDocument();
    // The list heading shows the active filter and the filtered count.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /Lent out.*\(1\)/,
    );
  });

  it("edits an existing book and keeps its borrower", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo([book({ borrower: "Sam" })])} />);

    expect(screen.getByText(/Out with Sam/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit The Pragmatic Programmer/i }));
    const titleInput = screen.getByLabelText("Book title");
    await user.clear(titleInput);
    await user.type(titleInput, "The Pragmatic Programmer, 20th Anniversary");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("The Pragmatic Programmer, 20th Anniversary"),
    ).toBeInTheDocument();
    // Borrower is preserved across an edit.
    expect(screen.getByText(/Out with Sam/i)).toBeInTheDocument();
  });

  it("cancels editing without changing the book", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);

    await user.click(screen.getByRole("button", { name: /Edit The Pragmatic Programmer/i }));
    const titleInput = screen.getByLabelText("Book title");
    await user.clear(titleInput);
    await user.type(titleInput, "Wrong Title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.queryByText("Wrong Title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add book" }),
    ).toBeInTheDocument();
  });

  it("deletes a book after confirming", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);

    await user.click(screen.getByRole("button", { name: /Delete The Pragmatic Programmer/i }));

    expect(screen.queryByText("The Pragmatic Programmer")).not.toBeInTheDocument();
    expect(screen.getByText(/Your shelf is empty/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("keeps a book when the delete confirmation is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);

    await user.click(screen.getByRole("button", { name: /Delete The Pragmatic Programmer/i }));
    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("persists books to the repository so they survive a refresh", async () => {
    const repo = makeRepo([book()]);
    const user = userEvent.setup();
    const { unmount } = render(<App repository={repo} />);

    await user.type(screen.getByLabelText("Borrower for The Pragmatic Programmer"), "Sam");
    await user.click(screen.getByRole("button", { name: /Lend The Pragmatic Programmer out/i }));
    await waitFor(() => expect(screen.getByText(/Out with Sam/i)).toBeInTheDocument());

    // Simulate a refresh: unmount and remount with the same repository.
    unmount();
    render(<App repository={repo} />);

    await waitFor(() => expect(screen.getByText(/Out with Sam/i)).toBeInTheDocument());
    expect(
      screen.getByText(/1 book is lent out right now/i),
    ).toBeInTheDocument();
  });

  it("prevents duplicate-looking adds from clashing by giving each a fresh id", async () => {
    const repo = makeRepo();
    const user = userEvent.setup();
    render(<App repository={repo} />);

    await addBookViaForm(user, "Dup", "Auth", "Novel");
    await addBookViaForm(user, "Dup", "Auth", "Novel");

    const rows = screen.getAllByText("Dup");
    expect(rows).toHaveLength(2);
  });

  it("renders without crashing when storage load throws", () => {
    const broken: BookRepository = {
      load: () => {
        throw new Error("disk on fire");
      },
      save: () => {},
    };
    expect(() => render(<App repository={broken} />)).not.toThrow();
    expect(screen.getByText(/Your shelf is empty/i)).toBeInTheDocument();
  });

  it("does not throw when save fails after an add", async () => {
    const user = userEvent.setup();
    const broken: BookRepository = {
      load: () => [],
      save: () => {
        throw new Error("write protected");
      },
    };
    render(<App repository={broken} />);
    await user.type(screen.getByLabelText("Book title"), "Title");
    await user.type(screen.getByLabelText("Book author"), "Auth");
    await user.click(screen.getByRole("button", { name: "Add book" }));
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Title");
    expect(rows[0]).toHaveTextContent("Auth");
  });

  it("sorts books alphabetically by title", () => {
    render(
      <App
        repository={makeRepo([
          book({ id: "z", title: "Zebra" }),
          book({ id: "a", title: "Apple" }),
        ])}
      />,
    );
    const items = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".book-title")?.textContent ?? "");
    expect(items).toEqual(["Apple", "Zebra"]);
  });

  // Sanity that the helper for keyboard activation still works.
  it("can lend a book using the Enter key on the borrower field", async () => {
    const user = userEvent.setup();
    render(<App repository={makeRepo([book()])} />);
    const input = screen.getByLabelText("Borrower for The Pragmatic Programmer");
    await user.type(input, "Jordan{Enter}");
    expect(await screen.findByText(/Out with Jordan/i)).toBeInTheDocument();
  });
});
