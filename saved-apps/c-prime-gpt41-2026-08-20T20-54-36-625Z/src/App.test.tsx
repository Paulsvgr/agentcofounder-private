import React from 'react';
import { describe, beforeEach, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

function addBook(title: string, author: string, type?: string) {
  fireEvent.change(screen.getByLabelText(/title/i), {target: {value: title}});
  fireEvent.change(screen.getByLabelText(/author/i), {target: {value: author}});
  if (type)
    fireEvent.change(screen.getByLabelText(/type/i), {target: {value: type}});
  fireEvent.click(screen.getByText(/add book/i));
}

describe('Bookshelf App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lets you add, lend out, return, edit, delete, filter, and counts lent books', async () => {
    render(<App />);

    expect(screen.getByText(/all books/i)).toHaveTextContent('All Books (0)');

    // Add a book
    addBook('Dune', 'Frank Herbert', 'Novel');
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();

    // Add another
    addBook('Salt Fat Acid Heat', 'Samin Nosrat', 'Cookbook');
    expect(screen.getByText('Salt Fat Acid Heat')).toBeInTheDocument();
    expect(screen.getByText('Samin Nosrat')).toBeInTheDocument();

    // Lend Dune
    fireEvent.click(screen.getAllByRole('button', {name: /lend/i})[0]);
    fireEvent.change(screen.getByLabelText(/borrower/i), {target:{value:'Alice'}});
    fireEvent.click(screen.getByText(/^save$/i));
    await waitFor(() => expect(screen.getByText('Borrowed by', {exact:false})).toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Use a custom matcher to support split text nodes
    expect(screen.getByText((content, node) => node?.textContent === '1 out right now')).toBeInTheDocument();

    // Filter to lent books only
    fireEvent.click(screen.getByLabelText(/show only lent-out/i));
    expect(screen.queryByText('Salt Fat Acid Heat')).not.toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();

    // Undo filter
    fireEvent.click(screen.getByLabelText(/show only lent-out/i));
    expect(screen.getByText('Salt Fat Acid Heat')).toBeInTheDocument();

    // Mark returned
    fireEvent.click(screen.getByRole('button', {name: /mark returned/i}));
    expect(screen.queryByText('Borrowed by')).not.toBeInTheDocument();
    expect(screen.getByText((content, node) => node?.textContent === '0 out right now')).toBeInTheDocument();

    // Edit Salt Fat Acid Heat
    fireEvent.click(screen.getAllByRole('button', {name: /edit/i})[0]);
    const input = screen.getAllByLabelText('Title').find(el => (el as HTMLInputElement).value === 'Salt Fat Acid Heat' || (el as HTMLInputElement).value === 'Dune');
    fireEvent.change(input as HTMLInputElement, {target:{value:'Salt'}});
    fireEvent.click(screen.getByText(/^save$/i));
    expect(screen.getByText('Salt')).toBeInTheDocument();
    // Wait for disappearance of old book name after saving
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.some(row => row.textContent === 'Salt Fat Acid Heat')).toBe(false);
    });

    // Delete Salt
    // Delete Salt (using specific aria-label)
    const deleteBtn = screen.getByRole('button', { name: 'Delete book: Salt' });
    fireEvent.click(deleteBtn);
    expect(screen.queryByText('Salt')).not.toBeInTheDocument();
    expect(screen.getByText(/^all books \(1\)$/i)).toBeInTheDocument();
  });

  it('requires title and author', () => {
    render(<App />);
    fireEvent.click(screen.getAllByText(/add book/i)[0]);
    expect(screen.getByRole('alert')).toHaveTextContent(/title and author are required/i);
  });
});
