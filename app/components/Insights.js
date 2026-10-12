"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { catIcon, catColor, catMeta } from "@/lib/categories";
import { tooltipProps, axisProps, ACCENT } from "@/lib/chartTheme";
import {
  expenseKey,
  keyToDate,
  localDateKey,
  addDays,
  daysInMonth,
  sum,
  round2,
  euro,
} from "@/lib/period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

// Last n months (oldest first) as { key, label, y, m }
function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d.getFullYear(), d.getMonth()),
      label: `${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? " " + String(d.getFullYear()).slice(2) : ""}`,
      y: d.getFullYear(),
      m: d.getMonth(),
    });
  }
  return out;
}

function exportCsv(expenses) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["Date", "Item", "Category", "Amount (EUR)"]];
  [...expenses]
    .sort((a, b) => (expenseKey(a) < expenseKey(b) ? 1 : -1))
    .forEach((e) => rows.push([expenseKey(e), e.item, e.category, e.amount.toFixed(2)]));
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spendwise-expenses-${localDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Insights({ expenses }) {
  if (expenses.length === 0) {
    return (
      <div className="panel">
        <p className="no-data">Add some expenses to unlock insights.</p>
      </div>
    );
  }

  const now = new Date();
  const todayKey = localDateKey();
  const thisMonth = monthKey(now.getFullYear(), now.getMonth());
  const dayOfMonth = now.getDate();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());

  // Totals per month and per month+category
  const byMonth = {};
  const byMonthCat = {};
  expenses.forEach((e) => {
    const mk = expenseKey(e).slice(0, 7);
    byMonth[mk] = (byMonth[mk] || 0) + e.amount;
    byMonthCat[mk] = byMonthCat[mk] || {};
    byMonthCat[mk][e.category] = (byMonthCat[mk][e.category] || 0) + e.amount;
  });

  // --- Month so far, projection, same-point comparison ---
  const monthSoFar = byMonth[thisMonth] || 0;
  const projected = (monthSoFar / dayOfMonth) * dim;

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prev.getFullYear(), prev.getMonth());
  const prevCutoff = Math.min(dayOfMonth, daysInMonth(prev.getFullYear(), prev.getMonth()));
  const prevToDate = sum(
    expenses.filter((e) => {
      const k = expenseKey(e);
      return k.startsWith(prevKey) && Number(k.slice(8, 10)) <= prevCutoff;
    })
  );
  const vsPrev = prevToDate > 0 ? ((monthSoFar - prevToDate) / prevToDate) * 100 : null;

  // Average of completed months that have data (up to last 6)
  const months12 = lastMonths(12);
  const completed = months12.slice(0, -1).filter((m) => byMonth[m.key]).slice(-6);
  const avgMonth = completed.length ? sum(completed.map((m) => ({ amount: byMonth[m.key] }))) / completed.length : null;

  // --- 12-month chart ---
  const monthlyData = months12.map((m) => ({
    name: m.label,
    amount: round2(byMonth[m.key] || 0),
    current: m.key === thisMonth,
  }));

  // --- Category trend (last 6 months, stacked) ---
  const months6 = lastMonths(6);
  const catTotals6 = {};
  months6.forEach((m) => {
    Object.entries(byMonthCat[m.key] || {}).forEach(([c, v]) => {
      catTotals6[c] = (catTotals6[c] || 0) + v;
    });
  });
  const trendCats = Object.keys(catTotals6).sort((a, b) => catTotals6[b] - catTotals6[a]);
  const trendData = months6.map((m) => {
    const row = { name: m.label };
    trendCats.forEach((c) => (row[c] = round2(byMonthCat[m.key]?.[c] || 0)));
    return row;
  });

  // --- Category: this month vs average of previous 3 months ---
  const prev3 = lastMonths(4).slice(0, 3);
  const allCats = new Set([
    ...Object.keys(byMonthCat[thisMonth] || {}),
    ...prev3.flatMap((m) => Object.keys(byMonthCat[m.key] || {})),
  ]);
  const catCompare = [...allCats]
    .map((c) => {
      const cur = byMonthCat[thisMonth]?.[c] || 0;
      const avg = prev3.reduce((s, m) => s + (byMonthCat[m.key]?.[c] || 0), 0) / 3;
      return { name: c, cur, avg, diff: cur - avg };
    })
    .sort((a, b) => b.cur - a.cur);

  // --- Weekday pattern (last 90 days, average per weekday) ---
  const since90 = localDateKey(addDays(now, -89));
  const weekdayTotals = Array(7).fill(0);
  expenses.forEach((e) => {
    const k = expenseKey(e);
    if (k >= since90 && k <= todayKey) {
      weekdayTotals[(keyToDate(k).getDay() + 6) % 7] += e.amount;
    }
  });
  // 90 days ≈ 12.86 of each weekday
  const weekdayData = WEEKDAYS.map((name, i) => ({ name, amount: round2(weekdayTotals[i] / (90 / 7)) }));
  const peakDay = weekdayData.reduce((m, d) => (d.amount > m.amount ? d : m), weekdayData[0]);

  // --- Biggest expenses (last 90 days) ---
  const biggest = expenses
    .filter((e) => expenseKey(e) >= since90)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // --- Most frequent items (all time) ---
  const itemMap = {};
  expenses.forEach((e) => {
    const name = e.item.trim().toLowerCase();
    if (!itemMap[name]) itemMap[name] = { name: e.item.trim(), count: 0, total: 0, category: e.category };
    itemMap[name].count++;
    itemMap[name].total += e.amount;
  });
  const frequent = Object.values(itemMap)
    .filter((i) => i.count > 1)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 6);

  return (
    <div className="insights">
      <div className="insights-toolbar">
        <button className="btn btn-ghost btn-small" onClick={() => exportCsv(expenses)}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Headline numbers */}
      <div className="summary-cards">
        <div className="summary-card today-card">
          <span className="summary-icon">🗓️</span>
          <div className="summary-text">
            <span className="summary-label">This Month So Far</span>
            <span className="summary-amount">{euro(monthSoFar)}</span>
            {vsPrev !== null && (
              <span className={`summary-change ${vsPrev > 0 ? "up" : "down"}`}>
                {vsPrev > 0 ? "▲" : "▼"} {Math.abs(vsPrev).toFixed(0)}% vs same point last month
              </span>
            )}
          </div>
        </div>
        <div className="summary-card weekly-card">
          <span className="summary-icon">🔮</span>
          <div className="summary-text">
            <span className="summary-label">Projected Month-End</span>
            <span className="summary-amount">{euro(projected)}</span>
            <span className="summary-sub">at {euro(monthSoFar / dayOfMonth)}/day</span>
          </div>
        </div>
        <div className="summary-card monthly-card">
          <span className="summary-icon">📊</span>
          <div className="summary-text">
            <span className="summary-label">Average Month</span>
            <span className="summary-amount">{avgMonth !== null ? euro(avgMonth) : "—"}</span>
            {avgMonth !== null && (
              <span className="summary-sub">
                last {completed.length} full {completed.length === 1 ? "month" : "months"}
              </span>
            )}
          </div>
        </div>
        <div className="summary-card total-card">
          <span className="summary-icon">📅</span>
          <div className="summary-text">
            <span className="summary-label">Priciest Weekday</span>
            <span className="summary-amount">{peakDay.amount > 0 ? peakDay.name : "—"}</span>
            {peakDay.amount > 0 && <span className="summary-sub">avg {euro(peakDay.amount)}</span>}
          </div>
        </div>
      </div>

      {/* 12 months */}
      <div className="panel panel-wide">
        <h3 className="panel-title">Last 12 Months</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={monthlyData}>
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} />
            <Tooltip formatter={(v) => [`€${v}`, "Spent"]} {...tooltipProps} />
            <Bar dataKey="amount" radius={[6, 6, 2, 2]} maxBarSize={36}>
              {monthlyData.map((d) => (
                <Cell key={d.name} fill={d.current ? ACCENT : "var(--bar-muted)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="charts-grid">
        {/* Category trend */}
        <div className="panel">
          <h3 className="panel-title">Category Trend (6 months)</h3>
          {trendCats.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData}>
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} width={44} />
                <Tooltip formatter={(v) => `€${v}`} {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} iconType="circle" iconSize={8} formatter={(v) => catMeta(v).short} />
                {trendCats.map((c) => (
                  <Bar key={c} dataKey={c} stackId="a" fill={catColor(c)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="no-data">No data in the last 6 months</p>
          )}
        </div>

        {/* Weekday pattern */}
        <div className="panel">
          <h3 className="panel-title">Average by Weekday (90 days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekdayData}>
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} width={40} />
              <Tooltip formatter={(v) => [`€${v}`, "Avg"]} {...tooltipProps} />
              <Bar dataKey="amount" radius={[6, 6, 2, 2]} maxBarSize={36}>
                {weekdayData.map((d) => (
                  <Cell key={d.name} fill={d.name === peakDay.name ? ACCENT : "var(--bar-muted)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category vs usual */}
      <div className="panel panel-wide insight-block">
        <h3 className="panel-title">This Month vs Your Usual</h3>
        <p className="insight-note">Compared with your average of the previous 3 months</p>
        {catCompare.length ? (
          <div className="compare-list">
            {catCompare.map((c) => {
              const pct = c.avg > 0 ? (c.diff / c.avg) * 100 : null;
              const cls = Math.abs(c.diff) < 0.5 ? "flat" : c.diff > 0 ? "up" : "down";
              return (
                <div key={c.name} className="compare-row">
                  <span className="compare-name">
                    {catIcon(c.name)} {c.name}
                  </span>
                  <span className="compare-vals">
                    <span className="compare-cur">{euro(c.cur)}</span>
                    <span className="compare-avg">usual {euro(c.avg)}</span>
                  </span>
                  <span className={`compare-diff ${cls}`}>
                    {cls === "flat"
                      ? "≈ same"
                      : `${c.diff > 0 ? "▲" : "▼"} ${pct !== null ? Math.abs(pct).toFixed(0) + "%" : "new"}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-data">Not enough data yet</p>
        )}
      </div>

      <div className="bottom-grid">
        <div className="panel">
          <h3 className="panel-title">Biggest Expenses (90 days)</h3>
          {biggest.length ? (
            <div className="recent-list">
              {biggest.map((e) => (
                <div key={e._id} className="recent-item">
                  <div className="recent-info">
                    <span className="recent-name">
                      {catIcon(e.category)} {e.item}
                    </span>
                    <span className="recent-cat">
                      {keyToDate(expenseKey(e)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·{" "}
                      {e.category}
                    </span>
                  </div>
                  <span className="recent-amount">{euro(e.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">Nothing in the last 90 days</p>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">Most Frequent Purchases</h3>
          {frequent.length ? (
            <div className="recent-list">
              {frequent.map((i) => (
                <div key={i.name} className="recent-item">
                  <div className="recent-info">
                    <span className="recent-name">
                      {catIcon(i.category)} {i.name}
                    </span>
                    <span className="recent-cat">
                      {i.count}× · avg {euro(i.total / i.count)}
                    </span>
                  </div>
                  <span className="recent-amount">{euro(i.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No repeat purchases yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
