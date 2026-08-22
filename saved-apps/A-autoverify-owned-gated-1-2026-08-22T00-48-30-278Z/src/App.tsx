import { useMemo, useState } from "react";
import type { Book, BookFilter, NewBookInput, BookCategory } from "./types";
import {
  createLocalStorageRepository,
  type BookRepository,
} from "./data/bookRepository";
import {
  createPersistentBookService,
  type BookService,
} from "./services/bookService";
import { countLent, filterBooks } from "./domain/book";
import { BookForm } from "./components/BookForm";
import { BookRow } from "./components/BookRow";

interface AppProps {
  repository?: BookRepository;
  service?: BookService;
}

export function App({ repository, service }: AppProps = {}) {
  const repo = useMemo<BookRepository>(
    () =>
      repository ??
      createLocalStorageRepository(
        typeof window !== "undefined" ? window.localStorage : undefined,
      ),
    [repository],
  );

  const [service_] = useState<BookService>(() => {
    if (service) return service;
    const initial = repo.load();
    return createPersistentBookService(initial, (books) => repo.save(books));
  });

  const [books, setBooks] = useState<Book[]>(() => service_.getAll());
  const [filter, setFilter] = useState<BookFilter>("all");

  function refresh() {
    setBooks(service_.getAll());
  }

  function handleAdd(input: NewBookInput): string | null {
    const result = service_.add(input);
    if (result.ok) refresh();
    return result.ok ? null : result.error;
  }

  function handleEdit(
    id: string,
    changes: { title: string; author: string; category: BookCategory },
  ): string | null {
    const result = service_.edit(id, changes);
    if (result.ok) refresh();
    return result.ok ? null : result.error;
  }

  function handleDelete(id: string): void {
    service_.remove(id);
    refresh();
  }

  function handleLend(id: string, borrower: string): string | null {
    const result = service_.lend(id, borrower);
    if (result.ok) refresh();
    return result.ok ? null : result.error;
  }

  function handleReturn(id: string): void {
    service_.returnLent(id);
    refresh();
  }

  const visible = filterBooks(books, filter);
  const lentCount = countLent(books);

  return (
    <main className="app">
      <header className="app-header">
        <h1>My Shelves</h1>
        <p className="summary" data-testid="summary">
          {lentCount === 0
            ? `All ${books.length} book${books.length === 1 ? "" : "s"} on the shelf.`
            : `${lentCount} of ${books.length} book${books.length === 1 ? "" : "s"} lent out.`}
        </p>
      </header>

      <section aria-labelledby="add-heading" className="add-section">
        <h2 id="add-heading">Add a book</h2>
        <BookForm
          title={undefined}
          submitLabel="Add book"
          onSubmit={handleAdd}
        />
      </section>

      <section aria-labelledby="list-heading" className="list-section">
        <div className="list-controls">
          <h2 id="list-heading">My books</h2>
          <div role="group" aria-label="Filter books" className="filters">
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={filter === "lent"}
              onClick={() => setFilter("lent")}
            >
              Lent out
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="empty" data-testid="empty-state">
            {filter === "lent"
              ? "No books are currently lent out."
              : "No books yet. Add your first book above."}
          </p>
        ) : (
          <ul className="book-list" aria-label="Books on the shelf">
            {visible.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onLend={handleLend}
                onReturn={handleReturn}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

