import { useEffect, useRef, useState } from "react";
import {
  BOOK_CATEGORIES,
  type BookCategory,
  type FieldErrors,
} from "../domain.js";

export interface BookFormValues {
  title: string;
  author: string;
  category: BookCategory;
}

interface BookFormProps {
  /** When editing, the initial values and id; otherwise adding. */
  initial?: BookFormValues;
  /** Headline shown above the form. */
  heading: string;
  submitLabel: string;
  isDuplicate?: boolean;
  onSubmit: (values: BookFormValues) => void;
  onCancel?: () => void;
  fieldErrors?: FieldErrors;
}

const DEFAULT_VALUES: BookFormValues = {
  title: "",
  author: "",
  category: "Novel",
};

export function BookForm({
  initial,
  heading,
  submitLabel,
  isDuplicate = false,
  onSubmit,
  onCancel,
  fieldErrors,
}: BookFormProps) {
  const [values, setValues] = useState<BookFormValues>(initial ?? DEFAULT_VALUES);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const liveErrors: FieldErrors = touched ? fieldErrors ?? {} : {};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    onSubmit({ ...values, title: values.title.trim(), author: values.author.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="book-form" aria-label={heading}>
      <h2 className="form-heading">{heading}</h2>
      <label className="field">
        <span className="field-label">Title</span>
        <input
          ref={titleRef}
          name="title"
          type="text"
          className="field-input"
          value={values.title}
          aria-invalid={Boolean(liveErrors.title)}
          aria-describedby={liveErrors.title ? "title-error" : undefined}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="The Hobbit"
        />
        {liveErrors.title && (
          <span id="title-error" role="alert" className="field-error">
            {liveErrors.title}
          </span>
        )}
      </label>
      <label className="field">
        <span className="field-label">Author</span>
        <input
          name="author"
          type="text"
          className="field-input"
          value={values.author}
          aria-invalid={Boolean(liveErrors.author)}
          aria-describedby={liveErrors.author ? "author-error" : undefined}
          onChange={(e) => setValues((v) => ({ ...v, author: e.target.value }))}
          placeholder="J.R.R. Tolkien"
        />
        {liveErrors.author && (
          <span id="author-error" role="alert" className="field-error">
            {liveErrors.author}
          </span>
        )}
      </label>
      <label className="field">
        <span className="field-label">Category</span>
        <select
          name="category"
          className="field-input"
          value={values.category}
          onChange={(e) =>
            setValues((v) => ({ ...v, category: e.target.value as BookCategory }))
          }
        >
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {isDuplicate && (
        <p className="field-note" role="status">
          A book with this title and author already exists.
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
