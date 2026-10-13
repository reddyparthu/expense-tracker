// Prediction engine — plain statistics on the user's own history, run in the browser.
//
//   detectRecurring(expenses)            → subscriptions & regular bills with next due date
//   forecastMonth(expenses, recurring)   → per-category month-end forecast vs "usual"
//   findAlerts(...)                      → unusual spends, duplicates, categories running high, bills due
//   buildPlan(expenses, budgets)         → everything above in one call
//
// Dates are calendar-day keys ("YYYY-MM-DD"), same as the rest of the app.
import { expenseKey, keyToDate, localDateKey, addDays, daysInMonth } from "./period";

const DAY = 86400000;
const round2 = (n) => Math.round(n * 100) / 100;
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / DAY);

export const nameKey = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function median(list) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const mean = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
const std = (l) => {
  const m = mean(l);
  return Math.sqrt(mean(l.map((x) => (x - m) ** 2)));
};

function addMonthsKey(key, n) {
  const d = keyToDate(key);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())));
  return localDateKey(t);
}

// ---------- recurring bills ----------
const INTERVALS = [
  { id: "weekly", label: "Weekly", min: 6, max: 8, tol: 2, perMonth: 52 / 12 },
  { id: "biweekly", label: "Every 2 weeks", min: 13, max: 16, tol: 3, perMonth: 26 / 12 },
  { id: "monthly", label: "Monthly", min: 26, max: 34, tol: 5, perMonth: 1 },
  { id: "quarterly", label: "Every 3 months", min: 84, max: 97, tol: 10, perMonth: 1 / 3 },
  { id: "yearly", label: "Yearly", min: 350, max: 380, tol: 15, perMonth: 1 / 12 },
];

export function detectRecurring(expenses, today = localDateKey()) {
  // Receipts (groceries etc.) are never subscriptions
  const groups = new Map();
  for (const e of expenses) {
    if (e.receiptId) continue;
    const key = nameKey(e.item);
    if (key.length < 2) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const found = [];
  for (const [key, list] of groups) {
    // One entry per day (a double charge shouldn't look like a 0-day interval)
    const byDay = new Map();
    for (const e of list) {
      const k = expenseKey(e);
      if (!byDay.has(k)) byDay.set(k, e);
    }
    const days = [...byDay.keys()].sort();
    if (days.length < 2) continue;

    const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
    const g = median(gaps);
    const interval = INTERVALS.find((iv) => g >= iv.min && g <= iv.max);
    if (!interval) continue;

    const regular = gaps.filter((x) => Math.abs(x - g) <= interval.tol).length / gaps.length;
    const amounts = days.map((d) => byDay.get(d).amount);
    const amt = median(amounts);
    const cv = amt ? std(amounts) / amt : 1;
    const category = byDay.get(days[days.length - 1]).category;
    const variableOk = category === "Utilities" ? 0.35 : 0.2; // energy bills move around a bit

    // Two charges are enough for a monthly bill only if they're identical
    const enough = days.length >= 3 || (interval.id === "monthly" && cv < 0.01);
    if (!enough || regular < 0.7 || cv > variableOk) continue;

    const last = days[days.length - 1];
    const next = interval.id === "monthly" ? addMonthsKey(last, 1) : localDateKey(addDays(keyToDate(last), Math.round(g)));
    const late = daysBetween(next, today); // >0 means it should already have happened
    if (late > Math.max(interval.tol * 3, 10)) continue; // stopped / cancelled

    const latest = byDay.get(last);
    found.push({
      key,
      name: latest.item,
      category,
      amount: round2(amt),
      interval: interval.id,
      intervalLabel: interval.label,
      monthlyCost: round2(amt * interval.perMonth),
      count: days.length,
      last,
      next,
      dueIn: daysBetween(today, next),
      confidence: days.length >= 4 && regular === 1 && cv < 0.05 ? "high" : days.length >= 3 ? "medium" : "low",
    });
  }
  return found.sort((a, b) => a.next.localeCompare(b.next));
}

// ---------- month forecast ----------
function monthKeyOf(key) {
  return key.slice(0, 7);
}

function previousMonths(today, n) {
  const d = keyToDate(today);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(d.getFullYear(), d.getMonth() - (i + 1), 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function forecastMonth(expenses, recurring, today = localDateKey()) {
  const now = keyToDate(today);
  const thisMonth = monthKeyOf(today);
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  const elapsed = now.getDate();
  const remaining = dim - elapsed;
  const monthEnd = `${thisMonth}-${String(dim).padStart(2, "0")}`;

  const recurringKeys = new Set(recurring.map((r) => r.key));
  const isRecurring = (e) => !e.receiptId && recurringKeys.has(nameKey(e.item));

  const keys = expenses.map(expenseKey);
  const firstKey = keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : today;
  const firstMonth = monthKeyOf(firstKey);

  // Full past months that the user actually tracked (up to 6)
  const pastMonths = previousMonths(today, 6).filter((m) => m >= firstMonth);

  const categories = new Set(expenses.map((e) => e.category));
  const perCat = {};
  for (const c of categories) {
    perCat[c] = { category: c, spent: 0, monthTotals: Object.fromEntries(pastMonths.map((m) => [m, 0])), singles: [] };
  }

  for (const e of expenses) {
    const k = expenseKey(e);
    const m = monthKeyOf(k);
    const pc = perCat[e.category];
    if (m === thisMonth && k <= today) pc.spent += e.amount;
    if (pc.monthTotals[m] !== undefined) pc.monthTotals[m] += e.amount;
    if (!isRecurring(e)) pc.singles.push(e.amount);
  }

  const histDays = pastMonths.reduce((s, m) => s + daysInMonth(+m.slice(0, 4), +m.slice(5, 7) - 1), 0);
  const rows = [];

  for (const pc of Object.values(perCat)) {
    // One-offs (≥3× a typical expense in this category) count once and aren't extrapolated
    const typical = median(pc.singles);
    const isOneOff = (amount) => pc.singles.length >= 4 && amount >= Math.max(typical * 3, 50);

    let histVariable = 0;
    let monthVariable = 0;
    for (const e of expenses) {
      if (e.category !== pc.category || isRecurring(e) || isOneOff(e.amount)) continue;
      const k = expenseKey(e);
      const m = monthKeyOf(k);
      if (m === thisMonth && k <= today) monthVariable += e.amount;
      else if (pastMonths.includes(m)) histVariable += e.amount;
    }

    const pace = monthVariable / elapsed;
    const histRate = histDays ? histVariable / histDays : null;
    const w = histRate === null ? 1 : elapsed / dim; // trust this month more as it goes on
    const rate = histRate === null ? pace : w * pace + (1 - w) * histRate;

    const billsDue = recurring.filter(
      (r) => r.category === pc.category && r.next <= monthEnd && daysBetween(r.next, today) <= 5 && r.next.slice(0, 7) <= thisMonth
    );
    const billsAmount = billsDue.reduce((s, r) => s + r.amount, 0);

    const usualList = pastMonths.map((m) => pc.monthTotals[m]);
    const usual = usualList.length ? median(usualList) : null;
    const forecast = pc.spent + billsAmount + rate * remaining;

    if (pc.spent === 0 && forecast < 1 && !usual) continue;
    rows.push({
      category: pc.category,
      spent: round2(pc.spent),
      forecast: round2(Math.max(forecast, pc.spent)),
      usual: usual === null ? null : round2(usual),
      billsDue,
    });
  }

  rows.sort((a, b) => b.forecast - a.forecast);
  const sum = (f) => round2(rows.reduce((s, r) => s + (r[f] || 0), 0));
  return {
    month: thisMonth,
    elapsed,
    daysInMonth: dim,
    remaining,
    monthsOfHistory: pastMonths.length,
    quality: pastMonths.length >= 3 ? "good" : pastMonths.length >= 1 ? "early" : "rough",
    rows,
    spent: sum("spent"),
    forecast: sum("forecast"),
    usual: rows.some((r) => r.usual !== null) ? sum("usual") : null,
  };
}

// ---------- budgets ----------
export function suggestBudgets(forecast) {
  const out = {};
  for (const r of forecast.rows) {
    const base = r.usual ?? r.forecast;
    if (base > 0) out[r.category] = Math.max(10, Math.ceil((base * 1.05) / 10) * 10);
  }
  return out;
}

export function budgetStatus(row, budget) {
  if (!budget) return null;
  if (row.spent > budget) return { state: "over", label: "Over budget", pct: row.spent / budget };
  if (row.forecast > budget * 1.02) return { state: "risk", label: "At risk", pct: row.spent / budget };
  return { state: "ok", label: "On track", pct: row.spent / budget };
}

// ---------- alerts ----------
export function findAlerts(expenses, recurring, forecast, budgets = {}, today = localDateKey()) {
  const alerts = [];
  const since = localDateKey(addDays(keyToDate(today), -14));
  const recent = expenses.filter((e) => {
    const k = expenseKey(e);
    return k >= since && k <= today;
  });

  // Unusually large compared with the same store/name, or with the category
  const byName = new Map();
  const byCat = new Map();
  for (const e of expenses) {
    const nk = nameKey(e.item);
    if (!byName.has(nk)) byName.set(nk, []);
    byName.get(nk).push(e);
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category).push(e.amount);
  }
  for (const e of recent) {
    const others = (byName.get(nameKey(e.item)) || []).filter((o) => o !== e).map((o) => o.amount);
    if (others.length >= 3) {
      const m = median(others);
      if (e.amount >= m * 2.5 && e.amount - m >= 10) {
        alerts.push({
          id: `big-${e._id}`,
          kind: "unusual",
          severity: 2,
          title: `${e.item}: ${fmt(e.amount)}`,
          text: `That's ${(e.amount / m).toFixed(1)}× what you usually spend there (${fmt(m)}).`,
          date: expenseKey(e),
        });
        continue;
      }
    }
    const cat = byCat.get(e.category) || [];
    const cm = median(cat);
    if (cat.length >= 6 && e.amount >= Math.max(cm * 4, 25) && !e.receiptId) {
      alerts.push({
        id: `bigcat-${e._id}`,
        kind: "unusual",
        severity: 1,
        title: `Large ${e.category} expense`,
        text: `${e.item} (${fmt(e.amount)}) is well above your typical ${e.category.toLowerCase()} spend of ${fmt(cm)}.`,
        date: expenseKey(e),
      });
    }
  }

  // Possible double charge: same name and amount within a day (not parts of one receipt)
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i];
      const b = recent[j];
      if (a.receiptId && a.receiptId === b.receiptId) continue;
      if (nameKey(a.item) !== nameKey(b.item) || Math.abs(a.amount - b.amount) > 0.001) continue;
      if (Math.abs(daysBetween(expenseKey(a), expenseKey(b))) > 1) continue;
      alerts.push({
        id: `dup-${a._id}-${b._id}`,
        kind: "duplicate",
        severity: 2,
        title: `Possible duplicate: ${a.item}`,
        text: `${fmt(a.amount)} was recorded twice around ${prettyDate(expenseKey(a))}. Delete one if it's a mistake.`,
        date: expenseKey(a),
      });
    }
  }

  // Categories running high (only once the month is a week in)
  if (forecast.elapsed >= 7) {
    for (const r of forecast.rows) {
      const budget = budgets[r.category];
      const status = budgetStatus(r, budget);
      if (status?.state === "over") {
        alerts.push({
          id: `over-${r.category}`,
          kind: "budget",
          severity: 3,
          title: `${r.category} is over budget`,
          text: `${fmt(r.spent)} spent of your ${fmt(budget)} budget.`,
        });
      } else if (status?.state === "risk") {
        alerts.push({
          id: `risk-${r.category}`,
          kind: "budget",
          severity: 2,
          title: `${r.category} may go over budget`,
          text: `Heading for about ${fmt(r.forecast)} against a ${fmt(budget)} budget.`,
        });
      } else if (!budget && r.usual && r.forecast > r.usual * 1.25 && r.forecast - r.usual >= 20) {
        alerts.push({
          id: `high-${r.category}`,
          kind: "trend",
          severity: 1,
          title: `${r.category} is running high`,
          text: `On track for about ${fmt(r.forecast)} this month — ${fmt(r.forecast - r.usual)} more than usual.`,
        });
      }
    }
  }

  // Bills: due very soon, or late
  for (const r of recurring) {
    if (r.dueIn >= 0 && r.dueIn <= 3) {
      alerts.push({
        id: `due-${r.key}`,
        kind: "bill",
        severity: 0,
        title: `${r.name} ${r.dueIn === 0 ? "is due today" : `renews in ${r.dueIn} day${r.dueIn > 1 ? "s" : ""}`}`,
        text: `${fmt(r.amount)} · ${r.intervalLabel.toLowerCase()}`,
      });
    } else if (r.dueIn < -5) {
      alerts.push({
        id: `late-${r.key}`,
        kind: "bill",
        severity: 1,
        title: `${r.name} hasn't shown up yet`,
        text: `Usually around ${prettyDate(r.next)}. Not logged yet — or did you cancel it?`,
      });
    }
  }

  return alerts.sort((a, b) => b.severity - a.severity);
}

function fmt(n) {
  return `€${Number(n).toFixed(2)}`;
}

function prettyDate(key) {
  return keyToDate(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------- everything at once ----------
export function buildPlan(expenses, budgets = {}, today = localDateKey()) {
  const recurring = detectRecurring(expenses, today);
  const forecast = forecastMonth(expenses, recurring, today);
  const alerts = findAlerts(expenses, recurring, forecast, budgets, today);
  return {
    today,
    recurring,
    forecast,
    alerts,
    suggestedBudgets: suggestBudgets(forecast),
    subscriptionsPerMonth: round2(recurring.reduce((s, r) => s + r.monthlyCost, 0)),
  };
}
