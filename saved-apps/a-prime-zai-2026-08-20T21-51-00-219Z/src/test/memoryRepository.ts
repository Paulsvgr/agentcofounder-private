import type { Book } from "../types";

/** In-memory repository used in tests to avoid touching real localStorage. */
export function createMemoryRepository(initial: Book[] = []) {
  let data: Book[] = [...initial];
  return {
    load() {
      return data;
    },
    save(books: Book[]) {
      data = [...books];
    },
  };
}
