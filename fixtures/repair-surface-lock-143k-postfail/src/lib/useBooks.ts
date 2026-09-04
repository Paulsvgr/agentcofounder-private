import { useMemo } from "react";
import { useCollection } from "./useCollection";
import { createCollectionStore } from "./collectionStore";
import {
  type Book,
  type BookCategory,
  parseBook,
  cleanText,
} from "../books";

const STORE = createCollectionStore<Book>({
  key: "book-shelf.books.v1",
  parse: parseBook,
});

export type BookFilter = "all" | "lent" | "home";

export function useBooks() {
  const collection = useCollection<Book>(STORE);

  const stats = useMemo(() => {
    const total = collection.items.length;
    let lent = 0;
    for (const b of collection.items) {
      if (b.borrower.trim() !== "") lent++;
    }
    return { total, lent, home: total - lent };
  }, [collection.items]);

  /** Add a book. Returns the new book, or null if title/author are blank. */
  const addBook = (
    rawTitle: string,
    rawAuthor: string,
    category: BookCategory,
  ): Book | null => {
    const title = cleanText(rawTitle);
    const author = cleanText(rawAuthor);
    if (title === "" || author === "") return null;
    return collection.add({ title, author, category, borrower: "" });
  };

  /** Edit title/author/category for an existing book. */
  const editBook = (
    id: string,
    rawTitle: string,
    rawAuthor: string,
    category: BookCategory,
  ): boolean => {
    const title = cleanText(rawTitle);
    const author = cleanText(rawAuthor);
    if (title === "" || author === "") return false;
    collection.update(id, { title, author, category });
    return true;
  };

  /** Mark a book as borrowed by someone. */
  const lendBook = (id: string, rawBorrower: string): boolean => {
    const borrower = cleanText(rawBorrower);
    if (borrower === "") return false;
    collection.update(id, { borrower });
    return true;
  };

  /** Mark a borrowed book as returned home. */
  const returnBook = (id: string): void => {
    collection.update(id, { borrower: "" });
  };

  return {
    items: collection.items,
    stats,
    addBook,
    editBook,
    lendBook,
    returnBook,
    removeBook: collection.remove,
  };
}
