# Assumptions

- Single-user, all data is local/browser-persisted; no logins, registrations, or cloud services.
- Main entity: Book. Fields: title, author, type, borrowedBy (nullable string).
- Book type: free text (for flexibility), not a restricted category.
- User can add, edit, or delete a book.
- User can mark a book as lent (enter borrower's name), or returned (clear the field).
- Main view: Shows all books. Option to filter to only lent-out books.
- Count of lent-out books is shown somewhere in the UI.
- Input validation: Title and author required (not blank), type optional.
- App is a simple SPA at localhost:3000, responsive and accessible.
- No advanced search or category management beyond the above.
- No cover images or ISBNs required.
- Same book titles with different authors are allowed (no unique constraint on title field).
- No undo/redo or bulk actions implied by the idea.
- Persistence: LocalStorage (most universal for single-user browser apps).
