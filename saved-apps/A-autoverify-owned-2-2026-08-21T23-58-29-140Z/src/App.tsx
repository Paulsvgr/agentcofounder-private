import { useMemo, useState } from "react";
import { type Book, type BookFilter } from "./domain/book.js";
import { createLocalStorageRepository } from "./storage/bookRepository.js";
import { createBookService } from "./services/bookService.js";
import { useBooks } from "./hooks/useBooks.js";
import { BookForm } from "./components/BookForm.js";
import { BookRow } from "./components/BookRow.js";

const storage: Storage | undefined =
  typeof window !== "undefined" && window.localStorage ? window.localStorage : undefined;

const service = createBookService(createLocalStorageRepository(storage));

const FILTERS: { value: BookFilter; label: string }[] = [
  { value: "all", label: "All books" },
  { value: "out", label: "Currently out" },
];

export function App() {
  const { books, filter, setFilter, lendCount, refresh } = useBooks(service);
  const [editing, setEditing] = useState<Book | null>(null);

  // Reset the form's internal state when switching edit targets.
  const formKey = useMemo(
    () => (editing ? `edit-${editing.id}` : "add"),
    [editing],
  );

  function handleEdit(book: Book) {
    setEditing(book);
  }

  function handleFilterClick(next: BookFilter) {
    setFilter(next);
  }

  return (
    <main className="shell">
      <div className="layout">
        <header className="app-header">
          <p className="eyebrow">My Bookshelf</p>
          <h1 id="app-title">My books</h1>
          <p className="subtitle">
            <span aria-label="Lent out count" data-testid="lend-count">
              {lendCount} {lendCount === 1 ? "book is" : "books are"} lent out right now.
            </span>
          </p>
        </header>

        <section aria-labelledby="add-heading" className="form-card">
          <h2 id="add-heading" className="visually-hidden">Add or edit a book</h2>
          <BookForm
            key={formKey}
            service={service}
            editing={editing}
            onDone={() => setEditing(null)}
            onChanged={refresh}
          />
        </section>

        <section aria-labelledby="list-heading" className="list-section">
          <div className="list-header">
            <h2 id="list-heading" className="list-title">Everything I own</h2>
            <div role="group" aria-label="Filter books" className="filter-group">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`btn btn-filter ${filter === f.value ? "is-active" : ""}`}
                  aria-pressed={filter === f.value}
                  onClick={() => handleFilterClick(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {books.length === 0 ? (
            <p className="empty" data-testid="empty-state">
              {filter === "out"
                ? "Nothing is lent out — every book is on the shelf."
                : "No books yet. Add one above to get started."}
            </p>
          ) : (
            <ul className="book-list" aria-label="Book list">
              {books.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  service={service}
                  onChanged={refresh}
                  onEdit={handleEdit}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
