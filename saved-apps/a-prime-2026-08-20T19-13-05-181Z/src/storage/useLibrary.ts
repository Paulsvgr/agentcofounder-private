// React state adapter over the repository. Components depend on this hook,
// not on localStorage, keeping the persistence seam clean.
import { useCallback, useEffect, useState } from "react";
import {
  Book,
  BookInput,
  createBook,
  lendBook,
  returnBook,
  updateBook,
} from "../domain/book.js";
import { loadBooks, saveBooks } from "./bookRepository.js";

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>(() => loadBooks());

  useEffect(() => {
    saveBooks(books);
  }, [books]);

  const addBook = useCallback((input: BookInput) => {
    setBooks((prev) => [...prev, createBook(input)]);
  }, []);

  const editBook = useCallback((id: string, input: BookInput) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? updateBook(b, input) : b)),
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

  const returnLoan = useCallback((id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? returnBook(b) : b)),
    );
  }, []);

  return { books, addBook, editBook, removeBook, lend, returnLoan };
}
