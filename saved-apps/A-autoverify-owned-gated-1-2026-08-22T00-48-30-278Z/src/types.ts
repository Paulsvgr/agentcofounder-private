export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "History"
  | "Science"
  | "Poetry"
  | "Children's"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "History",
  "Science",
  "Poetry",
  "Children's",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrower: string | null;
}

export type BookFilter = "all" | "lent";

export interface NewBookInput {
  title: string;
  author: string;
  category: BookCategory;
}
