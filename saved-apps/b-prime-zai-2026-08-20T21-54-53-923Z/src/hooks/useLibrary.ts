// Thin service layer wiring persistence to domain operations. The UI talks
// to this, not to storage directly, so storage can be swapped freely.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Book, BookInput } from "../domain/book.js";
import {
  createBook,
  editBook,
  lendBook,
  returnBook,
} from "../domain/book.js";
import { createId } from "../domain/id.js";
import type { BookRepository } from "../persistence/bookRepository.js";

export type LibraryApi = {
  addBook: (input: BookInput) => Book;
  updateBook: (id: string, input: BookInput) => void;
  removeBook: (id: string) => void;
  lend: (id: string, borrower: string) => void;
  ret: (id: string) => void;
};

export type LibraryState = ReturnType<typeof useLibrary>[0];

export function useLibrary(repository: BookRepository) {
  const [books, setBooks] = useState<Book[]>(() => repository.loadAll());

  // Persist whenever the collection changes.
  useEffect(() => {
    repository.saveAll(books);
  }, [books, repository]);

  const addBook = useCallback(
    (input: BookInput): Book => {
      const book = createBook(input, createId());
      setBooks((prev) => [...prev, book]);
      return book;
    },
    [],
  );

  const updateBook = useCallback((id: string, input: BookInput) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? editBook(b, input) : b)),
    );
  }, []);

  const removeBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const lend = useCallback((id: string, borrower: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? lendBook(b, borrower) : b)),
    );
  }, []);

  const ret = useCallback((id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? returnBook(b) : b)),
    );
  }, []);

  const api = useMemo(
    () => ({ addBook, updateBook, removeBook, lend, ret }),
    [addBook, updateBook, removeBook, lend, ret],
  );

  return [books, api] as const;
}
