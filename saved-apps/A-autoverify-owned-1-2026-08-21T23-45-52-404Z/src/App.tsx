import { useMemo, useState } from "react";
import { BookForm, type BookFormValues } from "./components/BookForm.js";
import { BookRow } from "./components/BookRow.js";
import { countLentOut, type Book, type BookCategory } from "./domain.js";
import { useBooks } from "./hooks/useBooks.js";

type Filter = "all" | "out";
type FormState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; book: Book };

function sortBooks(books: readonly Book[]): Book[] {
  return [...books].sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.author.localeCompare(b.author, undefined, { sensitivity: "base" });
  });
}

export function App() {
  const { books, addBook, updateBook, removeBook, lendBook, returnBook, isDuplicate } =
    useBooks();
  const [filter, setFilter] = useState<Filter>("all");
  const [formState, setFormState] = useState<FormState>({ mode: "closed" });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<"title" | "author", string>>
  >({});
  const [lendError, setLendError] = useState<string | null>(null);

  const lentCount = useMemo(() => countLentOut(books), [books]);
  const visibleBooks = useMemo(
    () => sortBooks(books.filter((b) => (filter === "out" ? b.borrower !== null : true))),
    [books, filter],
  );

  const openAdd = () => {
    setFormErrors({});
    setFormState({ mode: "add" });
  };
  const openEdit = (book: Book) => {
    setFormErrors({});
    setFormState({ mode: "edit", book });
  };
  const closeForm = () => setFormState({ mode: "closed" });

  const handleAdd = (values: BookFormValues) => {
    const result = addBook(values);
    if (result.ok) {
      closeForm();
    } else {
      setFormErrors(result.errors);
    }
  };

  const handleUpdate = (values: BookFormValues) => {
    if (formState.mode !== "edit") return;
    const result = updateBook(formState.book.id, values);
    if (result.ok) {
      closeForm();
    } else {
      setFormErrors(result.errors);
    }
  };

  const handleLend = (book: Book, borrower: string) => {
    const result = lendBook(book.id, borrower);
    if (!result.ok) setLendError(result.error);
  };
  const handleReturn = (book: Book) => {
    setLendError(null);
    returnBook(book.id);
  };

  const addDuplicate = false;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>My Book Shelf</h1>
          <p className="subtitle">
            {books.length} {books.length === 1 ? "book" : "books"} in your library
            {" · "}
            <span data-testid="lent-count">{lentCount}</span> currently lent out
          </p>
        </div>
        <div className="header-actions">
          <div className="filter-group" role="group" aria-label="Filter books">
            <button
              type="button"
              className={`btn btn-toggle ${filter === "all" ? "is-active" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All books
            </button>
            <button
              type="button"
              className={`btn btn-toggle ${filter === "out" ? "is-active" : ""}`}
              aria-pressed={filter === "out"}
              onClick={() => setFilter("out")}
            >
              Lent out
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            Add a book
          </button>
        </div>
      </header>

      {lendError && (
        <p className="banner banner-error" role="alert">
          {lendError}
        </p>
      )}

      {formState.mode === "add" && (
        <BookForm
          heading="Add a book"
          submitLabel="Add book"
          onSubmit={handleAdd}
          onCancel={closeForm}
          fieldErrors={formErrors}
          isDuplicate={addDuplicate}
        />
      )}

      {formState.mode === "edit" && (
        <BookForm
          heading="Edit book"
          submitLabel="Save changes"
          initial={{
            title: formState.book.title,
            author: formState.book.author,
            category: formState.book.category,
          }}
          onSubmit={handleUpdate}
          onCancel={closeForm}
          fieldErrors={formErrors}
          isDuplicate={isDuplicate(
            {
              title: formState.book.title,
              author: formState.book.author,
              category: formState.book.category,
            },
            formState.book.id,
          )}
        />
      )}

      <section aria-label="Book list">
        {books.length === 0 ? (
          <div className="empty-state">
            <p>Your shelf is empty. Add your first book to get started.</p>
          </div>
        ) : visibleBooks.length === 0 ? (
          <div className="empty-state">
            <p>No books are currently lent out. Everything is on the shelf.</p>
          </div>
        ) : (
          <ul className="book-list" aria-label="Books">
            {visibleBooks.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onEdit={openEdit}
                onDelete={(b) => removeBook(b.id)}
                onLend={handleLend}
                onReturn={handleReturn}
              />
            ))}
          </ul>
        )}
      </section>

      <footer className="app-footer">
        <p>Saved on this computer. It's just you and your books.</p>
      </footer>
    </main>
  );
}
