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

export const CATEGORIES: BookCategory[] = [
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

export interface BookInput {
  title: string;
  author: string;
  category: BookCategory;
}
