import { useMemo, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { createBookStore } from "@/lib/bookStore";
import {
  BOOK_CATEGORIES,
  makeBookFields,
  type Book,
  type BookCategory,
} from "@/lib/book";
import { normalizeText } from "@/lib/text";

type FilterMode = "all" | "lent";

const store = createBookStore();

export function App() {
  const { items: books, add, update, remove } = useCollection<Book>(store);

  const [filter, setFilter] = useState<FilterMode>("all");
  const [showForm, setShowForm] = useState(false);

  const lentCount = useMemo(
    () => books.filter((b) => b.borrower !== null).length,
    [books],
  );

  const visibleBooks = useMemo(() => {
    const list = filter === "lent" ? books.filter((b) => b.borrower !== null) : books;
    return [...list].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }, [books, filter]);

  function handleAdd(input: {
    title: string;
    author: string;
    category: BookCategory;
  }) {
    add(makeBookFields(input));
    setShowForm(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Bookshelf</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track your books and who has borrowed them.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="group" aria-label="Filter books">
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All books"
              count={books.length}
            />
            <FilterButton
              active={filter === "lent"}
              onClick={() => setFilter("lent")}
              label="Lent out"
              count={lentCount}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-expanded={showForm}
            aria-controls="add-book-form"
          >
            {showForm ? "Cancel" : "Add book"}
          </button>
        </div>

        {lentCount > 0 && (
          <p
            className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800"
            role="status"
          >
            {lentCount} {lentCount === 1 ? "book is" : "books are"} currently lent out.
          </p>
        )}

        {showForm && (
          <AddBookForm
            onAdd={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        )}

        {visibleBooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            {filter === "lent"
              ? "No books are currently lent out."
              : "Your bookshelf is empty. Click \u201CAdd book\u201D to get started."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleBooks.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onLend={(borrower) => update(book.id, { borrower })}
                onReturn={() => update(book.id, { borrower: null })}
                onEdit={(fields) => update(book.id, fields)}
                onRemove={() => remove(book.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          : "rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
      }
    >
      {label} ({count})
    </button>
  );
}

function AddBookForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: { title: string; author: string; category: BookCategory }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<BookCategory>("Fiction");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = normalizeText(title);
    const a = normalizeText(author);
    if (t.length === 0) {
      setError("Please enter a title.");
      return;
    }
    if (a.length === 0) {
      setError("Please enter an author.");
      return;
    }
    onAdd({ title: t, author: a, category });
  }

  return (
    <form
      id="add-book-form"
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Add a book"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Add a book</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="The Hobbit"
            aria-label="Title"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Author</span>
          <input
            type="text"
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="J.R.R. Tolkien"
            aria-label="Author"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BookCategory)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Category"
          >
            {BOOK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Save book
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function BookRow({
  book,
  onLend,
  onReturn,
  onEdit,
  onRemove,
}: {
  book: Book;
  onLend: (borrower: string) => void;
  onReturn: () => void;
  onEdit: (fields: { title: string; author: string; category: BookCategory }) => void;
  onRemove: () => void;
}) {
  const [mode, setMode] = useState<"view" | "lend" | "edit">("view");
  const [borrowerInput, setBorrowerInput] = useState("");
  const [editTitle, setEditTitle] = useState(book.title);
  const [editAuthor, setEditAuthor] = useState(book.author);
  const [editCategory, setEditCategory] = useState<BookCategory>(book.category);
  const [editError, setEditError] = useState<string | null>(null);

  const isLent = book.borrower !== null;

  function handleLendSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = normalizeText(borrowerInput);
    if (name.length === 0) return;
    onLend(name);
    setBorrowerInput("");
    setMode("view");
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = normalizeText(editTitle);
    const a = normalizeText(editAuthor);
    if (t.length === 0) {
      setEditError("Please enter a title.");
      return;
    }
    if (a.length === 0) {
      setEditError("Please enter an author.");
      return;
    }
    onEdit({ title: t, author: a, category: editCategory });
    setEditError(null);
    setMode("view");
  }

  if (mode === "edit") {
    return (
      <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleEditSubmit} aria-label={`Edit ${book.title}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Title"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Author</span>
              <input
                type="text"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Author"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as BookCategory)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Category"
              >
                {BOOK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {editError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => {
                setEditTitle(book.title);
                setEditAuthor(book.author);
                setEditCategory(book.category);
                setEditError(null);
                setMode("view");
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">{book.title}</h3>
          <p className="text-sm text-slate-600">by {book.author}</p>
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {book.category}
          </span>
          {isLent && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              Lent to {book.borrower}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "lend" ? (
            <form onSubmit={handleLendSubmit} className="flex items-center gap-2" aria-label={`Lend ${book.title}`}>
              <input
                type="text"
                value={borrowerInput}
                autoFocus
                onChange={(e) => setBorrowerInput(e.target.value)}
                placeholder="Borrower's name"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Borrower's name"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setBorrowerInput("");
                  setMode("view");
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              {isLent ? (
                <button
                  type="button"
                  onClick={onReturn}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Mark returned
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("lend")}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Lend out
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
