import { useState } from "react";
import type { Book, BookCategory, NewBookInput } from "../types";
import { BOOK_CATEGORIES } from "../types";

interface BookFormProps {
  onSubmit: (input: NewBookInput) => string | null;
  submitLabel: string;
  title?: string;
  initial?: Partial<NewBookInput>;
  onDone?: () => void;
}

export function BookForm({
  onSubmit,
  submitLabel,
  title,
  initial,
  onDone,
}: BookFormProps) {
  const [bookTitle, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [category, setCategory] = useState<BookCategory>(
    initial?.category ?? "Novel",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = onSubmit({
      title: bookTitle,
      author,
      category,
    });
    if (result) {
      setError(result);
    } else {
      setError(null);
      setTitle("");
      setAuthor("");
      setCategory("Novel");
      onDone?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={title ?? "Book form"}>
      {title && <h2>{title}</h2>}
      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={bookTitle}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Book title"
          placeholder="The title of the book"
        />
      </label>
      <label className="field">
        <span>Author</span>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          aria-label="Book author"
          placeholder="Who wrote it"
        />
      </label>
      <label className="field">
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BookCategory)}
          aria-label="Book category"
        >
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
        {onDone && (
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
