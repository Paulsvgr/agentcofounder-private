import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { App } from "./App.js";
import type { Book } from "../domain/book.js";
import type { BookRepository } from "../persistence/bookRepository.js";
import { createBookRepository } from "../persistence/bookRepository.js";

afterEach(() => {
  cleanup();
});

function makeStorage(store: Map<string, string>): Storage {
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

/** A minimal copy of useLibrary that saves to the provided repo. This keeps
 * the UI test exercising the real App + real repository, without needing the
 * global window/localStorage. */
function useLibrary(repo: BookRepository) {
  const [books, setBooks] = useState<Book[]>(() => repo.loadAll());
  const save = (next: Book[]) => {
    repo.saveAll(next);
    setBooks(next);
  };
  return [
    books,
    {
      addBook: (input: {
        title: string;
        author: string;
        category: Book["category"];
      }): Book => {
        const id = `b${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const book: Book = { ...input, id, borrower: null };
        save([...books, book]);
        return book;
      },
      updateBook: (
        id: string,
        input: { title: string; author: string; category: Book["category"] },
      ) => save(books.map((b) => (b.id === id ? { ...b, ...input } : b))),
      removeBook: (id: string) => save(books.filter((b) => b.id !== id)),
      lend: (id: string, borrower: string) =>
        save(
          books.map((b) =>
            b.id === id ? { ...b, borrower: borrower.trim() } : b,
          ),
        ),
      ret: (id: string) =>
        save(books.map((b) => (b.id === id ? { ...b, borrower: null } : b))),
    },
  ] as const;
}

function renderLibrary(store: Map<string, string>) {
  const repo = createBookRepository(makeStorage(store));
  const Harness = () => {
    const [books, api] = useLibrary(repo);
    return <App books={books} api={api} />;
  };
  return render(<Harness />);
}

async function addBook(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  author: string,
) {
  const addSection = screen.getByRole("heading", { name: "Add a book" })
    .closest("section") as HTMLElement;
  await user.type(within(addSection).getByLabelText(/title/i), title);
  await user.type(within(addSection).getByLabelText(/author/i), author);
  await user.click(within(addSection).getByRole("button", { name: "Add book" }));
}

describe("home library journeys", () => {
  it("adds a book and shows it in the collection", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);

    await addBook(user, "The Hobbit", "J.R.R. Tolkien");

    expect(screen.getByText("The Hobbit")).toBeInTheDocument();
    expect(screen.getByText("J.R.R. Tolkien")).toBeInTheDocument();
    expect(screen.getByTestId("lent-count")).toHaveTextContent("0");
  });

  it("rejects an empty add and shows an error", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);

    await user.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Author is required")).toBeInTheDocument();
  });

  it("lends a book, shows it as out, then returns it", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);

    await addBook(user, "Dune", "Herbert");

    await user.type(screen.getByLabelText(/borrower for/i), "Sam");
    await user.click(screen.getByRole("button", { name: "Lend Dune" }));

    expect(screen.getByTestId("lend-status")).toHaveTextContent(/out with sam/i);
    expect(screen.getByTestId("lent-count")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Return Dune" }));

    expect(screen.getByTestId("lend-status")).toHaveTextContent(/at home/i);
    expect(screen.getByTestId("lent-count")).toHaveTextContent("0");
  });

  it("filters to only lent-out books", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);

    await addBook(user, "Home Book", "A");
    await addBook(user, "Out Book", "B");

    const outRow = screen.getByText("Out Book").closest("li") as HTMLElement;
    await user.type(within(outRow).getByLabelText(/borrower for/i), "Merry");
    await user.click(within(outRow).getByRole("button", { name: "Lend Out Book" }));

    await user.click(
      screen.getAllByRole("button", { name: "Lent out" })[0],
    );

    expect(screen.getByText("Out Book")).toBeInTheDocument();
    expect(screen.queryByText("Home Book")).not.toBeInTheDocument();
  });

  it("edits a book to fix a mistake", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);

    await addBook(user, "Dune Typo", "Herbert");

    const row = screen.getByText("Dune Typo").closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Edit Dune Typo" }));

    const titleEdit = screen.getByDisplayValue("Dune Typo");
    await user.clear(titleEdit);
    await user.type(titleEdit, "Dune");
    await user.click(within(row).getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.queryByText("Dune Typo")).not.toBeInTheDocument();
  });

  it("deletes a book after confirming", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    renderLibrary(store);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    await addBook(user, "Delete Me", "Author");
    const row = screen.getByText("Delete Me").closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Delete Delete Me" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
  });

  it("preserves books across a page refresh", async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    const first = renderLibrary(store);

    await addBook(user, "Persistent", "Author");
    first.unmount();

    // Simulate a refresh: new repo over the same backing store.
    renderLibrary(store);
    expect(screen.getByText("Persistent")).toBeInTheDocument();
  });
});
