import { useMemo, useState } from "react";
import { BOOK_CATEGORIES, type Book, type BookCategory } from "@/lib/book";
import { useBooks } from "@/lib/useBooks";

type Filter = "all" | "borrowed";

interface DraftBook {
  title: string;
  author: string;
  category: BookCategory;
}

const EMPTY_DRAFT: DraftBook = { title: "", author: "", category: "Novel" };

export function App() {
  const { books, addBook, updateBook, removeBook, lendBook, returnBook } = useBooks();

  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<DraftBook>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftBook>(EMPTY_DRAFT);
  const [lendId, setLendId] = useState<string | null>(null);
  const [borrowerName, setBorrowerName] = useState("");

  const borrowedCount = useMemo(
    () => books.filter((b) => b.borrowedBy != null && b.borrowedBy !== "").length,
    [books],
  );

  const visibleBooks = useMemo(
    () =>
      filter === "borrowed"
        ? books.filter((b) => b.borrowedBy != null && b.borrowedBy !== "")
        : books,
    [books, filter],
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    const author = draft.author.trim();
    if (!title || !author) return;
    addBook({ title, author, category: draft.category });
    setDraft(EMPTY_DRAFT);
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setEditDraft({ title: book.title, author: book.author, category: book.category });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const title = editDraft.title.trim();
    const author = editDraft.author.trim();
    if (!title || !author) return;
    updateBook(editingId, { title, author, category: editDraft.category });
    setEditingId(null);
  }

  function startLend(id: string) {
    setLendId(id);
    setBorrowerName("");
  }

  function cancelLend() {
    setLendId(null);
    setBorrowerName("");
  }

  function submitLend(e: React.FormEvent) {
    e.preventDefault();
    if (!lendId) return;
    const name = borrowerName.trim();
    if (!name) return;
    lendBook(lendId, name);
    setLendId(null);
    setBorrowerName("");
  }

  function handleReturn(id: string) {
    returnBook(id);
  }

  function handleDelete(id: string) {
    removeBook(id);
    if (editingId === id) setEditingId(null);
    if (lendId === id) setLendId(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-600">
            My Bookshelf
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Books &amp; Borrowers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Keep track of your books and who has them right now.
          </p>
        </header>

        {/* Summary */}
        <section
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          aria-label="Bookshelf summary"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              <span className="font-semibold">{books.length}</span>
              <span className="text-slate-500"> total books</span>
            </span>
            <span>
              <span className="font-semibold text-amber-600">{borrowedCount}</span>
              <span className="text-slate-500"> lent out now</span>
            </span>
            <span>
              <span className="font-semibold text-emerald-600">
                {books.length - borrowedCount}
              </span>
              <span className="text-slate-500"> at home</span>
            </span>
          </div>
        </section>

        {/* Add book */}
        <section
          className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          aria-label="Add a book"
        >
          <h2 className="mb-3 text-lg font-semibold">Add a book</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 flex flex-col gap-1 text-sm font-medium text-slate-700">
              Title
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. The Lord of the Rings"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Author
              <input
                type="text"
                value={draft.author}
                onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                placeholder="e.g. J.R.R. Tolkien"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Category
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as BookCategory })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!draft.title.trim() || !draft.author.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to shelf
              </button>
            </div>
          </form>
        </section>

        {/* Filter */}
        <section className="mb-4 flex items-center gap-2" aria-label="Filter books">
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (filter === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100")
            }
          >
            All ({books.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("borrowed")}
            aria-pressed={filter === "borrowed"}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (filter === "borrowed"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100")
            }
          >
            Lent out ({borrowedCount})
          </button>
        </section>

        {/* Book list */}
        <section aria-label="Book list">
          {visibleBooks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {filter === "borrowed"
                ? "No books are currently lent out."
                : "Your shelf is empty. Add your first book above."}
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleBooks.map((book) => (
                <li
                  key={book.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {editingId === book.id ? (
                    /* ---- Inline edit form ---- */
                    <form onSubmit={saveEdit} className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Title
                          <input
                            type="text"
                            value={editDraft.title}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, title: e.target.value })
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Author
                          <input
                            type="text"
                            value={editDraft.author}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, author: e.target.value })
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                          Category
                          <select
                            value={editDraft.category}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                category: e.target.value as BookCategory,
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {BOOK_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!editDraft.title.trim() || !editDraft.author.trim()}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* ---- Book card ---- */
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold leading-tight text-slate-900">
                            {book.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-slate-600">by {book.author}</p>
                          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {book.category}
                          </span>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                          {book.borrowedBy ? (
                            <button
                              type="button"
                              onClick={() => handleReturn(book.id)}
                              aria-label={`Mark ${book.title} returned`}
                              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                            >
                              Mark returned
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startLend(book.id)}
                              aria-label={`Lend ${book.title} out`}
                              className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                            >
                              Lend out
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(book.id)}
                            aria-label={`Edit ${book.title}`}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-200 transition hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(book.id)}
                            aria-label={`Delete ${book.title}`}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Borrow status */}
                      {book.borrowedBy && (
                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {`On loan to ${book.borrowedBy}`}
                        </p>
                      )}

                      {/* Lend form */}
                      {lendId === book.id && (
                        <form onSubmit={submitLend} className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={borrowerName}
                            onChange={(e) => setBorrowerName(e.target.value)}
                            placeholder="Who is borrowing this book?"
                            autoFocus
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={!borrowerName.trim()}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Lend
                          </button>
                          <button
                            type="button"
                            onClick={cancelLend}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
