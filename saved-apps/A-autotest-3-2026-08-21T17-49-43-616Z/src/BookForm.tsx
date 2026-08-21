import { useId, useState } from "react";
import type { BookInput, BookCategory } from "./types.js";
import { BOOK_CATEGORIES } from "./types.js";

interface BookFormProps {
  onSubmit: (input: BookInput) => void;
  initial?: Partial<BookInput>;
  submitLabel: string;
  onCancel?: () => void;
}

/** Trimmed non-empty check shared by title and author. */
export function isPresent(value: string): boolean {
  return value.trim().length > 0;
}

export function BookForm({ onSubmit, initial, submitLabel, onCancel }: BookFormProps) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const authorId = `${reactId}-author`;
  const categoryId = `${reactId}-category`;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [category, setCategory] = useState<BookCategory>(
    initial?.category ?? "Novel",
  );
  const [touched, setTouched] = useState(false);

  const titleOk = isPresent(title);
  const authorOk = isPresent(author);
  const formOk = titleOk && authorOk;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!formOk) return;
    onSubmit({
      title: title.trim(),
      author: author.trim(),
      category,
    });
    if (!onCancel) {
      // Add mode: reset for the next entry.
      setTitle("");
      setAuthor("");
      setCategory("Novel");
      setTouched(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="book-form" noValidate>
      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={touched && !titleOk}
          aria-describedby={touched && !titleOk ? `${titleId}-error` : undefined}
          autoComplete="off"
        />
        {touched && !titleOk && (
          <span id={`${titleId}-error`} className="field-error">
            Title is required.
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={authorId}>Author</label>
        <input
          id={authorId}
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          aria-invalid={touched && !authorOk}
          aria-describedby={touched && !authorOk ? `${authorId}-error` : undefined}
          autoComplete="off"
        />
        {touched && !authorOk && (
          <span id={`${authorId}-error`} className="field-error">
            Author is required.
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={categoryId}>Category</label>
        <select
          id={categoryId}
          value={category}
          onChange={(e) => setCategory(e.target.value as BookCategory)}
        >
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={touched && !formOk}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
