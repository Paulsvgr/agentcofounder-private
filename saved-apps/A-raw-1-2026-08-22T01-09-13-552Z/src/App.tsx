import { useMemo, useState } from "react";
import { createBookRepository } from "./repository";
import { useBooks } from "./useBooks";
import { countLentOut } from "./domain";
import { BookForm } from "./BookForm";
import { BookRow } from "./BookRow";
import type { Book, BookKind } from "./types";

type Filter = "all" | "lent";

const repo = createBookRepository(
  typeof window !== "undefined" ? window.localStorage : memoryStorage(),
);

export function App() {
  const { books, error, clearError, add, remove, edit, lend, returnBook } = useBooks(repo);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Book | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const lentCount = useMemo(() => countLentOut(books), [books]);

  const visible = useMemo(() => {
    const sorted = [...books].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
    if (filter === "lent") return sorted.filter((b) => b.borrower !== null && b.borrower !== "");
    return sorted;
  }, [books, filter]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>My Books</h1>
        <p className="summary" data-testid="summary">
          {books.length} {books.length === 1 ? "book" : "books"} in total ·{" "}
          <strong data-testid="lent-count">{lentCount}</strong> lent out right now
        </p>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss error">
            Dismiss
          </button>
        </div>
      )}

      <section className="controls" aria-label="Collection controls">
        <button
          type="button"
          className="primary"
          onClick={() => {
            setShowAdd((s) => !s);
            setEditing(null);
          }}
          aria-expanded={showAdd}
        >
          {showAdd ? "Hide add form" : "Add a book"}
        </button>
        <fieldset className="filter-group" aria-label="Filter books">
          <legend className="sr-only">Filter books</legend>
          <label>
            <input
              type="radio"
              name="filter"
              value="all"
              checked={filter === "all"}
              onChange={() => setFilter("all")}
            />
            All
          </label>
          <label>
            <input
              type="radio"
              name="filter"
              value="lent"
              checked={filter === "lent"}
              onChange={() => setFilter("lent")}
            />
            Lent out
          </label>
        </fieldset>
      </section>

      {showAdd && (
        <section className="add-section" aria-label="Add a new book">
          <BookForm
            titleIdPrefix="add"
            submitLabel="Add book"
            onSubmit={(input) => {
              add(input);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        </section>
      )}

      {editing && (
        <section className="edit-section" aria-label="Edit book">
          <h2>Edit &ldquo;{editing.title}&rdquo;</h2>
          <BookForm
            titleIdPrefix="edit"
            submitLabel="Save changes"
            initial={{ title: editing.title, author: editing.author, kind: editing.kind }}
            onSubmit={(input) => {
              edit(editing.id, input);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </section>
      )}

      <main className="book-list-section">
        {visible.length === 0 ? (
          <p className="empty" data-testid="empty-state">
            {filter === "lent"
              ? "No books are currently lent out."
              : "No books yet. Add your first book to start tracking."}
          </p>
        ) : (
          <ul className="book-list" aria-label="Books">
            {visible.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onLend={lend}
                onReturn={returnBook}
                onEdit={(b) => {
                  setEditing(b);
                  setShowAdd(false);
                }}
                onRemove={remove}
              />
            ))}
          </ul>
        )}
      </main>

      <footer className="app-footer">
        <p>Your library is saved on this computer.</p>
      </footer>
    </div>
  );
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(k) {
      return data.has(k) ? (data.get(k) as string) : null;
    },
    key(i) {
      return Array.from(data.keys())[i] ?? null;
    },
    removeItem(k) {
      data.delete(k);
    },
    setItem(k, v) {
      data.set(k, v);
    },
  };
}

export type { BookKind };
