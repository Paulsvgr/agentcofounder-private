import { useEffect, useMemo, useRef, useState } from "react";
import type { Book, BookKind } from "./domain/books";
import {
  borrowBook,
  countLentOut,
  createBook,
  filterBooks,
  parseKind,
  returnBook,
  updateBook,
  validateAuthor,
  validateBorrowerName,
  validateTitle,
} from "./domain/books";
import { createLocalStorageBookStore } from "./persistence/bookStore";

type FilterMode = "all" | "lent";

type EditingState =
  | { mode: "none" }
  | { mode: "edit"; bookId: string }
  | { mode: "borrow"; bookId: string };

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const kinds: BookKind[] = ["Novel", "Cookbook", "Reference", "Other"];

export function App() {
  const store = useMemo(() => createLocalStorageBookStore(), []);

  const [books, setBooks] = useState<Book[]>(() => store.load());
  const [filter, setFilter] = useState<FilterMode>("all");

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [kind, setKind] = useState<BookKind>("Novel");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditingState>({ mode: "none" });
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editKind, setEditKind] = useState<BookKind>("Novel");

  const [borrowerName, setBorrowerName] = useState("");

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      store.save(books);
    } catch {
      // ignore storage failures; app remains usable in-memory
    }
  }, [books, store]);

  const visibleBooks = useMemo(() => filterBooks(books, filter), [books, filter]);
  const lentCount = useMemo(() => countLentOut(books), [books]);

  function resetAddForm() {
    setTitle("");
    setAuthor("");
    setKind("Novel");
    setFormError(null);
    titleInputRef.current?.focus();
  }

  function onAddBook(e: React.FormEvent) {
    e.preventDefault();
    const titleErr = validateTitle(title);
    const authorErr = validateAuthor(author);
    if (titleErr || authorErr) {
      setFormError(titleErr ?? authorErr);
      return;
    }

    try {
      const now = Date.now();
      const book = createBook(now, generateId(), { title, author, kind });
      setBooks((prev) => [...prev, book]);
      resetAddForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add book.");
    }
  }

  function beginEdit(book: Book) {
    setDialogError(null);
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditKind(book.kind);
    setEditing({ mode: "edit", bookId: book.id });
  }

  function beginBorrow(book: Book) {
    setDialogError(null);
    setBorrowerName("");
    setEditing({ mode: "borrow", bookId: book.id });
  }

  function closeDialog() {
    setEditing({ mode: "none" });
    setDialogError(null);
  }

  function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editing.mode !== "edit") return;

    const titleErr = validateTitle(editTitle);
    const authorErr = validateAuthor(editAuthor);
    if (titleErr || authorErr) {
      setDialogError(titleErr ?? authorErr);
      return;
    }

    try {
      const now = Date.now();
      setBooks((prev) =>
        prev.map((b) =>
          b.id === editing.bookId
            ? updateBook(now, b, { title: editTitle, author: editAuthor, kind: editKind })
            : b,
        ),
      );
      closeDialog();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  function onConfirmBorrow(e: React.FormEvent) {
    e.preventDefault();
    if (editing.mode !== "borrow") return;

    const err = validateBorrowerName(borrowerName);
    if (err) {
      setDialogError(err);
      return;
    }

    try {
      const now = Date.now();
      setBooks((prev) =>
        prev.map((b) =>
          b.id === editing.bookId ? borrowBook(now, b, { borrowedBy: borrowerName }) : b,
        ),
      );
      closeDialog();
    } catch (e2) {
      setDialogError(e2 instanceof Error ? e2.message : "Could not lend book.");
    }
  }

  function onReturn(bookId: string) {
    const now = Date.now();
    setBooks((prev) => prev.map((b) => (b.id === bookId ? returnBook(now, b) : b)));
  }

  function onDelete(bookId: string) {
    const ok = window.confirm("Delete this book from your list?");
    if (!ok) return;
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  }

  return (
    <main className="shell">
      <header className="appHeader">
        <div>
          <h1>Family Library Loans</h1>
          <p className="muted">
            Track what you own, who borrowed it, and what is currently lent out.
          </p>
        </div>
        <div className="stats" aria-label="Loan summary">
          <div className="stat">
            <div className="statLabel">Total books</div>
            <div className="statValue" aria-label="Total books count">
              {books.length}
            </div>
          </div>
          <div className="stat">
            <div className="statLabel">Lent out</div>
            <div className="statValue" aria-label="Lent out count">
              {lentCount}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="add-book-title" className="card">
        <h2 id="add-book-title">Add a book</h2>
        <form onSubmit={onAddBook} className="formGrid" aria-describedby={formError ? "add-error" : undefined}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              ref={titleInputRef}
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="author">Author</label>
            <input
              id="author"
              name="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="kind">Kind</label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(parseKind(e.target.value))}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field actions">
            <button type="submit">Add book</button>
            <button type="button" className="secondary" onClick={resetAddForm}>
              Clear
            </button>
          </div>
          {formError ? (
            <p id="add-error" role="alert" className="error">
              {formError}
            </p>
          ) : null}
        </form>
      </section>

      <section aria-labelledby="list-title" className="card">
        <div className="listHeader">
          <h2 id="list-title">Your books</h2>
          <div className="filter" role="group" aria-label="Filter books">
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
          </div>
        </div>

        {visibleBooks.length === 0 ? (
          <p className="muted" role="status">
            {filter === "lent" ? "No books are currently lent out." : "No books yet. Add your first book above."}
          </p>
        ) : (
          <ul className="bookList" aria-label="Book list">
            {visibleBooks.map((b) => (
              <li key={b.id} className="bookRow">
                <div className="bookMain">
                  <div className="bookTitle">
                    <span className="titleText">{b.title}</span>
                    <span className="kindPill" aria-label={`Kind: ${b.kind}`}>
                      {b.kind}
                    </span>
                  </div>
                  <div className="bookMeta">
                    <span className="muted">by {b.author}</span>
                    {b.borrowedBy ? (
                      <span className="borrowed" aria-label={`Borrowed by ${b.borrowedBy}`}>
                        Lent to <strong>{b.borrowedBy}</strong>
                      </span>
                    ) : (
                      <span className="available" aria-label="Available">
                        Available
                      </span>
                    )}
                  </div>
                </div>
                <div className="rowActions" aria-label={`Actions for ${b.title}`}>
                  {b.borrowedBy ? (
                    <button type="button" onClick={() => onReturn(b.id)}>
                      Mark returned
                    </button>
                  ) : (
                    <button type="button" onClick={() => beginBorrow(b)}>
                      Lend out
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => beginEdit(b)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(b.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing.mode !== "none" ? (
        <div className="modalOverlay" role="presentation" onMouseDown={closeDialog}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {editing.mode === "edit" ? (
              <>
                <h3 id="dialog-title">Edit book</h3>
                <form onSubmit={onSaveEdit} aria-describedby={dialogError ? "dialog-error" : undefined}>
                  <div className="field">
                    <label htmlFor="edit-title">Title</label>
                    <input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-author">Author</label>
                    <input
                      id="edit-author"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-kind">Kind</label>
                    <select
                      id="edit-kind"
                      value={editKind}
                      onChange={(e) => setEditKind(parseKind(e.target.value))}
                    >
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  {dialogError ? (
                    <p id="dialog-error" role="alert" className="error">
                      {dialogError}
                    </p>
                  ) : null}

                  <div className="dialogActions">
                    <button type="submit">Save</button>
                    <button type="button" className="secondary" onClick={closeDialog}>
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 id="dialog-title">Lend out book</h3>
                <form onSubmit={onConfirmBorrow} aria-describedby={dialogError ? "dialog-error" : undefined}>
                  <div className="field">
                    <label htmlFor="borrower">Borrower name</label>
                    <input
                      id="borrower"
                      value={borrowerName}
                      onChange={(e) => setBorrowerName(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  {dialogError ? (
                    <p id="dialog-error" role="alert" className="error">
                      {dialogError}
                    </p>
                  ) : null}

                  <div className="dialogActions">
                    <button type="submit">Confirm lend</button>
                    <button type="button" className="secondary" onClick={closeDialog}>
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}

      <footer className="footer muted">
        Data is stored locally in your browser on this computer.
      </footer>
    </main>
  );
}
