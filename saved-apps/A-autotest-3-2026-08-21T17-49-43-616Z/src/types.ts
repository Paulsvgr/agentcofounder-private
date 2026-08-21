export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Biography"
  | "Poetry"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Biography",
  "Poetry",
  "Other",
];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  borrower: string | null;
}

export type BookInput = {
  title: string;
  author: string;
  category: BookCategory;
};

export type Filter = "all" | "lent";
