// LocalStorage-backed book persistence
import { Book } from '../domain/book';

const STORAGE_KEY = 'mybookshelf-app-books-v1';

export function loadBooks(): Book[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const books = JSON.parse(data);
    if (!Array.isArray(books)) return [];
    return books;
  } catch {
    return [];
  }
}

export function saveBooks(books: Book[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {}
}
