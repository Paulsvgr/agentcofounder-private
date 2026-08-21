import type { Book } from "./types.js";

interface BookRowProps {
  book: Book;
  editing: boolean;
  onLend: (book: Book) => void;
  onReturn: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

interface BookListProps {
  books: Book[];
  onLend: (book: Book) => void;
  onReturn: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

function BookRow({ book, editing, onLend, onReturn, onEdit, onDelete }: BookRowProps) {
  return (
    <li className={`book-row ${book.borrower ? "is-lent" : ""}`}>
      <div className="book-row-main">
        <span className="book-title">{book.title}</span>
        <span className="book-author">by {book.author}</span>
        <span className="book-category">{book.category}</span>
        {book.borrower ? (
          <span className="book-borrower">
            Lent to <strong>{book.borrower}</strong>
          </span>
        ) : (
          <span className="book-borrower on-shelf">On the shelf</span>
        )}
      </div>
      <div className="book-row-actions">
        {book.borrower ? (
          <button type="button" onClick={() => onReturn(book)}>
            Returned
          </button>
        ) : (
          <button type="button" onClick={() => onLend(book)} disabled={editing}>
            Lend out
          </button>
        )}
        <button type="button" onClick={() => onEdit(book)} disabled={editing}>
          Edit
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onDelete(book)}
          disabled={editing}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function BookList({ books, onLend, onReturn, onEdit, onDelete }: BookListProps) {
  if (books.length === 0) {
    return (
      <p className="empty-state" role="status">
        No books here yet. Add your first book above.
      </p>
    );
  }
  return (
    <ul className="book-list" aria-label="Your books">
      {books.map((book) => (
        <BookRow
          key={book.id}
          book={book}
          editing={false}
          onLend={onLend}
          onReturn={onReturn}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
