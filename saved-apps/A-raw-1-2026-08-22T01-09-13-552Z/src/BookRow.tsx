import { useState } from "react";
import type { Book } from "./types";
import { isLentOut } from "./domain";

interface Props {
  book: Book;
  onLend: (id: string, borrower: string) => void;
  onReturn: (id: string) => void;
  onEdit: (book: Book) => void;
  onRemove: (id: string) => void;
}

export function BookRow({ book, onLend, onReturn, onEdit, onRemove }: Props) {
  const [borrower, setBorrower] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const lent = isLentOut(book);

  function handleLend(e: React.FormEvent) {
    e.preventDefault();
    onLend(book.id, borrower);
    setBorrower("");
  }

  return (
    <li className={`book-row ${lent ? "is-lent" : ""}`}>
      <div className="book-main">
        <h3 className="book-title">{book.title}</h3>
        <p className="book-author">by {book.author}</p>
        <p className="book-kind">
          <span className="badge">{book.kind}</span>
        </p>
        <p className="book-status" data-testid="book-status">
          {lent ? (
            <>
              Lent to <strong>{book.borrower}</strong>
            </>
          ) : (
            "At home"
          )}
        </p>
      </div>
      <div className="book-actions">
        {lent ? (
          <button type="button" onClick={() => onReturn(book.id)}>
            Mark returned
          </button>
        ) : (
          <form onSubmit={handleLend} className="lend-form" aria-label={`Lend ${book.title}`}>
            <label htmlFor={`borrower-${book.id}`} className="sr-only">
              Borrower name
            </label>
            <input
              id={`borrower-${book.id}`}
              type="text"
              placeholder="Borrower name"
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
            />
            <button type="submit" disabled={borrower.trim() === ""}>
              Lend out
            </button>
          </form>
        )}
        <div className="row-actions">
          <button type="button" onClick={() => onEdit(book)}>
            Edit
          </button>
          {confirmRemove ? (
            <>
              <span className="confirm-hint">Remove?</span>
              <button
                type="button"
                onClick={() => {
                  onRemove(book.id);
                  setConfirmRemove(false);
                }}
              >
                Yes, remove
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
