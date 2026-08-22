import { useState } from "react";
import type { BookDraft } from "../types";
import { CATEGORIES } from "../types";
import type { BookRepository } from "../repository";

interface AddBookFormProps {
  repository: BookRepository;
}

export function AddBookForm({ repository }: AddBookFormProps) {
  const [draft, setDraft] = useState<BookDraft>({
    title: "",
    author: "",
    category: "Novel",
  });
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDraft({ title: "", author: "", category: "Novel" });
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    const author = draft.author.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    if (!author) {
      setError("Author is required.");
      return;
    }
    repository.add({ title, author, category: draft.category });
    reset();
  }

  return (
    <form onSubmit={submit} aria-label="Add a book" className="add-form">
      <label className="field">
        <span>Title</span>
        <input
          name="title"
          aria-label="Book title"
          value={draft.title}
          onChange={(e) => {
            setDraft((d) => ({ ...d, title: e.target.value }));
            setError(null);
          }}
          placeholder="The Hobbit"
        />
      </label>
      <label className="field">
        <span>Author</span>
        <input
          name="author"
          aria-label="Book author"
          value={draft.author}
          onChange={(e) => {
            setDraft((d) => ({ ...d, author: e.target.value }));
            setError(null);
          }}
          placeholder="J.R.R. Tolkien"
        />
      </label>
      <label className="field">
        <span>Kind</span>
        <select
          name="category"
          aria-label="Kind of book"
          value={draft.category}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              category: e.target.value as BookDraft["category"],
            }))
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary">
        Add book
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
