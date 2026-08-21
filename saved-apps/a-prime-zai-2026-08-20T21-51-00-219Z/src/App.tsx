import { useEffect, useState } from "react";
import type { BookRepository } from "./repository";
import { createLocalBookRepository } from "./repository";
import {
  applyFilter,
  countOut,
  createBook,
  lendBook,
  returnBook,
  toRow,
  validateBookInput,
  validateBorrower,
} from "./domain";
import type { Book, BookCategory, BookFilter } from "./types";
import { BOOK_CATEGORIES } from "./types";
import { BookForm } from "./components/BookForm";
import { BookList } from "./components/BookList";

interface AppProps {
  repository?: BookRepository;
}

export function App({ repository }: AppProps) {
  const repo = repository ?? createLocalBookRepository();
  const [books, setBooks] = useState<Book[]>(() => repo.load());
  const [filter, setFilter] = useState<BookFilter>("all");

  useEffect(() => {
    repo.save(books);
  }, [books, repo]);

  const addBook = (title: string, author: string, category: BookCategory) => {
    setBooks((prev) => [...prev, createBook(title, author, category)]);
  };

  const removeBook = (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  const editBook = (id: string, title: string, author: string, category: BookCategory) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, title: title.trim(), author: author.trim(), category } : b,
      ),
    );
  };

  const lend = (id: string, borrower: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? lendBook(b, borrower) : b)),
    );
  };

  const giveReturn = (id: string) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? returnBook(b) : b)));
  };

  const visible = applyFilter(books, filter).map(toRow);
  const outCount = countOut(books);

  return (
    <main className="shell">
      <div className="card">
        <header className="card__header">
          <p className="eyebrow">My book shelf</p>
          <h1>Books on my shelves</h1>
          <p className="muted">
            {books.length} {books.length === 1 ? "book" : "books"} tracked ·{" "}
            <strong data-testid="out-count">{outCount}</strong>{" "}
            {outCount === 1 ? "is" : "are"} currently lent out.
          </p>
        </header>

        <BookForm onAdd={addBook} />

        <nav className="filters" aria-label="Filter books">
          {(["all", "out"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "filter active" : "filter"}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All books" : "Out with someone"}
            </button>
          ))}
        </nav>

        <BookList
          rows={visible}
          onLend={lend}
          onReturn={giveReturn}
          onEdit={editBook}
          onDelete={removeBook}
        />
      </div>
    </main>
  );
}

export { validateBookInput, validateBorrower, BOOK_CATEGORIES };
