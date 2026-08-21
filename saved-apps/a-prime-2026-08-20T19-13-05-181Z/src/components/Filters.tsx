import { CATEGORIES } from "../domain/book.js";

export type StatusFilter = "all" | "available" | "lent";
export type CategoryFilter = "All" | (typeof CATEGORIES)[number];

interface FiltersProps {
  status: StatusFilter;
  category: CategoryFilter;
  onStatusChange: (value: StatusFilter) => void;
  onCategoryChange: (value: CategoryFilter) => void;
}

export function Filters({
  status,
  category,
  onStatusChange,
  onCategoryChange,
}: FiltersProps) {
  return (
    <div className="filters">
      <div className="field">
        <label htmlFor="status-filter">Status</label>
        <select
          id="status-filter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        >
          <option value="all">All books</option>
          <option value="available">On the shelf</option>
          <option value="lent">Lent out</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="category-filter">Category</label>
        <select
          id="category-filter"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
