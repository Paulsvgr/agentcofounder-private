import { useMemo, useState } from "react";
import { Book, isLentOut } from "./domain/book.js";
import { useLibrary } from "./storage/useLibrary.js";
import { BookForm, BookFormValues } from "./components/BookForm.js";
import { BookList } from "./components/BookList.js";
import { Filters, CategoryFilter, StatusFilter } from "./components/Filters.js";

export function App() {
  const library = useLibrary();
  const [editing, setEditing] = useState<Book | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("All");

  const lentCount = useMemo(
    () => library.books.filter(isLentOut).length,
    [library.books],
  );

  const visibleBooks = useMemo(() => {
    return library.books.filter((b) => {
      if (status === "available" && isLentOut(b)) return false;
      if (status === "lent" && !isLentOut(b)) return false;
      if (category !== "All" && b.category !== category) return false;
      return true;
    });
  }, [library.books, status, category]);

  function handleSubmit(values: BookFormValues) {
    if (editing) {
      library.editBook(editing.id, {
        title: values.title,
        author: values.author,
        category: values.category,
      });
      setEditing(null);
    } else {
      library.addBook({
        title: values.title,
        author: values.author,
        category: values.category,
      });
    }
  }

  function handleCancelEdit() {
    setEditing(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Home library</p>
          <h1>My Book Shelf</h1>
        </div>
        <p className="stats" aria-live="polite">
          <span className="stats-line">
            {`${lentCount} of ${library.books.length} lent out`}
          </span>
        </p>
      </header>

      <main className="app-main">
        <section className="panel" aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">
            {editing ? "Edit book" : "Add a book"}
          </h2>
          <BookForm
            key={editing ? editing.id : "new"}
            submitLabel={editing ? "Save changes" : "Add book"}
            initialValues={
              editing
                ? {
                    title: editing.title,
                    author: editing.author,
                    category: editing.category,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={editing ? handleCancelEdit : undefined}
          />
        </section>

        <section className="panel" aria-labelledby="shelf-heading">
          <div className="shelf-head">
            <h2 id="shelf-heading">My books</h2>
            <Filters
              status={status}
              category={category}
              onStatusChange={setStatus}
              onCategoryChange={setCategory}
            />
          </div>
          <BookList
            books={visibleBooks}
            onLend={library.lend}
            onReturn={library.returnLoan}
            onEdit={setEditing}
            onDelete={library.removeBook}
          />
        </section>
      </main>
    </div>
  );
}
