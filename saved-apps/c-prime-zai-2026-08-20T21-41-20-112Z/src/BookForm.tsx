import { useState } from "react";
import {
  CATEGORIES,
  categoryLabel,
  type Book,
  type Category,
} from "./types.js";

interface BookFormValues {
  title: string;
  author: string;
  category: Category;
}

interface BookFormErrors {
  title?: string;
  author?: string;
  category?: string;
}

interface BookFormProps {
  initial?: Partial<BookFormValues>;
  submitLabel: string;
  title?: string;
  onSubmit: (values: BookFormValues) => void;
  onCancel?: () => void;
}

const DEFAULT_VALUES: BookFormValues = {
  title: "",
  author: "",
  category: "novel",
};

const emptyValues = (initial?: Partial<BookFormValues>): BookFormValues => ({
  ...DEFAULT_VALUES,
  ...initial,
  category: initial?.category ?? DEFAULT_VALUES.category,
});

export const BookForm = ({
  initial,
  submitLabel,
  title: formTitle,
  onSubmit,
  onCancel,
}: BookFormProps) => {
  const [values, setValues] = useState<BookFormValues>(() =>
    emptyValues(initial),
  );
  const [errors, setErrors] = useState<BookFormErrors>({});

  const update =
    <K extends keyof BookFormValues>(field: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value as BookFormValues[K];
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed: BookFormValues = {
      title: values.title.trim(),
      author: values.author.trim(),
      category: values.category,
    };
    const nextErrors: BookFormErrors = {};
    if (!trimmed.title) nextErrors.title = "Title is required";
    if (!trimmed.author) nextErrors.author = "Author is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(trimmed);
    setValues(emptyValues(initial));
  };

  return (
    <form
      aria-label={formTitle ?? "Book form"}
      onSubmit={handleSubmit}
      noValidate
    >
      {formTitle ? <h2>{formTitle}</h2> : null}
      <div className="field">
        <label htmlFor="book-title">Title</label>
        <input
          id="book-title"
          name="title"
          type="text"
          value={values.title}
          onChange={update("title")}
          aria-invalid={Boolean(errors.title) || undefined}
          aria-describedby={errors.title ? "book-title-error" : undefined}
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
          onChange={update("author")}
          aria-invalid={Boolean(errors.author) || undefined}
          aria-describedby={errors.author ? "book-author-error" : undefined}
        />
        {errors.author ? (
          <span id="book-author-error" className="error" role="alert">
            {errors.author}
          </span>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="book-category">Kind of book</label>
        <select
          id="book-category"
          name="category"
          value={values.category}
          onChange={update("category")}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </div>
      <div className="actions">
        <button type="submit">{submitLabel}</button>
        {onCancel ? (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};

interface LendFormProps {
  book: Book;
  onLend: (borrowerName: string) => void;
  onCancel: () => void;
}

export const LendForm = ({ book, onLend, onCancel }: LendFormProps) => {
  const [borrowerName, setBorrowerName] = useState(() => book.borrowerName ?? "");
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = borrowerName.trim();
    if (!trimmed) {
      setError("Borrower name is required");
      return;
    }
    onLend(trimmed);
  };

  return (
    <form aria-label={`Lend ${book.title}`} onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="borrower-name">Borrower name</label>
        <input
          id="borrower-name"
          name="borrowerName"
          type="text"
          value={borrowerName}
          onChange={(event) => {
            setBorrowerName(event.target.value);
            setError(undefined);
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "borrower-name-error" : undefined}
        />
        {error ? (
          <span id="borrower-name-error" className="error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <div className="actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};
