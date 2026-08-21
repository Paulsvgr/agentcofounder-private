import { useEffect, useMemo, useState } from "react";
import {
  type Book,
  type BookCategory,
  type BookInput,
  BOOK_CATEGORIES,
  CATEGORY_LABELS,
  isLentOut,
  lentOutCount,
} from "./domain/book.js";
import { createBookService } from "./services/bookService.js";
import { LocalStorageBookRepository } from "./infrastructure/bookRepository.js";

type Filter = "all" | "out";

const service = createBookService(new LocalStorageBookRepository());

function emptyForm(): BookInput {
  return { title: "", author: "", category: "novel" };
}

export function App() {
  const [books, setBooks] = useState<Book[]>(() => service.list());
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState<BookInput>(emptyForm());
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState<BookInput>(emptyForm());
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [lendFor, setLendFor] = useState<Book | null>(null);
  const [borrower, setBorrower] = useState("");
  const [lendError, setLenderror] = useState("");

  // Re-sync from service if storage changed externally (e.g. another tab).
  useEffect(() => {
    const onStorage = () => setBooks(service.list());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const refresh = () => setBooks(service.list());
  const outCount = useMemo(() => lentOutCount(books), [books]);

  const visible = useMemo(() => {
    const list = filter === "out" ? books.filter(isLentOut) : books;
    return [...list].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }, [books, filter]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = service.add(form);
    if (res.errors.length > 0) {
      setFormErrors(res.errors.map(fieldMessage));
      return;
    }
    setFormErrors([]);
    setForm(emptyForm());
    refresh();
  }

  function startEdit(book: Book) {
    setEditing(book);
    setEditForm({
      title: book.title,
      author: book.author,
      category: book.category,
    });
    setEditErrors([]);
  }

  function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const res = service.edit(editing.id, editForm);
    if (res.errors.length > 0) {
      setEditErrors(res.errors.map(fieldMessage));
      return;
    }
    setEditErrors([]);
    setEditing(null);
    refresh();
  }

  function handleDelete(id: string) {
    service.remove(id);
    refresh();
  }

  function startLend(book: Book) {
    setLendFor(book);
    setBorrower("");
    setLenderror("");
  }

  function handleLend(e: React.FormEvent) {
    e.preventDefault();
    if (!lendFor) return;
    const res = service.lend(lendFor.id, borrower);
    if (res.errors.length > 0) {
      setLenderror("Please enter a borrower name.");
      return;
    }
    setLendFor(null);
    setBorrower("");
    refresh();
  }

  function handleReturn(id: string) {
    service.returnBook(id);
    refresh();
  }

  return (
    <main className="shell">
      <div className="container">
        <header className="header">
          <h1>Home Library</h1>
          <p className="subtitle" data-testid="summary">
            {books.length} book{books.length === 1 ? "" : "s"} ·{" "}
            <span data-testid="out-count">{outCount}</span> lent out
          </p>
        </header>

        <section className="card" aria-labelledby="add-heading">
          <h2 id="add-heading">Add a book</h2>
          <form onSubmit={handleAdd} className="form" noValidate>
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                name="title"
                aria-label="Book title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Author</span>
              <input
                type="text"
                name="author"
                aria-label="Book author"
                value={form.author}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                aria-label="Book category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as BookCategory,
                  }))
                }
              >
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary">
              Add book
            </button>
          </form>
          {formErrors.length > 0 && (
            <ul className="errors" role="alert" data-testid="add-errors">
              {formErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="list-heading">
          <div className="list-header">
            <h2 id="list-heading">Your books</h2>
            <div className="filters" role="group" aria-label="Filter books">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterButton>
              <FilterButton
                active={filter === "out"}
                onClick={() => setFilter("out")}
              >
                Out ({outCount})
              </FilterButton>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty" data-testid="empty-state">
              {filter === "out"
                ? "No books are currently lent out."
                : "No books yet. Add your first book above."}
            </p>
          ) : (
            <ul className="book-list" data-testid="book-list">
              {visible.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  onEdit={() => startEdit(book)}
                  onDelete={() => handleDelete(book.id)}
                  onLend={() => startLend(book)}
                  onReturn={() => handleReturn(book.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {editing && (
          <Modal title="Edit book" onClose={() => setEditing(null)}>
            <form onSubmit={handleEditSave} className="form" noValidate>
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  aria-label="Edit book title"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Author</span>
                <input
                  type="text"
                  aria-label="Edit book author"
                  value={editForm.author}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, author: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  aria-label="Edit book category"
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      category: e.target.value as BookCategory,
                    }))
                  }
                >
                  {BOOK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {editErrors.length > 0 && (
                <ul className="errors" role="alert" data-testid="edit-errors">
                  {editErrors.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
              <div className="actions">
                <button type="submit" className="primary">
                  Save changes
                </button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {lendFor && (
          <Modal
            title={`Lend out "${lendFor.title}"`}
            onClose={() => setLendFor(null)}
          >
            <form onSubmit={handleLend} className="form" noValidate>
              <label className="field">
                <span>Borrower name</span>
                <input
                  type="text"
                  aria-label="Borrower name"
                  autoFocus
                  value={borrower}
                  onChange={(e) => setBorrower(e.target.value)}
                />
              </label>
              {lendError && (
                <p className="errors" role="alert" data-testid="lend-error">
                  {lendError}
                </p>
              )}
              <div className="actions">
                <button type="submit" className="primary">
                  Mark lent out
                </button>
                <button type="button" onClick={() => setLendFor(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "primary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BookRow({
  book,
  onEdit,
  onDelete,
  onLend,
  onReturn,
}: {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
  onLend: () => void;
  onReturn: () => void;
}) {
  const out = isLentOut(book);
  return (
    <li className="book-row" data-testid="book-item">
      <div className="book-main">
        <span className="book-title">{book.title}</span>
        <span
          className="book-meta"
          data-testid={`book-meta-${book.id}`}
        >
          by {book.author} · {CATEGORY_LABELS[book.category]}
        </span>
        {out ? (
          <span className="badge out" data-testid="out-badge">
            Out: {book.borrowerName}
            {book.lentOn ? ` (since ${book.lentOn})` : ""}
          </span>
        ) : (
          <span className="badge in" data-testid="in-badge">
            On shelf
          </span>
        )}
      </div>
      <div className="book-actions">
        {out ? (
          <button type="button" onClick={onReturn} className="primary">
            Mark returned
          </button>
        ) : (
          <button type="button" onClick={onLend}>
            Lend out
          </button>
        )}
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="danger"
          aria-label={`Delete ${book.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fieldMessage(e: {
  field: "title" | "author" | "category";
  reason: string;
}): string {
  if (e.field === "title") return "Title is required.";
  if (e.field === "author") return "Author is required.";
  return "Please choose a valid category.";
}
