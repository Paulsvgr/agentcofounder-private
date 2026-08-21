import { useState } from "react";
import { BOOK_CATEGORIES } from "../types";
import type { BookCategory, BookRow } from "../types";
import { validateBorrower, validateBookInput } from "../domain";

interface BookListProps {
  rows: BookRow[];
  onLend: (id: string, borrower: string) => void;
  onReturn: (id: string) => void;
  onEdit: (id: string, title: string, author: string, category: BookCategory) => void;
  onDelete: (id: string) => void;
}

interface LendState {
  id: string;
  name: string;
  error: string | null;
}

interface EditState {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  error: string | null;
}

export function BookList({ rows, onLend, onReturn, onEdit, onDelete }: BookListProps) {
  const [lending, setLending] = useState<LendState | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const startLend = (row: BookRow) =>
    setLending({ id: row.id, name: "", error: null });
  const cancelLend = () => setLending(null);
  const confirmLend = () => {
    if (!lending) return;
    const err = validateBorrower(lending.name);
    if (err) {
      setLending({ ...lending, error: err });
      return;
    }
    onLend(lending.id, lending.name);
    setLending(null);
  };

  const startEdit = (row: BookRow) =>
    setEditing({
      id: row.id,
      title: row.title,
      author: row.author,
      category: row.category,
      error: null,
    });
  const cancelEdit = () => setEditing(null);
  const confirmEdit = () => {
    if (!editing) return;
    const err = validateBookInput(editing.title, editing.author);
    if (err) {
      setEditing({ ...editing, error: err });
      return;
    }
    onEdit(editing.id, editing.title, editing.author, editing.category);
    setEditing(null);
  };

  if (rows.length === 0) {
    return (
      <p className="empty" role="status">
        No books here yet. Add your first book above.
      </p>
    );
  }

  return (
    <ul className="list" aria-label="Books">
      {rows.map((row) => {
        if (editing?.id === row.id) {
          return (
            <li key={row.id} className="list__item list__item--editing">
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  confirmEdit();
                }}
              >
                <input
                  type="text"
                  value={editing.title}
                  aria-label="Edit title"
                  maxLength={200}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
                <input
                  type="text"
                  value={editing.author}
                  aria-label="Edit author"
                  maxLength={120}
                  onChange={(e) =>
                    setEditing({ ...editing, author: e.target.value })
                  }
                />
                <select
                  value={editing.category}
                  aria-label="Edit kind"
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      category: e.target.value as BookCategory,
                    })
                  }
                >
                  {BOOK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn--primary">
                  Save
                </button>
                <button type="button" className="btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </form>
              {editing.error && (
                <p className="form__error" role="alert">
                  {editing.error}
                </p>
              )}
            </li>
          );
        }

        return (
          <li key={row.id} className="list__item">
            <div className="list__main">
              <span className="list__title">{row.title}</span>
              <span className="list__author">by {row.author}</span>
              <span className="badge">{row.category}</span>
              {row.status === "out" && (
                <span className="badge badge--out">
                  Out with {row.borrower}
                </span>
              )}
            </div>
            <div className="list__actions">
              {row.status === "in" &&
                (lending?.id === row.id ? (
                  <span className="inline-form">
                    <input
                      type="text"
                      value={lending.name}
                      placeholder="Borrower's name"
                      aria-label={`Borrower name for ${row.title}`}
                      maxLength={120}
                      autoFocus
                      onChange={(e) =>
                        setLending({ ...lending, name: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmLend();
                        } else if (e.key === "Escape") {
                          cancelLend();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={confirmLend}
                    >
                      Lend
                    </button>
                    <button type="button" className="btn" onClick={cancelLend}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => startLend(row)}
                    >
                      Lend out
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                  </>
                ))}
              {row.status === "out" && (
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => onReturn(row.id)}
                  >
                    Mark returned
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => startEdit(row)}
                  >
                    Edit
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onDelete(row.id)}
                aria-label={`Delete ${row.title}`}
              >
                Delete
              </button>
            </div>
            {lending?.id === row.id && lending.error && (
              <p className="form__error" role="alert">
                {lending.error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
