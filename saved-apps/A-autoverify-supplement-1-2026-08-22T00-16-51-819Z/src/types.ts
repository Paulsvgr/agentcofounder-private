export type BookId = string;

export interface Book {
  id: BookId;
  title: string;
  author: string;
  category: string;
  /** Empty string means the book is at home. A non-empty value is the borrower's name. */
  borrower: string;
}

export type BookDraft = {
  title: string;
  author: string;
  category: string;
};

export type LentFilter = "all" | "out";

export const CATEGORIES: string[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "History",
  "Poetry",
  "Other",
];

/** A book is considered lent out when it has a non-empty borrower. */
export function isLent(book: Book): boolean {
  return book.borrower.trim().length > 0;
}
