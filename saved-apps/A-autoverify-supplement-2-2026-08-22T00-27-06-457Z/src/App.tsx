import { useMemo, useState } from "react";
import type { BookRepository } from "./repository";
import type { Filter } from "./types";
import { countLentOut, createLocalBookRepository } from "./storage";
import { useRepository } from "./useRepository";
import { AddBookForm } from "./components/AddBookForm";
import { BookRow } from "./components/BookRow";

export function App() {
  // A repository is constructed per mount so a page refresh re-reads the
  // persisted state from localStorage; the same instance is reused for the
  // lifetime of the mount, keeping in-memory mutations consistent.
  const repository = useMemo<BookRepository>(
    () => createLocalBookRepository(),
    [],
  );
  const reactive = useRepository(repository);
  const [filter, setFilter] = useState<Filter>("all");

  const books = reactive.list();
  const lentOutCount = useMemo(() => countLentOut(books), [books]);
  const visibleBooks =
    filter === "out" ? books.filter((b) => b.borrower.trim().length > 0) : books;

  return (
    <main className="app">
      <header className="app-header">
        <h1>My home library</h1>
        <p className="summary">
          You have <strong data-testid="total-count">{books.length}</strong>{" "}
          {books.length === 1 ? "book" : "books"}
          {" — "}
          <strong data-testid="lent-count">{lentOutCount}</strong> currently
          lent out.
        </p>
      </header>

      <section aria-labelledby="add-heading" className="card">
        <h2 id="add-heading">Add a book</h2>
        <AddBookForm repository={reactive} />
      </section>

      <section aria-labelledby="list-heading" className="card">
        <div className="list-header">
          <h2 id="list-heading">Books on your shelves</h2>
          <div role="group" aria-label="Filter books" className="filter-group">
            <label>
              <input
                type="radio"
                name="filter"
                value="all"
                checked={filter === "all"}
                onChange={() => setFilter("all")}
              />
              All ({books.length})
            </label>
            <label>
              <input
                type="radio"
                name="filter"
                value="out"
                checked={filter === "out"}
                onChange={() => setFilter("out")}
              />
              Lent out ({lentOutCount})
            </label>
          </div>
        </div>

        {visibleBooks.length === 0 ? (
          <p className="empty">
            {filter === "out"
              ? "Nothing is lent out — all your books are home."
              : "No books yet. Add your first book above."}
          </p>
        ) : (
          <ul className="book-list" aria-label="Books">
            {visibleBooks.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                repository={reactive}
                onChanged={() => {}}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
