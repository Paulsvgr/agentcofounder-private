import { useState } from "react";
import { BOOK_CATEGORIES } from "../types";
import type { BookCategory } from "../types";
import { validateBookInput } from "../domain";

interface BookFormProps {
  onAdd: (title: string, author: string, category: BookCategory) => void;
}

export function BookForm({ onAdd }: BookFormProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<BookCategory>("Novel");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateBookInput(title, author);
    if (err) {
      setError(err);
      return;
    }
    onAdd(title, author, category);
    setTitle("");
    setAuthor("");
    setCategory("Novel");
    setError(null);
  };

  return (
    <form className="form" onSubmit={submit} aria-label="Add a book">
      <div className="form__row">
        <label className="field">
          <span className="field__label">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Lord of the Rings"
            aria-label="Book title"
            maxLength={200}
          />
        </label>
        <label className="field">
          <span className="field__label">Author</span>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. J.R.R. Tolkien"
            aria-label="Book author"
            maxLength={120}
          />
        </label>
        <label className="field field--narrow">
          <span className="field__label">Kind</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BookCategory)}
            aria-label="Book kind"
          >
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary">
          Add book
        </button>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
