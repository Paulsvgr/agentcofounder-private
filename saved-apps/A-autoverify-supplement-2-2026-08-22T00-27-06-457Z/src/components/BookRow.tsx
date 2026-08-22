import { useState } from "react";
import type { Book } from "../types";
import type { BookRepository } from "../repository";
import { isLentOut } from "../repository";
import { EditBookForm } from "./EditBookForm";

interface BookRowProps {
  book: Book;
  repository: BookRepository;
  onChanged: () => void;
}

export function BookRow({ book, repository, onChanged }: BookRowProps) {
  const [editing, setEditing] = useState(false);
  const [lending, setLending] = useState(false);
  const [borrower, setBorrower] = useState(book.borrower);
  const [error, setError] = useState<string | null>(null);
  const lent = isLentOut(book);

  function handleLend(e: React.FormEvent) {
    e.preventDefault();
    const name = borrower.trim();
    if (!name) {
      setError("Enter who is borrowing the book.");
      return;
    }
    repository.lend(book.id, name);
    setLending(false);
    setError(null);
    onChanged();
  }

  if (editing) {
    return (
      <EditBookForm
        repository={repository}
        book={book}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <li className="book-row" data-lent={lent}>
      <div className="book-main">
        <p className="book-title">{book.title}</p>
        <p className="book-meta">
          <span className="book-author">{book.author}</span>
          <span className="book-category">{book.category}</span>
        </p>
        <p className="book-status">
          {lent ? (
            <>
              Out with <span data-testid="borrower-name">{book.borrower}</span>
            </>
          ) : (
            "At home"
          )}
        </p>
      </div>
      <div className="book-actions">
        {lending ? (
          <form onSubmit={handleLend} className="lend-form" aria-label={`Lend ${book.title}`}>
            <input
              aria-label="Borrower name"
              value={borrower}
              placeholder="Who has it?"
              onChange={(e) => {
                setBorrower(e.target.value);
                setError(null);
              }}
            />
            <button type="submit">Lend</button>
            <button
              type="button"
              onClick={() => {
                setLending(false);
                setError(null);
                setBorrower(book.borrower);
              }}
            >
              Cancel
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
        ) : (
          <>
            {lent ? (
              <button
                type="button"
                onClick={() => {
                  repository.returnBook(book.id);
                  setBorrower("");
                  onChanged();
                }}
              >
                Returned
              </button>
            ) : (
              <button type="button" onClick={() => setLending(true)}>
                Lend out
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                repository.remove(book.id);
                onChanged();
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
