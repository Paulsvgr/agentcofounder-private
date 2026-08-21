// Pure domain logic for a Book and book collection

export type Book = {
  id: string;
  title: string;
  author: string;
  type?: string;
  borrowedBy?: string | null;
};

export function createBook(
  title: string,
  author: string,
  type?: string
): Book {
  return { id: crypto.randomUUID(), title: title.trim(), author: author.trim(), type: type?.trim() || '', borrowedBy: null };
}

export function editBook(
  book: Book,
  updates: Partial<Pick<Book, 'title' | 'author' | 'type'>>
): Book {
  return {
    ...book,
    ...updates,
    title: updates.title !== undefined ? updates.title.trim() : book.title,
    author: updates.author !== undefined ? updates.author.trim() : book.author,
    type: updates.type !== undefined ? updates.type.trim() : book.type,
  };
}

export function lendBook(book: Book, borrower: string): Book {
  return { ...book, borrowedBy: borrower.trim() };
}

export function returnBook(book: Book): Book {
  return { ...book, borrowedBy: null };
}

export function deleteBook(books: Book[], id: string): Book[] {
  return books.filter((b) => b.id !== id);
}

export function filterLentBooks(books: Book[]): Book[] {
  return books.filter((b) => b.borrowedBy && b.borrowedBy.trim() !== '');
}

export function lentBookCount(books: Book[]): number {
  return filterLentBooks(books).length;
}
