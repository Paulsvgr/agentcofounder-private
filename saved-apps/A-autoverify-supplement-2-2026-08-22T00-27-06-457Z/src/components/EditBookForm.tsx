import { useEffect, useState } from "react";
import type { Book, BookDraft } from "../types";
import { CATEGORIES } from "../types";
import type { BookRepository } from "../repository";

interface EditBookFormProps {
  repository: BookRepository;
  book: Book;
  onDone: () => void;
}

const emptyDraft: BookDraft = { title: "", author: "", category: "Novel" };

function toDraft(book: Book): BookDraft {
  return { title: book.title, author: book.author, category: book.category };
}

export function EditBookForm({ repository, book, onDone }: EditBookFormProps) {
  const [draft, setDraft] = useState<BookDraft>(() => toDraft(book));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(book));
  }, [book.id, book.title, book.author, book.category]);

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
    repository.update(book.id, { title, author, category: draft.category });
    onDone();
  }

  return (
    <form onSubmit={submit} aria-label={`Edit ${book.title}`} className="inline-form">
      <label className="field">
        <span>Title</span>
        <input
          name="title"
          aria-label="Title"
          value={draft.title}
          onChange={(e) => {
            setDraft((d) => ({ ...d, title: e.target.value }));
            setError(null);
          }}
        />
      </label>
      <label className="field">
        <span>Author</span>
        <input
          name="author"
          aria-label="Author"
          value={draft.author}
          onChange={(e) => {
            setDraft((d) => ({ ...d, author: e.target.value }));
            setError(null);
          }}
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
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export { emptyDraft };
