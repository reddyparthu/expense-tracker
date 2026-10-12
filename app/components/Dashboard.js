"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import PeriodPicker, { SwipeArea } from "./PeriodPicker";
import DayGroups from "./DayGroups";
import {
  getRange,
  shiftAnchor,
  filterByRange,
  expenseKey,
  keyToDate,
  localDateKey,
  addDays,
  sum,
  round2,
  euro,
} from "@/lib/period";

export const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#6b7280",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const tooltipStyle = { borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" };

export function categoryTotals(list) {
  const map = {};
  list.forEach((e) => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

// Bars for the period: hours don't exist, so Day mode shows categories instead.
function breakdown(mode, range, list) {
  const byKey = {};
  list.forEach((e) => {
    const k = expenseKey(e);
    byKey[k] = (byKey[k] || 0) + e.amount;
  });

  if (mode === "week") {
    const start = keyToDate(range.start);
    return WEEKDAYS.map((name, i) => ({
      name,
      amount: round2(byKey[localDateKey(addDays(start, i))] || 0),
    }));
  }
  if (mode === "month") {
    const start = keyToDate(range.start);
    return Array.from({ length: range.days }, (_, i) => ({
      name: String(i + 1),
      amount: round2(byKey[localDateKey(addDays(start, i))] || 0),
    }));
  }
  if (mode === "year") {
    const totals = Array(12).fill(0);
    list.forEach((e) => {
      totals[Number(expenseKey(e).slice(5, 7)) - 1] += e.amount;
    });
    return MONTHS.map((name, i) => ({ name, amount: round2(totals[i]) }));
  }
  if (mode === "all") {
    const totals = {};
    list.forEach((e) => {
      const k = expenseKey(e).slice(0, 7);
      totals[k] = (totals[k] || 0) + e.amount;
    });
    return Object.keys(totals)
      .sort()
      .map((k) => ({
        name: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`,
        amount: round2(totals[k]),
      }));
  }
  return categoryTotals(list).map((c) => ({ name: c.name.split(" ")[0], amount: c.value }));
}

const BREAKDOWN_TITLE = {
  day: "Spending by Category",
  week: "Daily Spending",
  month: "Daily Spending",
  year: "Monthly Spending",
  all: "Monthly Spending",
};

const PREV_LABEL = {
  day: "vs previous day",
  week: "vs last week",
  month: "vs last month",
  year: "vs last year",
};

export default function Dashboard({ expenses, period, onPeriodChange }) {
  const { mode, anchor } = period;
  const range = getRange(mode, anchor);
  const periodExpenses = filterByRange(expenses, range);
  const total = sum(periodExpenses);

  // Previous period comparison
  let change = null;
  if (mode !== "all") {
    const prevTotal = sum(filterByRange(expenses, getRange(mode, shiftAnchor(mode, anchor, -1))));
    if (prevTotal > 0) change = ((total - prevTotal) / prevTotal) * 100;
  }

  // Average per day over the days elapsed so far in the period
  let avgPerDay = null;
  if (mode !== "day") {
    const today = localDateKey();
    let first = range.start;
    let last = range.end && range.end < today ? range.end : today;
    if (mode === "all") {
      const keys = periodExpenses.map(expenseKey).sort();
      first = keys[0];
    }
    if (first && last >= first) {
      const days = Math.round((keyToDate(last) - keyToDate(first)) / 86400000) + 1;
      avgPerDay = total / days;
    }
  }

  const biggest = periodExpenses.reduce((m, e) => (!m || e.amount > m.amount ? e : m), null);
  const categoryData = categoryTotals(periodExpenses);
  const topCategories = categoryData.slice(0, 5);
  const bars = breakdown(mode, range, periodExpenses);

  return (
    <div className="dashboard">
      <PeriodPicker period={period} onChange={onPeriodChange} />

      <SwipeArea period={period} onChange={onPeriodChange}>
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card today-card">
            <span className="summary-icon">💸</span>
            <div className="summary-text">
              <span className="summary-label">Spent</span>
              <span className="summary-amount">{euro(total)}</span>
              {change !== null && (
                <span className={`summary-change ${change > 0 ? "up" : "down"}`}>
                  {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% {PREV_LABEL[mode]}
                </span>
              )}
            </div>
          </div>
          <div className="summary-card weekly-card">
            <span className="summary-icon">🧾</span>
            <div className="summary-text">
              <span className="summary-label">Expenses</span>
              <span className="summary-amount">{periodExpenses.length}</span>
            </div>
          </div>
          <div className="summary-card monthly-card">
            <span className="summary-icon">📈</span>
            <div className="summary-text">
              <span className="summary-label">{avgPerDay !== null ? "Avg / Day" : "Avg / Expense"}</span>
              <span className="summary-amount">
                {avgPerDay !== null
                  ? euro(avgPerDay)
                  : euro(periodExpenses.length ? total / periodExpenses.length : 0)}
              </span>
            </div>
          </div>
          <div className="summary-card total-card">
            <span className="summary-icon">🏆</span>
            <div className="summary-text">
              <span className="summary-label">Biggest</span>
              <span className="summary-amount">{biggest ? euro(biggest.amount) : "—"}</span>
              {biggest && <span className="summary-sub">{biggest.item}</span>}
            </div>
          </div>
        </div>

        {periodExpenses.length === 0 ? (
          <div className="card">
            <p className="no-data">No expenses · {range.label}</p>
          </div>
        ) : (
          <>
            <div className="charts-grid">
              <div className="chart-card">
                <h3>{BREAKDOWN_TITLE[mode]}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bars}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={mode === "month" ? 4 : "preserveStartEnd"}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v) => [`€${v}`, "Spent"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>By Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      dataKey="value"
                      paddingAngle={3}
                      label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `€${v}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bottom-grid">
              <div className="card">
                <h3>Top Categories</h3>
                <div className="top-categories">
                  {topCategories.map((cat, i) => (
                    <div key={cat.name} className="top-cat-item">
                      <div className="top-cat-info">
                        <div className="top-cat-dot" style={{ background: COLORS[i] }}></div>
                        <span className="top-cat-name">{cat.name}</span>
                      </div>
                      <div className="top-cat-right">
                        <span className="top-cat-amount">
                          {euro(cat.value)}{" "}
                          <span className="top-cat-pct">{((cat.value / total) * 100).toFixed(0)}%</span>
                        </span>
                        <div className="top-cat-bar-bg">
                          <div
                            className="top-cat-bar-fill"
                            style={{
                              width: `${(cat.value / categoryData[0].value) * 100}%`,
                              background: COLORS[i],
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>Activity</h3>
                <DayGroups expenses={periodExpenses} limitDays={4} />
              </div>
            </div>
          </>
        )}
      </SwipeArea>
    </div>
  );
}
