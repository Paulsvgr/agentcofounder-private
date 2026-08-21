import { categoryLabel, type Book } from "./types.js";

export type BookAction = "edit" | "delete" | "lend" | "return";

interface BookListProps {
  books: Book[];
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onLend: (book: Book) => void;
  onReturn: (book: Book) => void;
}

export const BookList = ({
  books,
  onEdit,
  onDelete,
  onLend,
  onReturn,
}: BookListProps) => {
  if (books.length === 0) {
    return (
      <p className="empty-state" role="status">
        No books to show. Add one to get started.
      </p>
    );
  }

  return (
    <ul className="book-list" aria-label="Books on my shelf">
      {books.map((book) => (
        <li key={book.id} className="book-item">
          <div className="book-details">
            <span className="book-title">{book.title}</span>
            <span className="book-author">by {book.author}</span>
            <span className="book-category">{categoryLabel(book.category)}</span>
            {book.borrowerName ? (
              <span className="book-borrowed" data-testid={`borrowed-${book.id}`}>
                Out with {book.borrowerName}
              </span>
            ) : (
              <span className="book-home" data-testid={`home-${book.id}`}>
                On the shelf
              </span>
            )}
          </div>
          <div className="book-actions">
            {book.borrowerName ? (
              <button
                type="button"
                aria-label={`Mark ${book.title} as returned`}
                onClick={() => onReturn(book)}
              >
                Mark returned
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Lend ${book.title} to someone`}
                onClick={() => onLend(book)}
              >
                Lend out
              </button>
            )}
            <button
              type="button"
              aria-label={`Edit ${book.title}`}
              onClick={() => onEdit(book)}
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Delete ${book.title}`}
              onClick={() => onDelete(book)}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
