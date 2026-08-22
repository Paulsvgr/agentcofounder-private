import { useEffect, useState } from "react";
import type { BookDraft } from "./types.js";
import { CATEGORIES } from "./types.js";
import { validateDraft } from "./domain.js";

interface BookFormProps {
  /** When present, the form is editing this book; otherwise it adds a new one. */
  initial?: BookDraft;
  submitLabel: string;
  /** Accessible legend shown inside the form's fieldset. */
  legend: string;
  onSubmit: (draft: BookDraft) => void;
  onCancel?: () => void;
}

const EMPTY: BookDraft = { title: "", author: "", category: CATEGORIES[0] };

export function BookForm({
  initial,
  submitLabel,
  legend,
  onSubmit,
  onCancel,
}: BookFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [category, setCategory] = useState(
    initial?.category && initial.category.trim()
      ? initial.category
      : CATEGORIES[0],
  );
  const [error, setError] = useState<string | null>(null);

  // Reset local state when the editing target changes.
  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setAuthor(initial.author);
      setCategory(
        initial.category && initial.category.trim()
          ? initial.category
          : CATEGORIES[0],
      );
      setError(null);
    }
  }, [initial]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft: BookDraft = { title, author, category };
    const invalid = validateDraft(draft);
    if (invalid) {
      setError(`Please enter a ${invalid}.`);
      return;
    }
    setError(null);
    onSubmit(draft);
    if (!initial) {
      setTitle("");
      setAuthor("");
      setCategory(CATEGORIES[0]);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={legend} noValidate>
      <fieldset className="form-grid">
        <legend>{legend}</legend>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <label className="field">
          <span>Title</span>
          <input
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Book title"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Author</span>
          <input
            name="author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            aria-label="Book author"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Book category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit">{submitLabel}</button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
