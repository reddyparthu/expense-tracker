"use client";
import { useState, useMemo } from "react";
import PeriodPicker, { SwipeArea } from "./PeriodPicker";
import DayGroups, { groupByDay } from "./DayGroups";
import { getRange, filterByRange, sum, euro } from "@/lib/period";
import { CATEGORIES } from "@/lib/categories";
import Icon from "./Icon";

export default function ExpenseList({ expenses, onDelete, period, onPeriodChange }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [sortBy, setSortBy] = useState("date-desc");

  const range = getRange(period.mode, period.anchor);

  const filtered = useMemo(() => {
    let result = filterByRange(expenses, range);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.item.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      );
    }
    if (filterCat !== "All") {
      result = result.filter((e) => e.category === filterCat);
    }
    return result;
    // range.start/end identify the period
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, search, filterCat, range.start, range.end]);

  // Days are the blocks; sort controls the order of days and of items inside each day.
  const groups = useMemo(() => {
    const g = groupByDay(filtered);
    const byAmount = (a, b) => b.amount - a.amount;
    switch (sortBy) {
      case "date-asc":
        g.reverse();
        break;
      case "amount-desc":
        g.sort((a, b) => b.total - a.total);
        g.forEach((d) => d.items.sort(byAmount));
        break;
      case "amount-asc":
        g.sort((a, b) => a.total - b.total);
        g.forEach((d) => d.items.sort((a, b) => a.amount - b.amount));
        break;
    }
    return g;
  }, [filtered, sortBy]);

  const filteredTotal = sum(filtered);

  return (
    <div>
      <PeriodPicker period={period} onChange={onPeriodChange} />

      <div className="chips" data-noswipe>
        {[{ name: "All", icon: "all" }, ...CATEGORIES].map((c) => (
          <button
            key={c.name}
            className={`chip ${filterCat === c.name ? "active" : ""}`}
            onClick={() => setFilterCat(c.name)}
          >
            <Icon name={c.icon} size={15} /> {c.short || c.name}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="filters-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search titles, categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Highest Day First</option>
            <option value="amount-asc">Lowest Day First</option>
          </select>
        </div>

        <div className="results-summary">
          <span>
            {filtered.length} expenses · {groups.length} {groups.length === 1 ? "day" : "days"}
          </span>
          <span className="results-total">Total: {euro(filteredTotal)}</span>
        </div>

        <SwipeArea period={period} onChange={onPeriodChange}>
          {filtered.length === 0 ? (
            <p className="no-data">
              {expenses.length === 0
                ? "No expenses yet. Start adding some!"
                : search || filterCat !== "All"
                ? "No expenses match your filters."
                : `No expenses · ${range.label}`}
            </p>
          ) : (
            <DayGroups groups={groups} onDelete={onDelete} />
          )}
        </SwipeArea>
      </div>
    </div>
  );
}
