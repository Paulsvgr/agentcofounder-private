import { useState } from "react";
import { BOOK_KINDS, type BookKind } from "./types";

interface Props {
  initial?: { title: string; author: string; kind: BookKind };
  submitLabel: string;
  titleIdPrefix: string;
  onSubmit: (input: { title: string; author: string; kind: BookKind }) => void;
  onCancel?: () => void;
}

const empty = { title: "", author: "", kind: "Novel" as BookKind };

export function BookForm({ initial, submitLabel, titleIdPrefix, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? empty.title);
  const [author, setAuthor] = useState(initial?.author ?? empty.author);
  const [kind, setKind] = useState<BookKind>(initial?.kind ?? empty.kind);
  const [touched, setTouched] = useState(false);

  const titleErr = title.trim() === "" ? "Title is required" : "";
  const authorErr = author.trim() === "" ? "Author is required" : "";
  const showErrors = touched;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (titleErr || authorErr) return;
    onSubmit({ title: title.trim(), author: author.trim(), kind });
  }

  const titleId = `${titleIdPrefix}-title`;
  const authorId = `${titleIdPrefix}-author`;
  const kindId = `${titleIdPrefix}-kind`;

  return (
    <form onSubmit={handleSubmit} className="book-form" aria-label="Book details">
      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={showErrors && !!titleErr}
          aria-describedby={showErrors && titleErr ? `${titleId}-error` : undefined}
        />
        {showErrors && titleErr && (
          <span id={`${titleId}-error`} className="field-error" role="alert">
            {titleErr}
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
          aria-invalid={showErrors && !!authorErr}
          aria-describedby={showErrors && authorErr ? `${authorId}-error` : undefined}
        />
        {showErrors && authorErr && (
          <span id={`${authorId}-error`} className="field-error" role="alert">
            {authorErr}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={kindId}>Kind</label>
        <select id={kindId} value={kind} onChange={(e) => setKind(e.target.value as BookKind)}>
          {BOOK_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
