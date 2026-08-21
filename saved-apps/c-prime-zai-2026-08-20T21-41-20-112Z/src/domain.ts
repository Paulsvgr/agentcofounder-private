import { CATEGORIES, type Book, type Category, type NewBook } from "./types.js";

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && (CATEGORIES as string[]).includes(value);

const trim = (value: string): string => value.trim();

const isNonEmpty = (value: string): boolean => trim(value).length > 0;

export interface BookInput {
  title: string;
  author: string;
  category: Category;
}

export interface BookInputErrors {
  title?: string;
  author?: string;
  category?: string;
}

export const validateBookInput = (input: BookInput): BookInputErrors => {
  const errors: BookInputErrors = {};
  if (!isNonEmpty(input.title)) {
    errors.title = "Title is required";
  }
  if (!isNonEmpty(input.author)) {
    errors.author = "Author is required";
  }
  if (!isCategory(input.category)) {
    errors.category = "Choose a valid kind of book";
  }
  return errors;
};

export const normalizeBookInput = (input: BookInput): NewBook => ({
  title: trim(input.title),
  author: trim(input.author),
  category: input.category,
});

const generateId = (): string =>
  `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const createBook = (input: NewBook): Book => ({
  id: generateId(),
  title: trim(input.title),
  author: trim(input.author),
  category: input.category,
  borrowerName: null,
});

export interface LendErrors {
  borrowerName?: string;
}

export const validateBorrower = (borrowerName: string): LendErrors => {
  const errors: LendErrors = {};
  if (!isNonEmpty(borrowerName)) {
    errors.borrowerName = "Borrower name is required";
  }
  return errors;
};

/** Lend a book to someone. Repeated lending updates the borrower. */
export const lendBook = (book: Book, borrowerName: string): Book => ({
  ...book,
  borrowerName: trim(borrowerName),
});

/** Mark a book as returned home. */
export const returnBook = (book: Book): Book => ({
  ...book,
  borrowerName: null,
});

export const isLentOut = (book: Book): boolean => book.borrowerName !== null;

export const countLentOut = (books: Book[]): number =>
  books.reduce((total, book) => (isLentOut(book) ? total + 1 : total), 0);
