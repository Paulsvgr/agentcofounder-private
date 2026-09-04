import { useMemo, useState } from "react";

type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  borrower: string | null;
};

const SEED: Book[] = [
  {
    id: "1",
    title: "Dune",
    author: "Frank Herbert",
    category: "Science",
    borrower: "Dad",
  },
  {
    id: "2",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    category: "Science",
    borrower: null,
  },
];

export default function App() {
  const [books] = useState<Book[]>(SEED);

  const lentCount = useMemo(
    () => books.filter((book) => book.borrower !== null).length,
    [books],
  );
  const shelfCount = useMemo(
    () => books.filter((book) => book.borrower === null).length,
    [books],
  );

  const lentLabel = `${lentCount} ${lentCount === 1 ? "is" : "are"} currently lent out.`;
  const shelfLabel = `${shelfCount} ${shelfCount === 1 ? "book" : "books"} on the shelf.`;

  return (
    <main>
      <h1>My Library</h1>
      <p>{lentLabel}</p>
      <p>{shelfLabel}</p>
      <ul aria-label="Book list">
        {books.map((book) => (
          <li key={book.id}>
            <span>{book.title}</span>
            <span className="badge">{book.category}</span>
            {book.borrower ? (
              <span>Lent to {book.borrower}</span>
            ) : (
              <button type="button">Lend out</button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
