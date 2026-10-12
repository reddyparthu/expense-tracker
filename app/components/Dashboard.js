"use client";
import { useState } from "react";
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
  AreaChart,
  Area,
} from "recharts";
import PeriodPicker, { SwipeArea } from "./PeriodPicker";
import Row from "./Row";
import DetailModal from "./DetailModal";
import { groupByDay, dayHeading } from "./DayGroups";
import { catMeta } from "@/lib/categories";
import { CatIcon } from "./Icon";
import { tooltipProps, axisProps, ACCENT, accentShade } from "@/lib/chartTheme";
import {
  getRange,
  shiftAnchor,
  filterByRange,
  inRange,
  expenseKey,
  keyToDate,
  localDateKey,
  addDays,
  sum,
  round2,
  euro,
} from "@/lib/period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function categoryTotals(list) {
  const map = {};
  list.forEach((e) => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: round2(value), count: list.filter((e) => e.category === name).length }))
    .sort((a, b) => b.value - a.value);
}

// Bars for the period. A single day has no time axis, so Day mode shows categories.
function breakdown(mode, range, list) {
  const byKey = {};
  list.forEach((e) => {
    const k = expenseKey(e);
    byKey[k] = (byKey[k] || 0) + e.amount;
  });

  if (mode === "week" || mode === "month") {
    const start = keyToDate(range.start);
    return Array.from({ length: range.days }, (_, i) => ({
      name: mode === "week" ? WEEKDAYS[i] : String(i + 1),
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
      .map((k) => ({ name: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, amount: round2(totals[k]) }));
  }
  return categoryTotals(list).map((c) => ({ name: catMeta(c.name).short, amount: c.value }));
}

const OVERVIEW = {
  day: "Daily overview",
  week: "Weekly overview",
  month: "Monthly overview",
  year: "Yearly overview",
  all: "All-time overview",
};

const PREV_LABEL = {
  day: "vs previous day",
  week: "vs last week",
  month: "vs last month",
  year: "vs last year",
};

const BREAKDOWN_TITLE = {
  day: "By Category",
  week: "Day by Day",
  month: "Day by Day",
  year: "Month by Month",
  all: "Month by Month",
};

export default function Dashboard({ expenses, period, onPeriodChange, onNavigate, onDelete }) {
  const [detail, setDetail] = useState(null);
  const { mode, anchor } = period;
  const range = getRange(mode, anchor);
  const periodExpenses = filterByRange(expenses, range);
  const total = sum(periodExpenses);

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
    const last = range.end && range.end < today ? range.end : today;
    if (mode === "all") first = periodExpenses.map(expenseKey).sort()[0];
    if (first && last >= first) {
      avgPerDay = total / (Math.round((keyToDate(last) - keyToDate(first)) / 86400000) + 1);
    }
  }

  const categoryData = categoryTotals(periodExpenses);
  const topCat = categoryData[0];
  const days = groupByDay(periodExpenses);
  const biggest = periodExpenses.reduce((m, e) => (!m || e.amount > m.amount ? e : m), null);
  const bars = breakdown(mode, range, periodExpenses);
  // Billboard artwork: running total across the period, a smooth "journey" curve
  // (stops at today for the current period so it doesn't flatline into the future)
  let running = 0;
  let elapsed = bars.length;
  const todayKey = localDateKey();
  if ((mode === "week" || mode === "month") && range.end > todayKey) {
    elapsed = Math.round((keyToDate(todayKey) - keyToDate(range.start)) / 86400000) + 1;
  } else if (mode === "year" && range.end > todayKey) {
    elapsed = new Date().getMonth() + 1;
  }
  const heroArt = mode === "day" ? [] : bars.slice(0, elapsed).map((b) => ({ amount: (running += b.amount) }));

  const openPeriod = () =>
    setDetail({
      eyebrow: OVERVIEW[mode],
      title: range.label,
      subtitle: `${periodExpenses.length} expenses`,
      match: (e) => inRange(expenseKey(e), range),
    });

  const openDay = (key) => {
    const { title, sub } = dayHeading(key);
    setDetail({
      eyebrow: "Day",
      title,
      subtitle: sub,
      match: (e) => expenseKey(e) === key,
    });
  };

  const openCategory = (name) => {
    setDetail({
      eyebrow: range.label,
      title: name,
      icon: <CatIcon name={name} size={120} />,
      match: (e) => e.category === name && inRange(expenseKey(e), range),
    });
  };

  return (
    <div className="home">
      <PeriodPicker period={period} onChange={onPeriodChange} />

      <SwipeArea period={period} onChange={onPeriodChange}>
        {/* ===== Billboard ===== */}
        <section className="hero">
          <div className="hero-art" aria-hidden="true">
            {heroArt.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heroArt} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#heroFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="hero-shade" />

          <div className="hero-content">
            <span className="eyebrow">{OVERVIEW[mode]}</span>
            <span className="hero-period">{range.label}</span>
            <h1 className="hero-title">{euro(total)}</h1>

            <div className="hero-meta">
              {change !== null && (
                <span className={`hero-change ${change > 0 ? "up" : "down"}`}>
                  {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% {PREV_LABEL[mode]}
                </span>
              )}
              <span>{periodExpenses.length} expenses</span>
              {avgPerDay !== null && <span className="hero-badge">{euro(avgPerDay)}/day</span>}
              {days.length > 0 && mode !== "day" && <span>{days.length} active days</span>}
            </div>

            <p className="hero-desc">
              {periodExpenses.length === 0
                ? "Nothing spent in this period yet. Swipe back to explore earlier periods, or add your first expense."
                : topCat
                ? `${topCat.name} leads at ${((topCat.value / total) * 100).toFixed(0)}% of your spending. Biggest single spend: ${biggest.item} (${euro(biggest.amount)}).`
                : null}
            </p>

            <div className="hero-actions">
              <button className="btn btn-primary hero-btn" onClick={() => onNavigate("add")}>
                ＋ Add expense
              </button>
              {periodExpenses.length > 0 && (
                <button className="btn btn-ghost hero-btn" onClick={openPeriod}>
                  View details →
                </button>
              )}
            </div>
          </div>
        </section>

        {periodExpenses.length > 0 && (
          <div className="rows">
            {/* ===== Recent days ===== */}
            <Row title="Day by day" meta={`${days.length} days`}>
              {days.map(({ key, items, total: dayTotal }) => {
                const d = keyToDate(key);
                const { title } = dayHeading(key);
                return (
                  <button key={key} className="tile day-tile" onClick={() => openDay(key)}>
                    <div className="day-tile-top">
                      <span className="day-tile-num">{d.getDate()}</span>
                      <span className="day-tile-mon">
                        {MONTHS[d.getMonth()]}
                        <br />
                        <small>{title === "Today" || title === "Yesterday" ? title : d.toLocaleDateString("en-GB", { weekday: "short" })}</small>
                      </span>
                    </div>
                    <div className="day-tile-chips">
                      {items.slice(0, 3).map((e) => (
                        <span key={e._id} className="day-tile-chip">
                          <CatIcon name={e.category} size={13} /> {e.item}
                        </span>
                      ))}
                      {items.length > 3 && <span className="day-tile-more">+{items.length - 3} more</span>}
                    </div>
                    <div className="day-tile-foot">
                      <span className="tile-amount">{euro(dayTotal)}</span>
                      <span className="tile-sub">
                        {items.length} {items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </Row>

            {/* ===== Categories ===== */}
            <Row title="Spending by category" meta={`${categoryData.length} ${categoryData.length === 1 ? "category" : "categories"}`}>
              {categoryData.map((c) => {
                const pct = (c.value / total) * 100;
                return (
                  <button key={c.name} className="tile cat-tile" onClick={() => openCategory(c.name)}>
                    <span className="cat-tile-icon">
                      <CatIcon name={c.name} size={88} />
                    </span>
                    <span className="cat-tile-badge">
                      <CatIcon name={c.name} size={18} />
                    </span>
                    <span className="cat-tile-shade" />
                    <span className="cat-tile-body">
                      <span className="cat-tile-name">{c.name}</span>
                      <span className="cat-tile-amount">{euro(c.value)}</span>
                      <span className="cat-tile-bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="cat-tile-sub">
                        {pct.toFixed(0)}% · {c.count} {c.count === 1 ? "expense" : "expenses"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </Row>

            {/* ===== Charts ===== */}
            <section className="row">
              <div className="row-head">
                <h2 className="row-title">Breakdown</h2>
              </div>
              <div className="charts-grid">
                <div className="panel">
                  <h3 className="panel-title">{BREAKDOWN_TITLE[mode]}</h3>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={bars} margin={{ left: -12, right: 4, top: 8 }}>
                      <defs>
                        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT} />
                          <stop offset="100%" stopColor={ACCENT} stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" {...axisProps} interval={mode === "month" ? 4 : "preserveStartEnd"} />
                      <YAxis {...axisProps} width={44} />
                      <Tooltip {...tooltipProps} formatter={(v) => [`€${v}`, "Spent"]} />
                      <Bar dataKey="amount" fill="url(#barFill)" radius={[6, 6, 2, 2]} maxBarSize={36}>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="panel">
                  <h3 className="panel-title">Share by Category</h3>
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          outerRadius={88}
                          innerRadius={62}
                          dataKey="value"
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categoryData.map((c, i) => (
                            <Cell key={c.name} fill={accentShade(i, categoryData.length)} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipProps} formatter={(v, n) => [`€${v}`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <span className="donut-label">Total</span>
                      <span className="donut-value">{euro(total)}</span>
                    </div>
                  </div>
                  <div className="legend">
                    {categoryData.map((c, i) => (
                      <span key={c.name} className="legend-item">
                        <span className="legend-dot" style={{ background: accentShade(i, categoryData.length) }} />
                        {catMeta(c.name).short}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </SwipeArea>

      <DetailModal detail={detail} expenses={expenses} onClose={() => setDetail(null)} onDelete={onDelete} />
    </div>
  );
}
