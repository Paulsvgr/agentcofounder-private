import { useState } from "react";
import type { Book, BookCategory } from "../types";
import { BookForm } from "./BookForm";
import type { NewBookInput } from "../types";

interface BookRowProps {
  book: Book;
  onEdit: (
    id: string,
    changes: { title: string; author: string; category: BookCategory },
  ) => string | null;
  onDelete: (id: string) => void;
  onLend: (id: string, borrower: string) => string | null;
  onReturn: (id: string) => void;
}

export function BookRow({
  book,
  onEdit,
  onDelete,
  onLend,
  onReturn,
}: BookRowProps) {
  const [editing, setEditing] = useState(false);
  const [lending, setLending] = useState(false);
  const [borrower, setBorrower] = useState("");
  const [lendError, setLendError] = useState<string | null>(null);

  function handleLend(e: React.FormEvent) {
    e.preventDefault();
    const result = onLend(book.id, borrower);
    if (result) {
      setLendError(result);
      return;
    }
    setLendError(null);
    setBorrower("");
    setLending(false);
  }

  if (editing) {
    return (
      <li className="book-row editing">
        <BookForm
          title="Edit book"
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
          initial={{
            title: book.title,
            author: book.author,
            category: book.category,
          }}
          onSubmit={(input: NewBookInput) =>
            onEdit(book.id, {
              title: input.title,
              author: input.author,
              category: input.category,
            })
          }
        />
      </li>
    );
  }

  return (
    <li className="book-row" data-testid="book-item">
      <div className="book-meta">
        <span className="book-title">{book.title}</span>
        <span className="book-author">by {book.author}</span>
        <span className="book-category">{book.category}</span>
      </div>
      <div className="book-status">
        {book.borrower ? (
          <span className="status lent">
            Out with{" "}
            <strong data-testid="borrower-name">{book.borrower}</strong>
          </span>
        ) : (
          <span className="status home">On shelf</span>
        )}
      </div>
      <div className="book-actions">
        {book.borrower ? (
          <button
            type="button"
            onClick={() => onReturn(book.id)}
            aria-label={`Mark ${book.title} as returned`}
          >
            Returned
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLending((v) => !v)}
            aria-label={`Lend ${book.title} out`}
          >
            Lend out
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${book.title}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(book.id)}
          aria-label={`Remove ${book.title}`}
          className="danger"
        >
          Remove
        </button>
      </div>
      {lending && !book.borrower && (
        <form className="lend-form" onSubmit={handleLend}>
          <label className="field">
            <span>Borrower name</span>
            <input
              type="text"
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              aria-label={`Borrower name for ${book.title}`}
              placeholder="Who is borrowing this book"
              autoFocus
            />
          </label>
          {lendError && (
            <p role="alert" className="error">
              {lendError}
            </p>
          )}
          <button type="submit">Confirm lend</button>
          <button type="button" onClick={() => setLending(false)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}
