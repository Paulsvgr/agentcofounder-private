import { useState, type FormEvent } from "react";

export type Book = {
  id: string;
  title: string;
  author: string;
};

/**
 * Sealed 257k-class bug: startEdit expects Book but Edit passes book.id (string).
 * Symptom under test: Unable to find display value "Dune" after Edit click.
 */
export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  function addBook(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const a = author.trim();
    if (!t || !a) return;
    setBooks((prev) => [...prev, { id: String(Date.now()), title: t, author: a }]);
    setTitle("");
    setAuthor("");
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setEditTitle(book.title);
    setEditAuthor(book.author);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const t = editTitle.trim();
    const a = editAuthor.trim();
    if (!t || !a) return;
    setBooks((prev) =>
      prev.map((b) => (b.id === editingId ? { ...b, title: t, author: a } : b)),
    );
    setEditingId(null);
  }

  return (
    <main>
      <h1>My Bookshelf</h1>
      <form onSubmit={addBook} aria-label="Add a book">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Author
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <button type="submit">Add to shelf</button>
      </form>
      <ul aria-label="Book list">
        {books.map((book) => (
          <li key={book.id}>
            {editingId === book.id ? (
              <form onSubmit={saveEdit}>
                <label>
                  Title
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </label>
                <label>
                  Author
                  <input
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                  />
                </label>
                <button type="submit">Save</button>
              </form>
            ) : (
              <>
                <span>{book.title}</span>
                <span>by {book.author}</span>
                {/* edit opens inline fields */}
                <button type="button" onClick={() => startEdit(book.id)}>
                  Edit
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
