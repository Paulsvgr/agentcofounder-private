import { useId, useMemo, useState } from "react";
import {
  BOOK_CATEGORIES,
  countLentOut,
  normalizeBookInput,
  validateBookInput,
} from "../domain/book.js";
import type { Book, BookCategory } from "../domain/book.js";
import type { LibraryApi } from "../hooks/useLibrary.js";

type FilterMode = "all" | "out";

interface BookFormProps {
  onSubmit: (input: {
    title: string;
    author: string;
    category: BookCategory;
  }) => void;
  initial?: { title: string; author: string; category: BookCategory };
  submitLabel: string;
  onCancel?: () => void;
}

function emptyForm() {
  return { title: "", author: "", category: "Novel" as BookCategory };
}

function BookForm({ onSubmit, initial, submitLabel, onCancel }: BookFormProps) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [errors, setErrors] = useState<
    ReturnType<typeof validateBookInput>
  >([]);
  const titleId = useId();
  const authorId = useId();
  const categoryId = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateBookInput(form);
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    setErrors([]);
    onSubmit(normalizeBookInput(form));
    setForm(emptyForm());
  };

  const titleError = errors.find((e) => e.field === "title")?.message;
  const authorError = errors.find((e) => e.field === "author")?.message;
  const categoryError = errors.find((e) => e.field === "category")?.message;

  return (
    <form className="book-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          name="title"
          type="text"
          value={form.title}
          maxLength={200}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? `${titleId}-error` : undefined}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        {titleError && (
          <p className="field-error" id={`${titleId}-error`} role="alert">
            {titleError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={authorId}>Author</label>
        <input
          id={authorId}
          name="author"
          type="text"
          value={form.author}
          maxLength={120}
          aria-invalid={Boolean(authorError)}
          aria-describedby={authorError ? `${authorId}-error` : undefined}
          onChange={(e) => setForm({ ...form, author: e.target.value })}
        />
        {authorError && (
          <p className="field-error" id={`${authorId}-error`} role="alert">
            {authorError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={categoryId}>Kind of book</label>
        <select
          id={categoryId}
          name="category"
          value={form.category}
          aria-invalid={Boolean(categoryError)}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value as BookCategory })
          }
        >
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {categoryError && (
          <p className="field-error" id={`${categoryId}-error`} role="alert">
            {categoryError}
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

interface BookRowProps {
  book: Book;
  editing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: (input: {
    title: string;
    author: string;
    category: BookCategory;
  }) => void;
  onDelete: () => void;
  onLend: (borrower: string) => void;
  onReturn: () => void;
}

function BookRow({
  book,
  editing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
  onLend,
  onReturn,
}: BookRowProps) {
  const [lender, setLender] = useState("");
  const lentOut = book.borrower !== null && book.borrower.length > 0;

  if (editing) {
    return (
      <li className="book-row editing">
        <BookForm
          submitLabel="Save changes"
          onCancel={onEditCancel}
          initial={{
            title: book.title,
            author: book.author,
            category: book.category,
          }}
          onSubmit={(input) => onEditSave(input)}
        />
      </li>
    );
  }

  return (
    <li className="book-row" data-lent={lentOut}>
      <div className="book-info">
        <p className="book-title">{book.title}</p>
        <p className="book-meta">
          <span className="book-author">{book.author}</span>
          <span className="book-category">{book.category}</span>
        </p>
      </div>
      <div className="book-status">
        {lentOut ? (
          <span className="status lent" data-testid="lend-status">
            Out with {book.borrower}
          </span>
        ) : (
          <span className="status home" data-testid="lend-status">
            At home
          </span>
        )}
      </div>
      <div className="book-actions">
        {lentOut ? (
          <button type="button" onClick={onReturn} aria-label={`Return ${book.title}`}>
            Returned
          </button>
        ) : (
          <div className="lend-inline">
            <input
              type="text"
              placeholder="Borrower name"
              maxLength={120}
              value={lender}
              aria-label={`Borrower for ${book.title}`}
              onChange={(e) => setLender(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (lender.trim()) {
                    onLend(lender.trim());
                    setLender("");
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (lender.trim()) {
                  onLend(lender.trim());
                  setLender("");
                }
              }}
              aria-label={`Lend ${book.title}`}
            >
              Lend
            </button>
          </div>
        )}
        <button type="button" onClick={onEditStart} aria-label={`Edit ${book.title}`}>
          Edit
        </button>
        <button
          type="button"
          className="danger"
          onClick={onDelete}
          aria-label={`Delete ${book.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

interface AppProps {
  books: readonly Book[];
  api: LibraryApi;
}

export function App({ books, api }: AppProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const lentOutCount = useMemo(() => countLentOut(books), [books]);
  const visibleBooks = useMemo(() => {
    const list = filter === "out" ? books.filter((b) => b.borrower !== null && b.borrower.length > 0) : books;
    return list;
  }, [books, filter]);

  return (
    <main className="shell">
      <div className="card">
        <header className="app-header">
          <p className="eyebrow">Home library</p>
          <h1>My books</h1>
          <p className="summary" data-testid="summary">
            {books.length} {books.length === 1 ? "book" : "books"} total
            {" · "}
            <span data-testid="lent-count">{lentOutCount}</span> lent out
          </p>
        </header>

        <section className="add-section" aria-labelledby="add-heading">
          <h2 id="add-heading" className="section-title">
            Add a book
          </h2>
          <BookForm
            submitLabel="Add book"
            onSubmit={(input) => api.addBook(input)}
          />
        </section>

        <section className="list-section" aria-labelledby="list-heading">
          <div className="list-header">
            <h2 id="list-heading" className="section-title">
              Collection
            </h2>
            <div className="filters" role="group" aria-label="Filter books">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={filter === "out" ? "active" : ""}
                aria-pressed={filter === "out"}
                onClick={() => setFilter("out")}
              >
                Lent out
              </button>
            </div>
          </div>

          {visibleBooks.length === 0 ? (
            <p className="empty-state">
              {filter === "out"
                ? "No books are currently lent out."
                : "No books yet. Add your first book above."}
            </p>
          ) : (
            <ul className="book-list" aria-label="Books">
              {visibleBooks.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  editing={editingId === book.id}
                  onEditStart={() => setEditingId(book.id)}
                  onEditCancel={() => setEditingId(null)}
                  onEditSave={(input) => {
                    api.updateBook(book.id, input);
                    setEditingId(null);
                  }}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Remove "${book.title}" from your library?`,
                      )
                    ) {
                      api.removeBook(book.id);
                    }
                  }}
                  onLend={(borrower) => api.lend(book.id, borrower)}
                  onReturn={() => api.ret(book.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
