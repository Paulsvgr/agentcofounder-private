import { useState } from "react";

export type Book = {
  id: string;
  title: string;
  category: string;
  lent: boolean;
};

const CATEGORIES = ["Fiction", "Science", "Cookbook"] as const;

const INITIAL: Book[] = [
  { id: "1", title: "Dune", category: "Science", lent: false },
  { id: "2", title: "Sapiens", category: "Science", lent: false },
];

/**
 * Seeded failing app for VERIFY_RTL_MULTIPLE_EVIDENCE_V1 deterministic proof.
 * Intentionally renders category both as <option> and as a badge, and two
 * identical "Lend out" row buttons — so naive getByText / getByRole fail.
 */
export default function App() {
  const [books, setBooks] = useState<Book[]>(INITIAL);
  const [draftCategory, setDraftCategory] = useState<string>("Science");

  function lend(id: string) {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, lent: true } : b)));
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1>My Home Library</h1>
      <p>{books.length} books on the shelf</p>

      <label htmlFor="category">Category</label>
      <select
        id="category"
        value={draftCategory}
        onChange={(e) => setDraftCategory(e.target.value)}
        aria-label="Category"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <ul aria-label="Book list">
        {books.map((book) => (
          <li key={book.id}>
            <span className="book-title">{book.title}</span>
            <span className="badge">{book.category}</span>
            {!book.lent ? (
              <button type="button" onClick={() => lend(book.id)}>
                Lend out
              </button>
            ) : (
              <span>Lent out</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
