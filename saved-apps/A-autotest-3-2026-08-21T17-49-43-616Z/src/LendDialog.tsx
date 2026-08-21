import { useState } from "react";

interface LendDialogProps {
  bookTitle: string;
  initialBorrower?: string;
  onSubmit: (borrower: string) => void;
  onCancel: () => void;
}

export function LendDialog({ bookTitle, initialBorrower, onSubmit, onCancel }: LendDialogProps) {
  const [borrower, setBorrower] = useState(initialBorrower ?? "");
  const [touched, setTouched] = useState(false);
  const ok = borrower.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok) return;
    onSubmit(borrower.trim());
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={`Lend out ${bookTitle}`}>
      <form onSubmit={handleSubmit} className="dialog" noValidate>
        <h2>Lend out “{bookTitle}”</h2>
        <div className="field">
          <label htmlFor="borrower-name">Borrower name</label>
          <input
            id="borrower-name"
            type="text"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            aria-invalid={touched && !ok}
            aria-describedby={touched && !ok ? "borrower-name-error" : undefined}
            autoComplete="off"
            autoFocus
          />
          {touched && !ok && (
            <span id="borrower-name-error" className="field-error">
              Enter who is borrowing this book.
            </span>
          )}
        </div>
        <div className="form-actions">
          <button type="submit" disabled={touched && !ok}>
            Lend it out
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
