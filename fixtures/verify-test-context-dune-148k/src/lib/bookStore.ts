import { createCollectionStore } from "./collectionStore";
import { parseBook, type Book } from "./book";

export const BOOKS_STORAGE_KEY = "bookshelf:books";

export function createBookStore(storage?: Storage | null) {
  return createCollectionStore<Book>({
    key: BOOKS_STORAGE_KEY,
    parse: parseBook,
    storage,
  });
}
