import { useState } from "react";
import type { Book } from "./types.js";
import { isLent } from "./types.js";

interface BookRowProps {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onLend: (book: Book, borrower: string) => void;
  onReturn: (book: Book) => void;
}

export function BookRow({
  book,
  onEdit,
  onDelete,
  onLend,
  onReturn,
}: BookRowProps) {
  const [borrower, setBorrower] = useState("");
  const lent = isLent(book);

  function handleLend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = borrower.trim();
    if (!name) return;
    onLend(book, name);
    setBorrower("");
  }

  return (
    <li className="book-row" data-lent={lent}>
      <div className="book-main">
        <p className="book-title">{book.title}</p>
        <p className="book-meta">
          <span className="book-author">by {book.author}</span>
          <span className="book-category">{book.category}</span>
        </p>
        <p className="book-status" data-status={lent ? "out" : "home"}>
          {lent ? `Out with ${book.borrower}` : "At home"}
        </p>
        {lent ? (
          <button
            type="button"
            className="secondary"
            onClick={() => onReturn(book)}
            aria-label={`Mark ${book.title} as returned`}
          >
            Mark returned
          </button>
        ) : (
          <form className="lend-form" onSubmit={handleLend}>
            <label className="field inline">
              <span className="visually-hidden">Borrower name</span>
              <input
                name="borrower"
                type="text"
                value={borrower}
                placeholder="Borrower's name"
                onChange={(e) => setBorrower(e.target.value)}
                aria-label={`Borrower for ${book.title}`}
                autoComplete="off"
              />
            </label>
            <button type="submit" aria-label={`Lend ${book.title} out`}>
              Lend out
            </button>
          </form>
        )}
      </div>
      <div className="book-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => onEdit(book)}
          aria-label={`Edit ${book.title}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onDelete(book)}
          aria-label={`Delete ${book.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
