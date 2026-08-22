import { useEffect, useState } from "react";
import { createRepository } from "./repository.js";
import { createBookService, type BookService } from "./service.js";
import type { Book, BookFilter, BookInput } from "./types.js";
import { CATEGORIES } from "./types.js";

const defaultService = createBookService(createRepository());

interface AppProps {
  service?: BookService;
}

const emptyInput: BookInput = {
  title: "",
  author: "",
  category: "Novel",
};

export function App({ service }: AppProps) {
  const svc = service ?? defaultService;
  const [books, setBooks] = useState<Book[]>(() => svc.list());
  const [filter, setFilter] = useState<BookFilter>("all");
  const [draft, setDraft] = useState<BookInput>(emptyInput);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBooks(svc.list());
  }, [svc]);

  function refresh() {
    setBooks(svc.list());
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    const author = draft.author.trim();
    if (!title || !author) {
      setError("Title and author are required.");
      return;
    }
    svc.add({ title, author, category: draft.category });
    setDraft(emptyInput);
    setError(null);
    refresh();
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const title = draft.title.trim();
    const author = draft.author.trim();
    if (!title || !author) {
      setError("Title and author are required.");
      return;
    }
    svc.update(editingId, { title, author, category: draft.category });
    setEditingId(null);
    setDraft(emptyInput);
    setError(null);
    refresh();
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setDraft({
      title: book.title,
      author: book.author,
      category: book.category,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyInput);
    setError(null);
  }

  function handleRemove(id: string) {
    svc.remove(id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  function handleLend(id: string, name: string) {
    svc.lend(id, name);
    refresh();
  }

  function handleReturn(id: string) {
    svc.returnBook(id);
    refresh();
  }

  const visible =
    filter === "lent" ? books.filter((b) => b.borrower !== null) : books;
  const lentCount = books.filter((b) => b.borrower !== null).length;

  const isEditing = editingId !== null;

  return (
    <main className="shell">
      <div className="container">
        <header className="header">
          <h1>My Bookshelf</h1>
          <p className="subtitle">
            {books.length} {books.length === 1 ? "book" : "books"} · {lentCount}{" "}
            lent out
          </p>
        </header>

        <section
          className="card"
          aria-labelledby="form-heading"
        >
          <h2 id="form-heading" className="card-title">
            {isEditing ? "Edit book" : "Add a book"}
          </h2>
          <form
            onSubmit={isEditing ? handleUpdate : handleAdd}
            className="book-form"
            noValidate
          >
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
                placeholder="The Hobbit"
                aria-label="Book title"
                required
              />
            </label>
            <label className="field">
              <span>Author</span>
              <input
                type="text"
                value={draft.author}
                onChange={(e) =>
                  setDraft({ ...draft, author: e.target.value })
                }
                placeholder="J.R.R. Tolkien"
                aria-label="Book author"
                required
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as BookInput["category"],
                  })
                }
                aria-label="Book category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isEditing ? "Save changes" : "Add book"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>

        <section className="card" aria-labelledby="list-heading">
          <div className="list-header">
            <h2 id="list-heading" className="card-title">
              Collection
            </h2>
            <div className="filters" role="group" aria-label="Filter books">
              {(["all", "lent"] as BookFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-btn ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                >
                  {f === "all" ? "All" : "Lent out"}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty">
              {filter === "lent"
                ? "No books are currently lent out."
                : "Your bookshelf is empty. Add a book to get started."}
            </p>
          ) : (
            <ul className="book-list">
              {visible.map((book) => (
                <li key={book.id} className="book-item">
                  <div className="book-info">
                    <p className="book-title">{book.title}</p>
                    <p className="book-meta">
                      by {book.author} · {book.category}
                    </p>
                    {book.borrower ? (
                      <p className="book-status lent">
                        Lent to {book.borrower}
                      </p>
                    ) : (
                      <p className="book-status home">On the shelf</p>
                    )}
                  </div>
                  <div className="book-actions">
                    {book.borrower ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleReturn(book.id)}
                      >
                        Returned
                      </button>
                    ) : (
                      <LendControl
                        onLend={(name) => handleLend(book.id, name)}
                      />
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => startEdit(book)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleRemove(book.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function LendControl({ onLend }: { onLend: (name: string) => void }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onLend(n);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
      >
        Lend out
      </button>
    );
  }

  return (
    <form className="lend-form" onSubmit={submit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Borrower's name"
        aria-label="Borrower's name"
        autoFocus
      />
      <button type="submit" className="btn btn-primary btn-small">
        Lend
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        Cancel
      </button>
    </form>
  );
}


