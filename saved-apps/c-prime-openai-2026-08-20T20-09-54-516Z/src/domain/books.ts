export type BookKind = "Novel" | "Cookbook" | "Reference" | "Other";

export type Book = {
  id: string;
  title: string;
  author: string;
  kind: BookKind;
  borrowedBy: string | null;
  createdAt: number;
  updatedAt: number;
};

export type NewBookInput = {
  title: string;
  author: string;
  kind: BookKind;
};

export type UpdateBookInput = {
  title: string;
  author: string;
  kind: BookKind;
};

export type BorrowInput = {
  borrowedBy: string;
};

export function parseKind(value: string): BookKind {
  const trimmed = value.trim();
  if (trimmed === "Novel") return "Novel";
  if (trimmed === "Cookbook") return "Cookbook";
  if (trimmed === "Reference") return "Reference";
  return "Other";
}

export function validateTitle(title: string): string | null {
  if (title.trim().length === 0) return "Title is required.";
  return null;
}

export function validateAuthor(author: string): string | null {
  if (author.trim().length === 0) return "Author is required.";
  return null;
}

export function validateBorrowerName(name: string): string | null {
  if (name.trim().length === 0) return "Borrower name is required.";
  return null;
}

export function createBook(now: number, id: string, input: NewBookInput): Book {
  const titleErr = validateTitle(input.title);
  if (titleErr) throw new Error(titleErr);
  const authorErr = validateAuthor(input.author);
  if (authorErr) throw new Error(authorErr);

  return {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    kind: input.kind,
    borrowedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateBook(now: number, book: Book, input: UpdateBookInput): Book {
  const titleErr = validateTitle(input.title);
  if (titleErr) throw new Error(titleErr);
  const authorErr = validateAuthor(input.author);
  if (authorErr) throw new Error(authorErr);

  return {
    ...book,
    title: input.title.trim(),
    author: input.author.trim(),
    kind: input.kind,
    updatedAt: now,
  };
}

export function borrowBook(now: number, book: Book, input: BorrowInput): Book {
  const err = validateBorrowerName(input.borrowedBy);
  if (err) throw new Error(err);
  if (book.borrowedBy) throw new Error("This book is already lent out.");
  return { ...book, borrowedBy: input.borrowedBy.trim(), updatedAt: now };
}

export function returnBook(now: number, book: Book): Book {
  if (!book.borrowedBy) return book;
  return { ...book, borrowedBy: null, updatedAt: now };
}

export function countLentOut(books: readonly Book[]): number {
  return books.filter((b) => Boolean(b.borrowedBy)).length;
}

export function filterBooks(
  books: readonly Book[],
  filter: "all" | "lent",
): Book[] {
  if (filter === "lent") return books.filter((b) => Boolean(b.borrowedBy));
  return [...books];
}
