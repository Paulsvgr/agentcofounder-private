export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Non-fiction"
  | "Poetry"
  | "Biography"
  | "Children's"
  | "Other";

export const CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Non-fiction",
  "Poetry",
  "Biography",
  "Children's",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrower: string; // empty string means book is at home / available
}

export type BookDraft = Omit<Book, "id" | "borrower">;

export type Filter = "all" | "out";
