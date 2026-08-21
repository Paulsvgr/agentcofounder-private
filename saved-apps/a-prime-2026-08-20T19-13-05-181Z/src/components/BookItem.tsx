import { FormEvent, useState } from "react";
import { Book, isLentOut, validateBorrower } from "../domain/book.js";

interface BookItemProps {
  book: Book;
  onLend: (id: string, borrower: string) => void;
  onReturn: (id: string) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
}

export function BookItem({ book, onLend, onReturn, onEdit, onDelete }: BookItemProps) {
  const [borrower, setBorrower] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const lent = isLentOut(book);

  function handleLend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const err = validateBorrower(borrower);
    if (err) {
      setError(err);
      return;
    }
    onLend(book.id, borrower);
    setBorrower("");
    setError(undefined);
  }

  return (
    <li className="book">
      <div className="book-head">
        <h3 className="book-title">{book.title || "Untitled"}</h3>
        <p className="book-author">by {book.author || "Unknown"}</p>
        <p className="book-category">
          <span className="tag">{book.category}</span>
        </p>
      </div>

      <div className="book-loan">
        {lent ? (
          <p className="loan-status lent">
            On loan to <strong>{book.borrower}</strong>
          </p>
        ) : (
          <p className="loan-status home">On the shelf</p>
        )}
      </div>

      <div className="book-actions">
        {lent ? (
          <button type="button" onClick={() => onReturn(book.id)}>
            Mark returned
          </button>
        ) : (
          <form className="lend-form" onSubmit={handleLend}>
            <label htmlFor={`borrower-${book.id}`} className="sr-only">
              Who is borrowing {book.title || "this book"}?
            </label>
            <input
              id={`borrower-${book.id}`}
              type="text"
              placeholder="Borrower's name"
              value={borrower}
              onChange={(e) => {
                setBorrower(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `borrower-error-${book.id}` : undefined}
              autoComplete="off"
            />
            <button type="submit" className="secondary">
              Lend out
            </button>
            {error ? (
              <span id={`borrower-error-${book.id}`} className="error" role="alert">
                {error}
              </span>
            ) : null}
          </form>
        )}

        <div className="book-meta-actions">
          <button type="button" onClick={() => onEdit(book)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => onDelete(book.id)}
            aria-label={`Delete ${book.title || "untitled book"}`}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
