import { useEffect, useMemo, useState } from "react";
import type { Book, BookDraft, LentFilter } from "./types.js";
import { isLent } from "./types.js";
import {
  addBook,
  deleteBook,
  lendBook,
  returnBook,
  updateBook,
} from "./domain.js";
import {
  LocalStorageBookRepository,
  type BookRepository,
  newId,
} from "./repository.js";
import { BookForm } from "./BookForm.js";
import { BookRow } from "./BookRow.js";

interface AppState {
  books: Book[];
  filter: LentFilter;
  editing: Book | null;
}

export function App({
  repository = new LocalStorageBookRepository(),
}: {
  repository?: BookRepository;
}) {
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<LentFilter>("all");
  const [editing, setEditing] = useState<Book | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load once on mount. A failing load degrades to an empty shelf rather
  // than crashing the UI (recoverable storage failure).
  useEffect(() => {
    try {
      setBooks(repository.load());
    } catch {
      setBooks([]);
    } finally {
      setLoaded(true);
    }
    // repository is stable for the default; tests inject a fresh one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever books change (after the initial load completes).
  // A failing save is ignored so the UI keeps working this session.
  useEffect(() => {
    if (!loaded) return;
    try {
      repository.save(books);
    } catch {
      // Best-effort persistence; in-memory state is unaffected.
    }
  }, [books, loaded, repository]);

  const lentCount = useMemo(
    () => books.filter(isLent).length,
    [books],
  );

  const visibleBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
    return filter === "out" ? sorted.filter(isLent) : sorted;
  }, [books, filter]);

  const state: AppState = { books, filter, editing };

  function handleAdd(draft: BookDraft) {
    setBooks((prev) => addBook(prev, draft, newId()));
  }

  function handleUpdate(draft: BookDraft) {
    if (!editing) return;
    setBooks((prev) => updateBook(prev, editing.id, draft));
    setEditing(null);
  }

  function handleDelete(book: Book) {
    // Single-user local app: a confirm keeps destructive actions reversible.
    const ok = window.confirm(
      `Remove "${book.title}" by ${book.author} from your shelf?`,
    );
    if (!ok) return;
    setBooks((prev) => deleteBook(prev, book.id));
    if (editing?.id === book.id) setEditing(null);
  }

  function handleLend(book: Book, borrower: string) {
    setBooks((prev) => lendBook(prev, book.id, borrower));
  }

  function handleReturn(book: Book) {
    setBooks((prev) => returnBook(prev, book.id));
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">My Book Shelf</p>
        <h1 id="page-title">Book Shelf</h1>
        <p className="subtitle">
          {lentCount} {lentCount === 1 ? "book is" : "books are"} lent out right
          now.
        </p>

        <div className="controls">
          <div role="radiogroup" aria-label="Filter books" className="filters">
            {(["all", "out"] as const).map((value) => (
              <label key={value} className="filter">
                <input
                  type="radio"
                  name="filter"
                  value={value}
                  checked={filter === value}
                  onChange={() => setFilter(value)}
                />
                <span>{value === "all" ? "All books" : "Lent out"}</span>
              </label>
            ))}
          </div>
        </div>

        <BookForm
          legend={editing ? "Edit book" : "Add a book"}
          submitLabel={editing ? "Save changes" : "Add book"}
          initial={
            editing
              ? {
                  title: editing.title,
                  author: editing.author,
                  category: editing.category,
                }
              : undefined
          }
          onSubmit={editing ? handleUpdate : handleAdd}
          onCancel={editing ? () => setEditing(null) : undefined}
        />

        <section aria-labelledby="shelf-title" className="shelf">
          <h2 id="shelf-title">
            {filter === "all" ? "All books" : "Lent out"}
            <span className="count">({visibleBooks.length})</span>
          </h2>
          {visibleBooks.length === 0 ? (
            <p className="empty">
              {filter === "out"
                ? "No books are currently lent out."
                : books.length === 0
                  ? "Your shelf is empty. Add your first book above."
                  : "No books match this filter."}
            </p>
          ) : (
            <ul className="book-list">
              {visibleBooks.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onLend={handleLend}
                  onReturn={handleReturn}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Hidden marker so tests can assert persistence wiring without a refresh. */}
        <span hidden data-testid="state-loaded">
          {state.filter}
        </span>
      </section>
    </main>
  );
}
