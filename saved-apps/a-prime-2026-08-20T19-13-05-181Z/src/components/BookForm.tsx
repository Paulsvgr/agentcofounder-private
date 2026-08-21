import { FormEvent, useState } from "react";
import {
  CATEGORIES,
  Category,
  hasErrors,
  validateBookInput,
  ValidationErrors,
} from "../domain/book.js";

export interface BookFormValues {
  title: string;
  author: string;
  category: Category;
}

export const EMPTY_FORM: BookFormValues = {
  title: "",
  author: "",
  category: "Novel",
};

interface BookFormProps {
  initialValues?: BookFormValues;
  submitLabel: string;
  onSubmit: (values: BookFormValues) => void;
  onCancel?: () => void;
}

export function BookForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: BookFormProps) {
  const [values, setValues] = useState<BookFormValues>(
    initialValues ?? EMPTY_FORM,
  );
  const [errors, setErrors] = useState<ValidationErrors>({});

  function update<K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateBookInput(values);
    if (hasErrors(next)) {
      setErrors(next);
      return;
    }
    onSubmit(values);
    setValues(EMPTY_FORM);
    setErrors({});
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-label="Book details">
      <div className="field">
        <label htmlFor="book-title">Title</label>
        <input
          id="book-title"
          name="title"
          type="text"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "book-title-error" : undefined}
          autoComplete="off"
        />
        {errors.title ? (
          <span id="book-title-error" className="error" role="alert">
            {errors.title}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="book-author">Author</label>
        <input
          id="book-author"
          name="author"
          type="text"
          value={values.author}
          onChange={(e) => update("author", e.target.value)}
          aria-invalid={errors.author ? true : undefined}
          aria-describedby={errors.author ? "book-author-error" : undefined}
          autoComplete="off"
        />
        {errors.author ? (
          <span id="book-author-error" className="error" role="alert">
            {errors.author}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="book-category">Category</label>
        <select
          id="book-category"
          name="category"
          value={values.category}
          onChange={(e) => update("category", e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
