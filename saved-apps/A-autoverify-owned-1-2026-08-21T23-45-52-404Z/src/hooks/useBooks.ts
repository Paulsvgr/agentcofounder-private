import { useCallback, useEffect, useRef, useState } from "react";
import {
  isLikelyDuplicate,
  normalizeBook,
  normalizeBorrowerName,
  validateBookInput,
  type Book,
  type BookCategory,
  type BookInput,
  type FieldErrors,
} from "../domain.js";
import { localBookRepository, type BookRepository } from "../storage.js";

function createId(): string {
  // crypto.randomUUID is available in modern browsers and jsdom (Node 22).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export interface UseBooks {
  books: Book[];
  addBook: (input: BookInput) => { ok: true } | { ok: false; errors: FieldErrors; duplicate: boolean };
  updateBook: (
    id: string,
    input: BookInput,
  ) => { ok: true } | { ok: false; errors: FieldErrors; duplicate: boolean };
  removeBook: (id: string) => void;
  lendBook: (id: string, borrower: string) => { ok: true } | { ok: false; error: string };
  returnBook: (id: string) => void;
  isDuplicate: (input: BookInput, ignoreId?: string) => boolean;
}

export function useBooks(repository: BookRepository = localBookRepository): UseBooks {
  const [books, setBooks] = useState<Book[]>(() => repository.load());
  const repoRef = useRef(repository);
  repoRef.current = repository;

  // Persist on every change; survives refresh.
  useEffect(() => {
    repoRef.current.save(books);
  }, [books]);

  const isDuplicate = useCallback(
    (input: BookInput, ignoreId?: string) =>
      isLikelyDuplicate(input, books, ignoreId),
    [books],
  );

  const addBook = useCallback((input: BookInput) => {
    const errors = validateBookInput(input);
    if (Object.keys(errors).length > 0) {
      return {
        ok: false as const,
        errors,
        duplicate: isLikelyDuplicate(input, books),
      };
    }
    const book: Book = {
      id: createId(),
      title: input.title.trim(),
      author: input.author.trim(),
      category: input.category,
      borrower: null,
    };
    setBooks((prev) => [...prev, book]);
    return { ok: true as const };
  }, [books]);

  const updateBook = useCallback(
    (id: string, input: BookInput) => {
      const errors = validateBookInput(input);
      if (Object.keys(errors).length > 0) {
        return {
          ok: false as const,
          errors,
          duplicate: isLikelyDuplicate(input, books, id),
        };
      }
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                title: input.title.trim(),
                author: input.author.trim(),
                category: input.category,
              }
            : b,
        ),
      );
      return { ok: true as const };
    },
    [books],
  );

  const removeBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const lendBook = useCallback(
    (id: string, borrower: string) => {
      const name = normalizeBorrowerName(borrower);
      if (name === null) {
        return { ok: false as const, error: "Borrower name is required." };
      }
      setBooks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, borrower: name } : b)),
      );
      return { ok: true as const };
    },
    [],
  );

  const returnBook = useCallback((id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, borrower: null } : b)),
    );
  }, []);

  return { books, addBook, updateBook, removeBook, lendBook, returnBook, isDuplicate };
}

// Re-export for tests/consumers that want a normalizer without circular imports.
export { normalizeBook };
