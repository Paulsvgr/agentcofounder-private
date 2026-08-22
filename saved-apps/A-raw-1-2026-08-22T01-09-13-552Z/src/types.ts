export type BookKind =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "History"
  | "Science"
  | "Children"
  | "Poetry"
  | "Other";

export const BOOK_KINDS: BookKind[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "History",
  "Science",
  "Children",
  "Poetry",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  kind: BookKind;
  borrower: string | null;
}

export interface NewBookInput {
  title: string;
  author: string;
  kind: BookKind;
}
