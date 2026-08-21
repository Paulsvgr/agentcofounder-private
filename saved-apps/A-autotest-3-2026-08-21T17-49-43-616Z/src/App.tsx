import { useEffect, useMemo, useState } from "react";
import type { Book, BookInput, Filter } from "./types.js";
import { Bookshelf } from "./bookshelf.js";
import { LocalBookRepository } from "./repository.js";
import { BookForm, isPresent } from "./BookForm.js";
import { BookList } from "./BookList.js";
import { LendDialog } from "./LendDialog.js";

const shelf = new Bookshelf(new LocalBookRepository());

export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [lendingBook, setLendingBook] = useState<Book | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Book | null>(null);

  // Load persisted books on mount.
  useEffect(() => {
    setBooks(shelf.list());
  }, []);

  function refresh() {
    setBooks(shelf.list());
  }

  function handleAdd(input: BookInput) {
    shelf.add(input);
    refresh();
  }

  function handleUpdate(input: BookInput) {
    if (!editingBook) return;
    shelf.update(editingBook.id, input);
    setEditingBook(null);
    refresh();
  }

  function handleDelete(book: Book) {
    setConfirmDelete(book);
  }

  function confirmRemoval() {
    if (!confirmDelete) return;
    shelf.remove(confirmDelete.id);
    setConfirmDelete(null);
    refresh();
  }

  function handleLend(book: Book) {
    setLendingBook(book);
  }

  function submitLend(borrower: string) {
    if (!lendingBook) return;
    shelf.lend(lendingBook.id, borrower);
    setLendingBook(null);
    refresh();
  }

  function handleReturn(book: Book) {
    shelf.returnBook(book.id);
    refresh();
  }

  const visibleBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
    return filter === "lent"
      ? sorted.filter((b) => b.borrower !== null)
      : sorted;
  }, [books, filter]);

  const lentCount = useMemo(
    () => books.filter((b) => b.borrower !== null).length,
    [books],
  );

  const editingInitial: Partial<BookInput> | undefined = editingBook
    ? {
        title: editingBook.title,
        author: editingBook.author,
        category: editingBook.category,
      }
    : undefined;

  return (
    <main className="app">
      <header className="app-header">
        <h1>My Bookshelf</h1>
        <p className="stats">
          <span>{books.length} book{books.length === 1 ? "" : "s"}</span>
          <span aria-label="books currently lent out">
            {lentCount} lent out
          </span>
        </p>
      </header>

      <section className="panel add-panel" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a book</h2>
        <BookForm onSubmit={handleAdd} submitLabel="Add book" />
      </section>

      <section className="panel list-panel" aria-labelledby="list-heading">
        <div className="list-header">
          <h2 id="list-heading">Books</h2>
          <div className="filters" role="group" aria-label="Filter books">
            <input
              type="radio"
              id="filter-all"
              name="filter"
              checked={filter === "all"}
              onChange={() => setFilter("all")}
            />
            <label htmlFor="filter-all">All</label>
            <input
              type="radio"
              id="filter-lent"
              name="filter"
              checked={filter === "lent"}
              onChange={() => setFilter("lent")}
            />
            <label htmlFor="filter-lent">Lent out</label>
          </div>
        </div>

        <BookList
          books={visibleBooks}
          onLend={handleLend}
          onReturn={handleReturn}
          onEdit={setEditingBook}
          onDelete={handleDelete}
        />
      </section>

      {editingBook && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Edit book">
          <div className="dialog">
            <h2>Edit “{editingBook.title}”</h2>
            <BookForm
              onSubmit={handleUpdate}
              initial={editingInitial}
              submitLabel="Save changes"
              onCancel={() => setEditingBook(null)}
            />
          </div>
        </div>
      )}

      {lendingBook && (
        <LendDialog
          bookTitle={lendingBook.title}
          initialBorrower={lendingBook.borrower ?? undefined}
          onSubmit={submitLend}
          onCancel={() => setLendingBook(null)}
        />
      )}

      {confirmDelete && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
        >
          <div className="dialog">
            <h2>Remove this book?</h2>
            <p>
              “{confirmDelete.title}” by {confirmDelete.author} will be taken off
              your shelf.
            </p>
            <div className="form-actions">
              <button type="button" className="danger" onClick={confirmRemoval}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export { isPresent };
