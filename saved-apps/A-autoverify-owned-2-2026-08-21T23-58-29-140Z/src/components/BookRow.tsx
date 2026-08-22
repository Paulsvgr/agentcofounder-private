import { useState } from "react";
import { type Book } from "../domain/book.js";
import { type BookService } from "../services/bookService.js";

interface BookRowProps {
  book: Book;
  service: BookService;
  onChanged: () => void;
  onEdit: (book: Book) => void;
}

export function BookRow({ book, service, onChanged, onEdit }: BookRowProps) {
  const [borrower, setBorrower] = useState("");
  const [error, setError] = useState("");

  function handleLend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = service.lendBook(book.id, borrower);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBorrower("");
    setError("");
    onChanged();
  }

  function handleReturn() {
    service.returnBook(book.id);
    setBorrower("");
    setError("");
    onChanged();
  }

  function handleDelete() {
    service.deleteBook(book.id);
    onChanged();
  }

  const out = book.borrower.length > 0;

  return (
    <li className={`book-row ${out ? "is-out" : ""}`} aria-label={`Book: ${book.title}`}>
      <div className="book-main">
        <p className="book-title">{book.title}</p>
        <p className="book-meta">
          <span className="book-author">by {book.author}</span>
          <span className="book-category" data-testid="category">{book.category}</span>
        </p>
        <p className="book-status" data-testid="status">
          {out ? (
            <>Out with <strong>{book.borrower}</strong></>
          ) : (
            "On the shelf"
          )}
        </p>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>

      <div className="book-actions">
        {out ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleReturn}
            aria-label={`Mark ${book.title} as returned`}
          >
            Mark returned
          </button>
        ) : (
          <form className="lend-form" onSubmit={handleLend} aria-label={`Lend ${book.title} out`}>
            <label className="sr-only" htmlFor={`borrower-${book.id}`}>Borrower name</label>
            <input
              id={`borrower-${book.id}`}
              type="text"
              placeholder="Borrower name"
              value={borrower}
              maxLength={120}
              onChange={(e) => setBorrower(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Lend out</button>
          </form>
        )}

        <div className="row-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onEdit(book)}
            aria-label={`Edit ${book.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            aria-label={`Delete ${book.title}`}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
