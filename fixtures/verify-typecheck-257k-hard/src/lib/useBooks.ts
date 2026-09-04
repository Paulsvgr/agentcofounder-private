import { createCollectionStore } from "./collectionStore";
import { useCollection } from "./useCollection";
import { parseBook, type Book } from "./book";

const STORE_KEY = "bookshelf.books.v1";

const store = createCollectionStore<Book>({
  key: STORE_KEY,
  parse: parseBook,
});

export type BookFilter = "all" | "borrowed";

export interface UseBooksResult {
  books: Book[];
  addBook: (fields: { title: string; author: string; category: Book["category"] }) => Book;
  updateBook: (
    id: string,
    patch: Partial<Omit<Book, "id">>,
  ) => void;
  removeBook: (id: string) => void;
  lendBook: (id: string, borrower: string) => void;
  returnBook: (id: string) => void;
}

/**
 * CRUD + lending operations over the book collection. All mutations are
 * persisted to localStorage via the underlying collection store.
 */
export function useBooks(): UseBooksResult {
  const { items, add, update, remove } = useCollection<Book>(store);

  return {
    books: items,
    addBook: (fields) => add({ ...fields, borrowedBy: null }),
    updateBook: (id, patch) => update(id, patch),
    removeBook: (id) => remove(id),
    lendBook: (id, borrower) => update(id, { borrowedBy: borrower }),
    returnBook: (id) => update(id, { borrowedBy: null }),
  };
}
