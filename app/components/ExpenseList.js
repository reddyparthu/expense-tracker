"use client";
import { useState, useMemo } from "react";

const categories = [
  "All",
  "Food & Groceries",
  "Rent & Housing",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Other",
];

export default function ExpenseList({ expenses, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [sortBy, setSortBy] = useState("date-desc");

  const filtered = useMemo(() => {
    let result = [...expenses];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.item.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filterCat !== "All") {
      result = result.filter((e) => e.category === filterCat);
    }

    // Sort
    switch (sortBy) {
      case "date-desc":
        result.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case "date-asc":
        result.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "amount-desc":
        result.sort((a, b) => b.amount - a.amount);
        break;
      case "amount-asc":
        result.sort((a, b) => a.amount - b.amount);
        break;
    }

    return result;
  }, [expenses, search, filterCat, sortBy]);

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="card">
      <h2>
        <span className="section-icon">📋</span>
        Expense History
      </h2>

      {/* Filters Bar */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="amount-desc">Highest Amount</option>
          <option value="amount-asc">Lowest Amount</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="results-summary">
        <span>{filtered.length} expenses</span>
        <span className="results-total">Total: €{filteredTotal.toFixed(2)}</span>
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <p className="no-data">
          {expenses.length === 0
            ? "No expenses yet. Start adding some!"
            : "No expenses match your filters."}
        </p>
      ) : (
        <div className="expense-list">
          {filtered.map((expense) => (
            <div key={expense._id} className="expense-item">
              <div className="expense-info">
                <span className="expense-name">{expense.item}</span>
                <span className="expense-meta">
                  {expense.category} · {formatDate(expense.date)}
                </span>
              </div>
              <div className="expense-right">
                <span className="expense-amount">
                  €{expense.amount.toFixed(2)}
                </span>
                <button
                  className="delete-btn"
                  onClick={() => onDelete(expense._id)}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}