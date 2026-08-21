import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  type Book,
  type Category,
  validateBookInput,
  createBook,
  updateBook,
  lendBook,
  returnBook,
  countLentOut,
  isLentOut,
} from "./domain/book.js";
import {
  type BookRepository,
  createLocalBookRepository,
} from "./persistence/bookRepository.js";

type Filter = "all" | "lent";

interface EditDraft {
  id: string;
  title: string;
  author: string;
  category: Category;
}

function emptyDraft(): { title: string; author: string; category: Category } {
  return { title: "", author: "", category: "Novel" };
}

function useStateFromRepository(repo: BookRepository): [Book[], (next: Book[]) => void] {
  const [books, setBooks] = useState<Book[]>(() => repo.load());

  const persist = useCallback(
    (next: Book[]) => {
      setBooks(next);
      repo.save(next);
    },
    [repo],
  );

  return [books, persist];
}

export function App({ repository }: { repository?: BookRepository }) {
  const repo = useMemo<BookRepository>(
    () =>
      repository ??
      (typeof window !== "undefined" && window.localStorage
        ? createLocalBookRepository(window.localStorage)
        : createLocalBookRepository({} as Storage)),
    [repository],
  );
  const [books, setBooks] = useStateFromRepository(repo);
  const [filter, setFilter] = useState<Filter>("all");

  const [draft, setDraft] = useState(emptyDraft());
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Persist on any change (defensive, repository already saves in setter wrapper).
  useEffect(() => {
    repo.save(books);
  }, [books, repo]);

  const visibleBooks = useMemo(
    () => (filter === "lent" ? books.filter(isLentOut) : books),
    [books, filter],
  );
  const lentCount = useMemo(() => countLentOut(books), [books]);

  function handleSubmitAdd(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateBookInput(draft);
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }
    const next = [...books, createBook(draft)];
    setBooks(next);
    setDraft(emptyDraft());
    setDraftErrors({});
  }

  function startEditing(book: Book) {
    setEditing({ id: book.id, title: book.title, author: book.author, category: book.category });
    setEditErrors({});
  }

  function cancelEditing() {
    setEditing(null);
    setEditErrors({});
  }

  function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const errors = validateBookInput(editing);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setBooks(books.map((b) => (b.id === editing.id ? updateBook(b, editing) : b)));
    cancelEditing();
  }

  function handleDelete(id: string) {
    setBooks(books.filter((b) => b.id !== id));
  }

  function handleLend(book: Book) {
    const name = window.prompt("Who is borrowing this book?", book.borrower ?? "");
    if (name === null) return; // user cancelled
    if (name.trim() === "") return; // blank: ignore
    setBooks(books.map((b) => (b.id === book.id ? lendBook(b, name) : b)));
  }

  function handleReturn(book: Book) {
    setBooks(books.map((b) => (b.id === book.id ? returnBook(b) : b)));
  }

  return (
    <main className="shell" aria-labelledby="page-title">
      <section className="panel">
        <header className="header">
          <div>
            <p className="eyebrow">My Bookshelf</p>
            <h1 id="page-title">Books on my shelves</h1>
          </div>
          <p className="stat" aria-live="polite" data-testid="lent-count">
            <span className="stat-number">{lentCount}</span>
            <span className="stat-label">lent out of {books.length}</span>
          </p>
        </header>

        <form className="card" onSubmit={handleSubmitAdd} aria-label="Add a book" noValidate>
          <h2 className="card-title">Add a book</h2>
          <div className="grid">
            <label className="field">
              <span>Title</span>
              <input
                name="title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. The Lord of the Rings"
                aria-invalid={!!draftErrors.title}
                aria-describedby={draftErrors.title ? "add-title-error" : undefined}
              />
            </label>
            <label className="field">
              <span>Author</span>
              <input
                name="author"
                value={draft.author}
                onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                placeholder="e.g. J. R. R. Tolkien"
                aria-invalid={!!draftErrors.author}
                aria-describedby={draftErrors.author ? "add-author-error" : undefined}
              />
            </label>
            <label className="field">
              <span>Kind of book</span>
              <select
                name="category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {draftErrors.title && (
            <p id="add-title-error" className="error" role="alert">
              {draftErrors.title}
            </p>
          )}
          {draftErrors.author && (
            <p id="add-author-error" className="error" role="alert">
              {draftErrors.author}
            </p>
          )}
          <div className="actions">
            <button type="submit">Add book</button>
          </div>
        </form>

        <div className="filters" role="group" aria-label="Filter books">
          <label>
            <input
              type="radio"
              name="filter"
              checked={filter === "all"}
              onChange={() => setFilter("all")}
            />
            All ({books.length})
          </label>
          <label>
            <input
              type="radio"
              name="filter"
              checked={filter === "lent"}
              onChange={() => setFilter("lent")}
            />
            Lent out ({lentCount})
          </label>
        </div>

        {visibleBooks.length === 0 ? (
          <p className="empty">
            {books.length === 0
              ? "No books yet. Add your first book above."
              : "No books match this filter."}
          </p>
        ) : (
          <ul className="list" aria-label="Books">
            {visibleBooks.map((book) => (
              <li key={book.id} className="row">
                {editing?.id === book.id ? (
                  <form
                    className="row-edit"
                    onSubmit={handleSubmitEdit}
                    aria-label={`Edit ${book.title}`}
                    noValidate
                  >
                    <label className="field">
                      <span>Title</span>
                      <input
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        aria-invalid={!!editErrors.title}
                      />
                    </label>
                    <label className="field">
                      <span>Author</span>
                      <input
                        value={editing.author}
                        onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                        aria-invalid={!!editErrors.author}
                      />
                    </label>
                    <label className="field">
                      <span>Kind of book</span>
                      <select
                        value={editing.category}
                        onChange={(e) =>
                          setEditing({ ...editing, category: e.target.value as Category })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    {editErrors.title && <p className="error">{editErrors.title}</p>}
                    {editErrors.author && <p className="error">{editErrors.author}</p>}
                    <div className="row-actions">
                      <button type="submit">Save</button>
                      <button type="button" onClick={cancelEditing}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="row-info">
                    <div className="row-main">
                      <p className="row-title">{book.title}</p>
                      <p className="row-meta">
                        <span>{book.author}</span> · <span>{book.category}</span>
                      </p>
                    </div>
                    <div className="row-state">
                      {isLentOut(book) ? (
                        <p className="borrowed" data-testid={`borrower-${book.id}`}>
                          Out with <strong>{book.borrower}</strong>
                        </p>
                      ) : (
                        <p className="on-shelf">On the shelf</p>
                      )}
                    </div>
                    <div className="row-actions">
                      {isLentOut(book) ? (
                        <button
                          type="button"
                          onClick={() => handleReturn(book)}
                          aria-label={`Mark ${book.title} as returned`}
                        >
                          Returned
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLend(book)}
                          aria-label={`Lend ${book.title} to someone`}
                        >
                          Lend out
                        </button>
                      )}
                      <button type="button" onClick={() => startEditing(book)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(book.id)}
                        aria-label={`Delete ${book.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
