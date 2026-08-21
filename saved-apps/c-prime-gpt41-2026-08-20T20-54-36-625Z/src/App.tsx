import React, { useState, useEffect } from 'react';
import { Book, createBook, editBook, lendBook, returnBook, deleteBook, filterLentBooks, lentBookCount } from './domain/book';
import { loadBooks, saveBooks } from './persistence/books-storage';

function BookForm({onSubmit, initial, onCancel}: {onSubmit: (b: {title: string, author: string, type?: string}) => void, initial?: {title: string, author: string, type?: string}, onCancel?: () => void}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [author, setAuthor] = useState(initial?.author || '');
  const [type, setType] = useState(initial?.type || '');
  const [error, setError] = useState<string|null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      setError('Title and author are required.');
      return;
    }
    setError(null);
    onSubmit({title, author, type});
    setTitle('');
    setAuthor('');
    setType('');
  }

  return (
    <form onSubmit={handleSubmit} style={{marginBottom: 12}} aria-label={initial ? "Edit book" : "Add book"}>
      <input aria-label="Title" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} /> {' '}
      <input aria-label="Author" placeholder="Author" value={author} onChange={e=>setAuthor(e.target.value)} /> {' '}
      <input aria-label="Type" placeholder="Type (novel, cookbook, etc)" value={type} onChange={e=>setType(e.target.value)} /> {' '}
      <button type="submit">{initial ? 'Save' : 'Add Book'}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      {error && <div style={{color:'red'}} role="alert">{error}</div>}
    </form>
  );
}

function BorrowForm({onSubmit, initial, onCancel}: {onSubmit: (borrower: string) => void, initial?: string, onCancel: () => void}) {
  const [borrower, setBorrower] = useState(initial || '');
  return (
    <form onSubmit={e => {e.preventDefault(); if(borrower.trim()) onSubmit(borrower);}} style={{display:'inline'}} aria-label="Lend book">
      <input aria-label="Borrower name" placeholder="Who?" value={borrower} onChange={e=>setBorrower(e.target.value)} />
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [showLentOnly, setShowLentOnly] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [lendingId, setLendingId] = useState<string|null>(null);

  useEffect(() => {
    setBooks(loadBooks());
  }, []);
  useEffect(() => {
    saveBooks(books);
  }, [books]);

  function handleAdd({title, author, type}: {title: string, author: string, type?: string}) {
    setBooks(bs => [...bs, createBook(title, author, type)]);
  }

  function handleEdit(id: string, vals: {title: string, author: string, type?: string}) {
    setBooks(bs => bs.map(b => b.id === id ? editBook(b, vals) : b));
    setEditingId(null);
  }

  function handleDelete(id: string) {
    setBooks(bs => deleteBook(bs, id));
  }

  function handleLend(id: string, borrower: string) {
    setBooks(bs => bs.map(b => b.id === id ? lendBook(b, borrower) : b));
    setLendingId(null);
  }

  function handleReturn(id: string) {
    setBooks(bs => bs.map(b => b.id === id ? returnBook(b) : b));
  }

  const visibleBooks = showLentOnly ? filterLentBooks(books) : books;

  return (
    <main style={{maxWidth: 520, margin: '30px auto', fontFamily: 'system-ui'}}>
      <h1>My Bookshelf</h1>

      <section aria-label="Book add form" style={{marginBottom:32}}>
        <h2 style={{fontSize:18}}>Add a Book</h2>
        <BookForm onSubmit={handleAdd} />
      </section>

      <section aria-label="Current books" style={{marginBottom:24}}>
        <h2 style={{fontSize:18}}>All Books ({books.length})</h2>
        <label style={{fontSize:14, marginRight:12}}>
          <input type="checkbox" checked={showLentOnly} onChange={e=>setShowLentOnly(e.target.checked)} /> Show only lent-out books
        </label>
        <div aria-live="polite" style={{marginTop:8}}>
          <strong>{lentBookCount(books)}</strong> out right now
        </div>

        {visibleBooks.length === 0 ? <div style={{marginTop:12}}>No books to show.</div> : (
          <table style={{width:'100%', marginTop:18, borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th align="left">Title</th>
                <th align="left">Author</th>
                <th align="left">Type</th>
                <th align="left">Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
            {visibleBooks.map(book => (
              <tr key={book.id} style={{background: book.borrowedBy ? '#ffe8e0' : 'none'}}>
                <td>{editingId === book.id ? <BookForm initial={book} onSubmit={vals=>handleEdit(book.id, vals)} onCancel={()=>setEditingId(null)} /> : book.title}</td>
                <td>{editingId === book.id ? null : book.author}</td>
                <td>{editingId === book.id ? null : book.type}</td>
                <td>
                  {book.borrowedBy ? (
                    <>
                    Borrowed by <strong>{book.borrowedBy}</strong>{' '}
                    <button onClick={()=>handleReturn(book.id)} aria-label={`Mark returned: ${book.title}`}>Mark returned</button>
                    </>
                  ) : (
                    lendingId === book.id ?
                      <BorrowForm onSubmit={name=>handleLend(book.id, name)} onCancel={()=>setLendingId(null)} /> :
                      <button onClick={()=>setLendingId(book.id)} aria-label={`Lend book: ${book.title}`}>Lend</button>
                  )}
                </td>
                <td>
                  {editingId !== book.id && <><button onClick={()=>setEditingId(book.id)} aria-label={`Edit book: ${book.title}`}>Edit</button>{' '}</>}
                  <button onClick={()=>handleDelete(book.id)} aria-label={`Delete book: ${book.title}`}>Delete</button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
