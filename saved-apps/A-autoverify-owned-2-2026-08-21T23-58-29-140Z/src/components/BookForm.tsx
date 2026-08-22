import { useState } from "react";
import { type Book, type BookCategory, BOOK_CATEGORIES, validateBookInput } from "../domain/book.js";
import { type BookService } from "../services/bookService.js";

interface BookFormProps {
  service: BookService;
  editing: Book | null;
  onDone: () => void;
  onChanged: () => void;
}

interface FormState {
  title: string;
  author: string;
  category: BookCategory;
}

const EMPTY: FormState = { title: "", author: "", category: "Novel" };

export function BookForm({ service, editing, onDone, onChanged }: BookFormProps) {
  const [form, setForm] = useState<FormState>(
    editing
      ? { title: editing.title, author: editing.author, category: editing.category }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = editing !== null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateBookInput(form);
    if (!result.ok) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    if (isEditing && editing) {
      const res = service.updateBook(editing.id, form);
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
    } else {
      const res = service.addBook(form);
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
    }
    setForm(EMPTY);
    setErrors({});
    onChanged();
    onDone();
  }

  function handleCancel() {
    setForm(EMPTY);
    setErrors({});
    onDone();
  }

  return (
    <form
      aria-label={isEditing ? "Edit book" : "Add a book"}
      onSubmit={handleSubmit}
      className="book-form"
    >
      <h2 className="form-title">{isEditing ? "Edit book" : "Add a book"}</h2>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          type="text"
          name="title"
          aria-label="Title"
          value={form.title}
          maxLength={200}
          onChange={(e) => update("title", e.target.value)}
        />
        {errors.title ? <span className="field-error">{errors.title}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Author</span>
        <input
          type="text"
          name="author"
          aria-label="Author"
          value={form.author}
          maxLength={120}
          onChange={(e) => update("author", e.target.value)}
        />
        {errors.author ? <span className="field-error">{errors.author}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Category</span>
        <select
          name="category"
          aria-label="Category"
          value={form.category}
          onChange={(e) => update("category", e.target.value as BookCategory)}
        >
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.category ? <span className="field-error">{errors.category}</span> : null}
      </label>

      {errors.form ? <p className="field-error" role="alert">{errors.form}</p> : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {isEditing ? "Save changes" : "Add book"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleCancel}>
          {isEditing ? "Cancel" : "Clear"}
        </button>
      </div>
    </form>
  );
}
