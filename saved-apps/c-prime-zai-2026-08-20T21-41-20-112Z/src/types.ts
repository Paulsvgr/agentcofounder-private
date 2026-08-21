export type Category = "novel" | "cookbook" | "reference" | "other";

export const CATEGORIES: Category[] = ["novel", "cookbook", "reference", "other"];

const categoryLabels: Record<Category, string> = {
  novel: "Novel",
  cookbook: "Cookbook",
  reference: "Reference",
  other: "Other",
};

export const categoryLabel = (category: Category): string =>
  categoryLabels[category];

export interface Book {
  id: string;
  title: string;
  author: string;
  category: Category;
  borrowerName: string | null;
}

export type NewBook = Omit<Book, "id" | "borrowerName">;

export interface StoredBook {
  id: string;
  title: string;
  author: string;
  category: Category;
  borrowerName: string | null;
}
