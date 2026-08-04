"use client";
import { useState } from "react";

const categories = [
  { name: "Food & Groceries", icon: "🛒" },
  { name: "Rent & Housing", icon: "🏠" },
  { name: "Transport", icon: "🚗" },
  { name: "Utilities", icon: "💡" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Health", icon: "💊" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Other", icon: "📦" },
];

export default function ExpenseForm({ onExpenseAdded }) {
  const [form, setForm] = useState({
    item: "",
    amount: "",
    category: "Food & Groceries",
    date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setMessage("Expense added!");
        setForm({
          item: "",
          amount: "",
          category: "Food & Groceries",
          date: new Date().toISOString().split("T")[0],
        });
        if (onExpenseAdded) onExpenseAdded();
        setTimeout(() => setMessage(""), 2500);
      } else {
        setMessage("Failed to add expense");
      }
    } catch (err) {
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>
        <span className="section-icon">✏️</span>
        Add Expense
      </h2>

      {message && (
        <div className={`form-message ${message.includes("added") ? "success" : "error"}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>What did you spend on?</label>
          <input
            type="text"
            placeholder="e.g. Rice, Bus ticket, Netflix"
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Amount (€)</label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Category</label>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                className={`category-btn ${form.category === cat.name ? "active" : ""}`}
                onClick={() => setForm({ ...form, category: cat.name })}
              >
                <span className="cat-icon">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? "Adding..." : "Add Expense"}
        </button>
      </form>
    </div>
  );
}