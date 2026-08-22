import { useState } from "react";
import type { Book } from "../domain.js";

interface BookRowProps {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onLend: (book: Book, borrower: string) => void;
  onReturn: (book: Book) => void;
}

function ConfirmDelete({ book, onConfirm, onCancel }: {
  book: Book;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="row-confirm" role="alertdialog" aria-label="Delete book">
      <p>
        Remove <strong>{book.title}</strong> by {book.author} from your library?
      </p>
      <div className="row-confirm-actions">
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          Delete
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Keep
        </button>
      </div>
    </div>
  );
}

export function BookRow({ book, onEdit, onDelete, onLend, onReturn }: BookRowProps) {
  const [lending, setLending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [borrower, setBorrower] = useState("");

  const lentOut = book.borrower !== null;

  if (confirmingDelete) {
    return (
      <li className="book-row" data-status={lentOut ? "lent" : "home"}>
        <ConfirmDelete
          book={book}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(book);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      </li>
    );
  }

  return (
    <li className="book-row" data-status={lentOut ? "lent" : "home"}>
      <div className="book-row-main">
        <div className="book-title-line">
          <span className="book-title">{book.title}</span>
          <span className="book-author">by {book.author}</span>
        </div>
        <div className="book-meta">
          <span className="badge badge-category">{book.category}</span>
          {lentOut ? (
            <span className="badge badge-lent" aria-label={`Borrowed by ${book.borrower}`}>
              Out: {book.borrower}
            </span>
          ) : (
            <span className="badge badge-home">On shelf</span>
          )}
        </div>
      </div>
      <div className="book-row-actions">
        {!lentOut && !lending && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLending(true);
              setBorrower("");
            }}
          >
            Lend out
          </button>
        )}
        {lentOut && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onReturn(book)}
          >
            Mark returned
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onEdit(book)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      </div>
      {lending && (
        <form
          className="lend-form"
          onSubmit={(e) => {
            e.preventDefault();
            onLend(book, borrower);
            setBorrower("");
            setLending(false);
          }}
        >
          <label className="field">
            <span className="field-label">Borrower name</span>
            <input
              type="text"
              className="field-input"
              value={borrower}
              autoFocus
              placeholder="Who is borrowing it?"
              onChange={(e) => setBorrower(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Confirm loan
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setLending(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
