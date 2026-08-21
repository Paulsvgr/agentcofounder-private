import { useEffect, useMemo, useState } from "react";
import {
  Book,
  BookCategory,
  BookDraft,
  BookStatus,
  CATEGORIES,
  countLentOut,
  createBook,
  FieldErrors,
  filterBooks,
  isLent,
  lendBook,
  returnBook,
  updateBook,
  validateBookDraft,
  validateBorrowerName,
} from "./domain.js";
import { createLocalStorageRepository } from "./repository.js";

const repo = createLocalStorageRepository();

const EMPTY_DRAFT: BookDraft = { title: "", author: "", category: "Novel" };

export function App() {
  const [books, setBooks] = useState<Book[]>(() => repo.load());
  const [status, setStatus] = useState<BookStatus>("all");

  useEffect(() => {
    repo.save(books);
  }, [books]);

  const lentCount = useMemo(() => countLentOut(books), [books]);
  const visible = useMemo(() => filterBooks(books, status), [books, status]);

  const handleAdd = (draft: BookDraft) => {
    setBooks((prev) => [...prev, createBook(draft)]);
  };

  const handleLend = (id: string, borrowerName: string) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? lendBook(b, borrowerName) : b)));
  };

  const handleReturn = (id: string) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? returnBook(b) : b)));
  };

  const handleUpdate = (id: string, draft: BookDraft) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? updateBook(b, draft) : b)));
  };

  const handleDelete = (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <main className="shell">
      <header className="header">
        <p className="eyebrow">Home Library</p>
        <h1>My Bookshelf</h1>
        <p className="summary" aria-live="polite">
          <strong>{lentCount}</strong> of {books.length} book
          {books.length === 1 ? "" : "s"} currently lent out
        </p>
      </header>

      <AddBookForm onAdd={handleAdd} />

      <FilterBar status={status} onChange={setStatus} />

      <BookList
        books={visible}
        totalCount={books.length}
        status={status}
        onLend={handleLend}
        onReturn={handleReturn}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </main>
  );
}

function AddBookForm({ onAdd }: { onAdd: (draft: BookDraft) => void }) {
  const [draft, setDraft] = useState<BookDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateBookDraft(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onAdd(draft);
    setDraft(EMPTY_DRAFT);
    setErrors({});
  };

  return (
    <section className="panel" aria-labelledby="add-heading">
      <h2 id="add-heading" className="section-title">
        Add a book
      </h2>
      <form onSubmit={submit} noValidate>
        <div className="grid">
          <BookFields
            prefix="add"
            draft={draft}
            errors={errors}
            onChange={(next) => {
              setDraft(next);
              if (Object.keys(errors).length > 0) setErrors({});
            }}
          />
        </div>
        <div className="actions-bar">
          <button type="submit">Add book</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setErrors({});
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </section>
  );
}

function FilterBar({
  status,
  onChange,
}: {
  status: BookStatus;
  onChange: (status: BookStatus) => void;
}) {
  return (
    <fieldset className="filter-bar">
      <legend>Show</legend>
      {(
        [
          ["all", "All"],
          ["home", "At home"],
          ["lent", "Lent out"],
        ] as ReadonlyArray<[BookStatus, string]>
      ).map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name="book-filter"
            value={value}
            checked={status === value}
            onChange={() => onChange(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function BookList({
  books,
  totalCount,
  status,
  onLend,
  onReturn,
  onUpdate,
  onDelete,
}: {
  books: Book[];
  totalCount: number;
  status: BookStatus;
  onLend: (id: string, borrowerName: string) => void;
  onReturn: (id: string) => void;
  onUpdate: (id: string, draft: BookDraft) => void;
  onDelete: (id: string) => void;
}) {
  if (totalCount === 0) {
    return (
      <p className="empty" role="status">
        You haven't added any books yet. Add one above to get started.
      </p>
    );
  }
  if (books.length === 0) {
    const message =
      status === "lent"
        ? "No books are currently lent out."
        : "No books are currently at home.";
    return (
      <p className="empty" role="status">
        {message}
      </p>
    );
  }
  return (
    <ul className="book-list" aria-label="Books">
      {books.map((book) => (
        <li key={book.id}>
          <BookRow
            book={book}
            onLend={onLend}
            onReturn={onReturn}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  );
}

type RowMode = "idle" | "lending" | "editing" | "confirmingDelete";

function BookRow({
  book,
  onLend,
  onReturn,
  onUpdate,
  onDelete,
}: {
  book: Book;
  onLend: (id: string, borrowerName: string) => void;
  onReturn: (id: string) => void;
  onUpdate: (id: string, draft: BookDraft) => void;
  onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<RowMode>("idle");
  const [draft, setDraft] = useState<BookDraft>({
    title: book.title,
    author: book.author,
    category: book.category,
  });
  const [borrowerName, setBorrowerName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const lent = isLent(book);

  const startEdit = () => {
    setDraft({ title: book.title, author: book.author, category: book.category });
    setErrors({});
    setMode("editing");
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateBookDraft(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onUpdate(book.id, draft);
    setMode("idle");
    setErrors({});
  };

  const submitLend = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateBorrowerName(borrowerName);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onLend(book.id, borrowerName);
    setBorrowerName("");
    setErrors({});
    setMode("idle");
  };

  const cancel = () => {
    setMode("idle");
    setErrors({});
    setBorrowerName("");
  };

  if (mode === "editing") {
    return (
      <article className="book-item">
        <form onSubmit={saveEdit} noValidate>
          <div className="grid">
            <BookFields
              prefix={`edit-${book.id}`}
              draft={draft}
              errors={errors}
              onChange={(next) => {
                setDraft(next);
                if (Object.keys(errors).length > 0) setErrors({});
              }}
            />
          </div>
          <div className="actions-bar">
            <button type="submit">Save changes</button>
            <button type="button" className="secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    );
  }

  if (mode === "lending") {
    return (
      <article className="book-item">
        <p className="book-title">{book.title}</p>
        <p className="book-author">by {book.author}</p>
        <span className="badge">{book.category}</span>
        <form onSubmit={submitLend} noValidate style={{ marginTop: "0.75rem" }}>
          <div className="field">
            <label htmlFor={`borrower-${book.id}`}>Borrowed by</label>
            <input
              id={`borrower-${book.id}`}
              type="text"
              value={borrowerName}
              autoFocus
              onChange={(e) => setBorrowerName(e.target.value)}
              aria-invalid={!!errors.borrowerName}
              aria-describedby={errors.borrowerName ? `borrower-error-${book.id}` : undefined}
            />
            <span
              id={`borrower-error-${book.id}`}
              className="error"
              role={errors.borrowerName ? "alert" : undefined}
            >
              {errors.borrowerName ?? ""}
            </span>
          </div>
          <div className="actions-bar">
            <button type="submit">Lend out</button>
            <button type="button" className="secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    );
  }

  if (mode === "confirmingDelete") {
    return (
      <article className="book-item">
        <p className="book-title">Remove "{book.title}"?</p>
        <p className="book-author">This takes it off your shelf permanently.</p>
        <div className="actions-bar">
          <button type="button" className="danger" onClick={() => onDelete(book.id)}>
            Yes, remove it
          </button>
          <button type="button" className="secondary" onClick={cancel}>
            Keep it
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="book-item">
      <header className="book-head">
        <p className="book-title">{book.title}</p>
        <p className="book-author">by {book.author}</p>
        <span className="badge">{book.category}</span>
      </header>
      <p className={`status ${lent ? "lent" : "home"}`}>
        {lent ? `Lent to ${book.borrowerName}` : "At home"}
      </p>
      <div className="actions-bar">
        {lent ? (
          <button type="button" onClick={() => onReturn(book.id)}>
            Mark returned
          </button>
        ) : (
          <button type="button" onClick={() => setMode("lending")}>
            Lend out
          </button>
        )}
        <button type="button" className="secondary" onClick={startEdit}>
          Edit
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode("confirmingDelete")}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function BookFields({
  prefix,
  draft,
  errors,
  onChange,
}: {
  prefix: string;
  draft: BookDraft;
  errors: FieldErrors;
  onChange: (draft: BookDraft) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-title`}>Title</label>
        <input
          id={`${prefix}-title`}
          type="text"
          value={draft.title}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? `${prefix}-title-error` : undefined}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
        <span
          id={`${prefix}-title-error`}
          className="error"
          role={errors.title ? "alert" : undefined}
        >
          {errors.title ?? ""}
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-author`}>Author</label>
        <input
          id={`${prefix}-author`}
          type="text"
          value={draft.author}
          aria-invalid={!!errors.author}
          aria-describedby={errors.author ? `${prefix}-author-error` : undefined}
          onChange={(e) => onChange({ ...draft, author: e.target.value })}
        />
        <span
          id={`${prefix}-author-error`}
          className="error"
          role={errors.author ? "alert" : undefined}
        >
          {errors.author ?? ""}
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-category`}>Category</label>
        <select
          id={`${prefix}-category`}
          value={draft.category}
          aria-invalid={!!errors.category}
          aria-describedby={errors.category ? `${prefix}-category-error` : undefined}
          onChange={(e) =>
            onChange({ ...draft, category: e.target.value as BookCategory })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span
          id={`${prefix}-category-error`}
          className="error"
          role={errors.category ? "alert" : undefined}
        >
          {errors.category ?? ""}
        </span>
      </div>
    </>
  );
}
