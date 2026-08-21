export type BookCategory =
  | "Novel"
  | "Cookbook"
  | "Reference"
  | "Non-fiction"
  | "Biography"
  | "Poetry"
  | "Children's"
  | "Other";

export const BOOK_CATEGORIES: BookCategory[] = [
  "Novel",
  "Cookbook",
  "Reference",
  "Non-fiction",
  "Biography",
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

export type BookFilter = "all" | "out";

/** A view-model entry used to display books grouped/sorted for the UI. */
export interface BookRow extends Book {
  status: "in" | "out";
}
