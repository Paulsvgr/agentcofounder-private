import { Book } from "../domain/book.js";
import { BookItem } from "./BookItem.js";

interface BookListProps {
  books: Book[];
  onLend: (id: string, borrower: string) => void;
  onReturn: (id: string) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
}

export function BookList({ books, onLend, onReturn, onEdit, onDelete }: BookListProps) {
  if (books.length === 0) {
    return (
      <p className="empty" role="status">
        No books match this view yet. Add one above to get started.
      </p>
    );
  }

  return (
    <ul className="book-list" aria-label="Books">
      {books.map((book) => (
        <BookItem
          key={book.id}
          book={book}
          onLend={onLend}
          onReturn={onReturn}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
