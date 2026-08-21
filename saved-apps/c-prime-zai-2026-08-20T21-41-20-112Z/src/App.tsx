import { useMemo, useState } from "react";
import { BookForm, LendForm } from "./BookForm.js";
import { BookList } from "./BookList.js";
import {
  countLentOut,
  createBook,
  lendBook,
  returnBook,
} from "./domain.js";
import { createLocalStorageRepository } from "./persistence.js";
import { useLocalRepositoryState } from "./usePersistentState.js";
import type { Book } from "./types.js";

type Filter = "all" | "lent-out";

type Modal =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; book: Book }
  | { kind: "lend"; book: Book };

const repository = createLocalStorageRepository();

export const App = () => {
  const [books, setBooks] = useLocalRepositoryState(
    () => repository.loadAll(),
    (next) => repository.saveAll(next),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<Modal>({ kind: "none" });

  const lentOutCount = useMemo(() => countLentOut(books), [books]);

  const visibleBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
    if (filter === "lent-out") {
      return sorted.filter((book) => book.borrowerName !== null);
    }
    return sorted;
  }, [books, filter]);

  const handleAdd = (values: {
    title: string;
    author: string;
    category: Book["category"];
  }) => {
    setBooks((prev) => [
      ...prev,
      createBook({ title: values.title, author: values.author, category: values.category }),
    ]);
    setModal({ kind: "none" });
  };

  const handleEdit = (values: {
    title: string;
    author: string;
    category: Book["category"];
  }) => {
    if (modal.kind !== "edit") return;
    const editing = modal.book;
    setBooks((prev) =>
      prev.map((book) =>
        book.id === editing.id
          ? { ...book, title: values.title, author: values.author, category: values.category }
          : book,
      ),
    );
    setModal({ kind: "none" });
  };

  const handleLend = (borrowerName: string) => {
    if (modal.kind !== "lend") return;
    const lending = modal.book;
    setBooks((prev) =>
      prev.map((book) =>
        book.id === lending.id ? lendBook(book, borrowerName) : book,
      ),
    );
    setModal({ kind: "none" });
  };

  const handleReturn = (book: Book) => {
    setBooks((prev) =>
      prev.map((current) =>
        current.id === book.id ? returnBook(current) : current,
      ),
    );
  };

  const handleDelete = (book: Book) => {
    setBooks((prev) => prev.filter((current) => current.id !== book.id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>My Book Shelf</h1>
        <p className="summary" aria-live="polite">
          {lentOutCount === 0
            ? "No books are lent out right now."
            : `${lentOutCount} ${lentOutCount === 1 ? "book" : "books"} currently lent out.`}
        </p>
      </header>

      <section className="toolbar" aria-label="Shelf controls">
        <button
          type="button"
          aria-label="Add a book to the shelf"
          onClick={() => setModal({ kind: "add" })}
          disabled={modal.kind !== "none"}
        >
          Add book
        </button>
        <fieldset className="filter-group" aria-label="Filter books">
          <label>
            <input
              type="radio"
              name="filter"
              value="all"
              checked={filter === "all"}
              onChange={() => setFilter("all")}
            />
            All books
          </label>
          <label>
            <input
              type="radio"
              name="filter"
              value="lent-out"
              checked={filter === "lent-out"}
              onChange={() => setFilter("lent-out")}
            />
            Currently out
          </label>
        </fieldset>
      </section>

      {modal.kind === "add" ? (
        <section className="modal" aria-label="Add a book">
          <BookForm
            title="Add a book"
            submitLabel="Add book"
            onSubmit={handleAdd}
            onCancel={() => setModal({ kind: "none" })}
          />
        </section>
      ) : null}

      {modal.kind === "edit" ? (
        <section className="modal" aria-label="Edit book">
          <BookForm
            title="Edit book"
            submitLabel="Save changes"
            initial={{
              title: modal.book.title,
              author: modal.book.author,
              category: modal.book.category,
            }}
            onSubmit={handleEdit}
            onCancel={() => setModal({ kind: "none" })}
          />
        </section>
      ) : null}

      {modal.kind === "lend" ? (
        <section className="modal" aria-label="Lend out book">
          <h2>Lend out {modal.book.title}</h2>
          <LendForm
            book={modal.book}
            onLend={handleLend}
            onCancel={() => setModal({ kind: "none" })}
          />
        </section>
      ) : null}

      <main>
        {filter === "lent-out" ? (
          <h2>Currently out</h2>
        ) : (
          <h2>All books ({visibleBooks.length})</h2>
        )}
        <BookList
          books={visibleBooks}
          onEdit={(book) => setModal({ kind: "edit", book })}
          onDelete={handleDelete}
          onLend={(book) => setModal({ kind: "lend", book })}
          onReturn={handleReturn}
        />
      </main>
    </div>
  );
};
