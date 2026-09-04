import { useState } from "react";
import { useBooks, type BookFilter } from "./lib/useBooks";
import {
  type Book,
  type BookCategory,
  BOOK_CATEGORIES,
  isLentOut,
} from "./books";

export function App() {
  const books = useBooks();
  const [filter, setFilter] = useState<BookFilter>("all");

  const visibleBooks = books.items.filter((b) => {
    if (filter === "lent") return isLentOut(b);
    if (filter === "home") return !isLentOut(b);
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              My Book Shelf
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Track your books and who borrowed them.
            </p>
          </div>
          <StatsBar
            total={books.stats.total}
            lent={books.stats.lent}
            home={books.stats.home}
          />
        </header>

        <AddBookForm onAdd={books.addBook} />

        <FilterTabs filter={filter} onChange={setFilter} lentCount={books.stats.lent} />

        {visibleBooks.length === 0 ? (
          <p
            className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
            data-testid="empty-state"
          >
            {filter === "lent"
              ? "No books are currently lent out."
              : filter === "home"
                ? "No books are currently at home."
                : "No books on your shelf yet. Add your first book above."}
          </p>
        ) : (
          <ul className="mt-6 space-y-2" aria-label="Book list">
            {visibleBooks.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onLend={books.lendBook}
                onReturn={books.returnBook}
                onEdit={books.editBook}
                onRemove={books.removeBook}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatsBar({
  total,
  lent,
  home,
}: {
  total: number;
  lent: number;
  home: number;
}) {
  return (
    <div className="flex gap-4 text-sm">
      <Stat label="Total" value={total} />
      <Stat label="Lent out" value={lent} />
      <Stat label="At home" value={home} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-3 py-1"
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <span className="text-lg font-bold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function AddBookForm({
  onAdd,
}: {
  onAdd: (title: string, author: string, category: BookCategory) => Book | null;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<BookCategory>("Fiction");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onAdd(title, author, category);
    if (result) {
      setTitle("");
      setAuthor("");
      setCategory("Fiction");
      setError(null);
    } else {
      setError("Please enter both a title and an author.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Add a book"
    >
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a book</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Title
          </span>
          <input
            type="text"
            aria-label="Book title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="The Great Gatsby"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Author
          </span>
          <input
            type="text"
            aria-label="Book author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="F. Scott Fitzgerald"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Category
          </span>
          <select
            aria-label="Book category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BookCategory)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {BOOK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Add book
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function FilterTabs({
  filter,
  onChange,
  lentCount,
}: {
  filter: BookFilter;
  onChange: (f: BookFilter) => void;
  lentCount: number;
}) {
  const tabs: { key: BookFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "lent", label: `Lent out (${lentCount})` },
    { key: "home", label: "At home" },
  ];
  return (
    <div
      className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1"
      role="tablist"
      aria-label="Filter books"
    >
      {tabs.map((tab) => {
        const active = filter === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
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
  onLend: (id: string, borrower: string) => boolean;
  onReturn: (id: string) => void;
  onEdit: (id: string, title: string, author: string, category: BookCategory) => boolean;
  onRemove: (id: string) => void;
}) {
  const lent = isLentOut(book);
  const [lending, setLending] = useState(false);
  const [borrower, setBorrower] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const startLend = () => {
    setBorrower("");
    setLending(true);
  };

  const handleLendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onLend(book.id, borrower);
    if (ok) {
      setLending(false);
      setBorrower("");
    }
  };

  if (editing) {
    return (
      <EditBookRow
        book={book}
        onEdit={onEdit}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <li
      className={`rounded-xl border p-4 shadow-sm transition ${
        lent
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {book.title}
            </h3>
            {lent && (
              <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                Lent out
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">by {book.author}</p>
          <p className="mt-0.5 text-xs text-slate-400">{book.category}</p>
          {lent && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Borrowed by {book.borrower}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {lending ? (
            <form
              onSubmit={handleLendSubmit}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                aria-label="Borrower name"
                placeholder="Borrower name"
                value={borrower}
                onChange={(e) => setBorrower(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Lend
              </button>
              <button
                type="button"
                onClick={() => setLending(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </form>
          ) : confirmRemove ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Remove?</span>
              <button
                onClick={() => onRemove(book.id)}
                className="rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {lent ? (
                <button
                  onClick={() => onReturn(book.id)}
                  className="rounded-lg bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Return
                </button>
              ) : (
                <button
                  onClick={startLend}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  Lend out
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmRemove(true)}
                className="rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
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

function EditBookRow({
  book,
  onEdit,
  onCancel,
}: {
  book: Book;
  onEdit: (id: string, title: string, author: string, category: BookCategory) => boolean;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState<BookCategory>(book.category);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onEdit(book.id, title, author, category);
    if (ok) {
      setError(null);
      onCancel();
    } else {
      setError("Title and author are required.");
    }
  };

  return (
    <li className="rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-sm">
      <form onSubmit={handleSubmit} aria-label="Edit book">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Title
            </span>
            <input
              type="text"
              aria-label="Book title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Author
            </span>
            <input
              type="text"
              aria-label="Book author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Category
            </span>
            <select
              aria-label="Book category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BookCategory)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {BOOK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </li>
  );
}
