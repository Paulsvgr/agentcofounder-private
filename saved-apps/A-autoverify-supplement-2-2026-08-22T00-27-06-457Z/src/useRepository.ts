import { useState } from "react";
import type { BookRepository } from "./repository";

/**
 * Wraps a repository so the component re-renders after each mutation.
 * The repository itself remains the source of truth for data.
 */
export function useRepository(repository: BookRepository) {
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  return {
    list: () => repository.list(),
    add: (draft: Parameters<BookRepository["add"]>[0]) => {
      const r = repository.add(draft);
      refresh();
      return r;
    },
    update: (id: string, draft: Parameters<BookRepository["update"]>[1]) => {
      repository.update(id, draft);
      refresh();
    },
    remove: (id: string) => {
      repository.remove(id);
      refresh();
    },
    lend: (id: string, borrower: string) => {
      repository.lend(id, borrower);
      refresh();
    },
    returnBook: (id: string) => {
      repository.returnBook(id);
      refresh();
    },
  };
}
