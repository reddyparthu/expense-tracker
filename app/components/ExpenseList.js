"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import PeriodPicker, { SwipeArea } from "./PeriodPicker";
import DayGroups, { groupByDay } from "./DayGroups";
import { getRange, filterByRange, expenseKey, keyToDate, sum, euro } from "@/lib/period";
import { CATEGORIES } from "@/lib/categories";
import { parseQuery, isEmptyQuery, describeQuery, matchExpense, matchingItems, topNames } from "@/lib/search";
import Icon from "./Icon";

const EXAMPLES = [">50", "under 10", "last month", "€13.99"];

const shortDate = (key) =>
  keyToDate(key).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function ExpenseList({ expenses, onDelete, period, onPeriodChange, focusSignal = 0 }) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all"); // while searching: "all" time or the selected "period"
  const [focused, setFocused] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [sortBy, setSortBy] = useState("date-desc");
  const inputRef = useRef(null);

  const range = getRange(period.mode, period.anchor);
  const query = useMemo(() => parseQuery(search), [search]);
  const searching = !isEmptyQuery(query);
  const suggestions = useMemo(() => topNames(expenses, 6), [expenses]);

  // Focus the box when asked from the nav bar, and with "/" on a keyboard
  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setSearch("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    // Searching looks through all time unless the user narrows it to the selected period
    let result = searching && scope === "all" ? expenses : filterByRange(expenses, range);
    if (searching) result = result.filter((e) => matchExpense(e, query));
    if (filterCat !== "All") result = result.filter((e) => e.category === filterCat);
    return result;
    // range.start/end identify the period
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, query, searching, scope, filterCat, range.start, range.end]);

  // Receipts whose items matched: open them so the matching lines are visible
  const openIds = useMemo(() => {
    if (!searching) return null;
    return new Set(filtered.filter((e) => matchingItems(e, query).length).map((e) => e._id));
  }, [filtered, query, searching]);

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
  const chips = searching ? describeQuery(query) : [];
  const dates = filtered.map(expenseKey).sort();
  const span = dates.length > 1 && dates[0] !== dates[dates.length - 1] ? `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : null;

  const applySuggestion = (text) => {
    // "last month" is a shortcut for the previous month's name
    if (text === "last month") {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      text = `${d.toLocaleDateString("en-GB", { month: "long" }).toLowerCase()} ${d.getFullYear()}`;
    }
    setSearch(text);
    inputRef.current?.focus();
  };

  return (
    <div>
      {/* Search */}
      <div className={`searchbar ${focused ? "focused" : ""}`}>
        <span className="searchbar-icon">
          <Icon name="search" size={18} />
        </span>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          className="searchbar-input"
          placeholder="Search stores, items, amounts, months…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Search expenses"
        />
        {search ? (
          <button className="searchbar-clear" onClick={() => setSearch("")} aria-label="Clear search">
            ✕
          </button>
        ) : (
          <kbd className="searchbar-kbd">/</kbd>
        )}
      </div>

      {searching ? (
        <div className="search-meta">
          <div className="search-chips">
            {chips.map((c) => (
              <span key={c} className="search-chip">
                {c}
              </span>
            ))}
          </div>
          <div className="seg small">
            <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
              All time
            </button>
            <button className={scope === "period" ? "active" : ""} onClick={() => setScope("period")}>
              {range.label}
            </button>
          </div>
        </div>
      ) : (
        focused && (
          <div className="search-suggest" onMouseDown={(e) => e.preventDefault()}>
            {suggestions.map((s) => (
              <button key={s} className="search-chip as-button" onClick={() => applySuggestion(s)}>
                {s}
              </button>
            ))}
            {EXAMPLES.map((s) => (
              <button key={s} className="search-chip as-button ghost" onClick={() => applySuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        )
      )}

      {(!searching || scope === "period") && <PeriodPicker period={period} onChange={onPeriodChange} />}

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
        <div className="results-summary">
          <span>
            {searching ? (
              <>
                <strong>{filtered.length}</strong> {filtered.length === 1 ? "result" : "results"}
                {span ? ` · ${span}` : ""}
              </>
            ) : (
              <>
                {filtered.length} expenses · {groups.length} {groups.length === 1 ? "day" : "days"}
              </>
            )}
          </span>
          <span className="results-right">
            <span className="results-total">Total: {euro(filteredTotal)}</span>
            <select className="filter-select small" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest day first</option>
              <option value="amount-asc">Lowest day first</option>
            </select>
          </span>
        </div>

        <MaybeSwipe enabled={!searching || scope === "period"} period={period} onChange={onPeriodChange}>
          {filtered.length === 0 ? (
            <div className="no-data">
              {expenses.length === 0 ? (
                "No expenses yet. Start adding some!"
              ) : searching ? (
                <>
                  <p>Nothing matches “{search.trim()}”{scope === "period" ? ` in ${range.label}` : ""}.</p>
                  {scope === "period" && (
                    <button className="btn btn-ghost btn-small no-data-action" onClick={() => setScope("all")}>
                      Search all time
                    </button>
                  )}
                </>
              ) : filterCat !== "All" ? (
                "No expenses match your filters."
              ) : (
                `No expenses · ${range.label}`
              )}
            </div>
          ) : (
            <DayGroups
              groups={groups}
              onDelete={onDelete}
              highlight={searching ? query.terms : null}
              openIds={openIds}
            />
          )}
        </MaybeSwipe>
      </div>
    </div>
  );
}

// Swiping changes the period, which means nothing while searching all time
function MaybeSwipe({ enabled, period, onChange, children }) {
  return enabled ? (
    <SwipeArea period={period} onChange={onChange}>
      {children}
    </SwipeArea>
  ) : (
    children
  );
}
