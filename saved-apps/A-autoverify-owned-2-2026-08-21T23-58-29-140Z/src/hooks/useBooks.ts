import { useCallback, useEffect, useMemo, useState } from "react";
import { type BookFilter } from "../domain/book.js";
import { type BookService } from "../services/bookService.js";

export interface UseBooksResult {
  books: ReturnType<BookService["listFiltered"]>;
  filter: BookFilter;
  setFilter: (f: BookFilter) => void;
  lendCount: number;
  refresh: () => void;
  service: BookService;
}

/**
 * Holds the visible book list and exposes the service so components can
 * perform mutations; every mutation re-reads from the service so the UI
 * reflects persisted state.
 */
export function useBooks(service: BookService): UseBooksResult {
  const [filter, setFilter] = useState<BookFilter>("all");
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Re-read when storage changes in another tab or window.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "bookshelf.books.v1") refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const books = useMemo(() => service.listFiltered(filter), [service, filter, version]);
  const lendCount = useMemo(() => service.lendCount(), [service, version]);

  return { books, filter, setFilter, lendCount, refresh, service };
}
