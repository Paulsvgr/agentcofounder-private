import { useCallback, useEffect, useState } from "react";
import type { BookRepository } from "./repository";
import type { Book, NewBookInput } from "./types";

export function useBooks(repo: BookRepository) {
  const [books, setBooks] = useState<Book[]>(() => repo.list());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBooks(repo.list());
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const withError = (fn: () => void, fallback: string) => {
    try {
      setError(null);
      fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  return {
    books,
    error,
    clearError: () => setError(null),
    add: (input: NewBookInput) => withError(() => repo.add(input), "Could not add book"),
    remove: (id: string) => withError(() => repo.remove(id), "Could not remove book"),
    edit: (id: string, input: NewBookInput) =>
      withError(() => repo.edit(id, input), "Could not update book"),
    lend: (id: string, borrower: string) =>
      withError(() => repo.lend(id, borrower), "Could not lend book"),
    returnBook: (id: string) => withError(() => repo.returnBook(id), "Could not return book"),
  };
}
