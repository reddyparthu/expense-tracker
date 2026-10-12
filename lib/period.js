// Date + period helpers.
//
// Expenses are stored as UTC midnight of the calendar day the user picked
// ("2026-10-12" -> 2026-10-12T00:00:00Z), so an expense's day key is its UTC
// date. "Today" and period anchors use the user's local calendar instead.

const pad = (n) => String(n).padStart(2, "0");

export const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const expenseKey = (e) => new Date(e.date).toISOString().slice(0, 10);

// "YYYY-MM-DD" -> local Date at midnight
export const keyToDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// Monday-based week start
export const startOfWeek = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export const MODES = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
];

// Returns { start, end } as inclusive day keys (null for "all"), plus a label.
export function getRange(mode, anchor) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const today = new Date();

  switch (mode) {
    case "day": {
      const key = localDateKey(anchor);
      const diff = Math.round((keyToDate(localDateKey(today)) - keyToDate(key)) / 86400000);
      const label =
        diff === 0 ? "Today" :
        diff === 1 ? "Yesterday" :
        anchor.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: y === today.getFullYear() ? undefined : "numeric" });
      return { start: key, end: key, label, days: 1 };
    }
    case "week": {
      const s = startOfWeek(anchor);
      const e = addDays(s, 6);
      const isThis = localDateKey(s) === localDateKey(startOfWeek(today));
      const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return {
        start: localDateKey(s),
        end: localDateKey(e),
        label: isThis ? "This Week" : `${fmt(s)} – ${fmt(e)}${e.getFullYear() !== today.getFullYear() ? " " + e.getFullYear() : ""}`,
        days: 7,
      };
    }
    case "month": {
      const isThis = y === today.getFullYear() && m === today.getMonth();
      return {
        start: localDateKey(new Date(y, m, 1)),
        end: localDateKey(new Date(y, m, daysInMonth(y, m))),
        label: isThis ? "This Month" : anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        days: daysInMonth(y, m),
      };
    }
    case "year":
      return {
        start: `${y}-01-01`,
        end: `${y}-12-31`,
        label: y === today.getFullYear() ? `This Year (${y})` : String(y),
        days: (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365,
      };
    default:
      return { start: null, end: null, label: "All Time", days: null };
  }
}

export function shiftAnchor(mode, anchor, dir) {
  const d = new Date(anchor);
  if (mode === "day") d.setDate(d.getDate() + dir);
  else if (mode === "week") d.setDate(d.getDate() + 7 * dir);
  else if (mode === "month") { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else if (mode === "year") d.setFullYear(d.getFullYear() + dir);
  return d;
}

// True if the period containing `anchor` is the current one (can't go further forward)
export function isCurrentPeriod(mode, anchor) {
  if (mode === "all") return true;
  const { end } = getRange(mode, anchor);
  return end >= localDateKey();
}

export const inRange = (key, range) =>
  !range.start || (key >= range.start && key <= range.end);

export const filterByRange = (expenses, range) =>
  expenses.filter((e) => inRange(expenseKey(e), range));

export const sum = (list) => list.reduce((s, e) => s + e.amount, 0);

export const round2 = (n) => Math.round(n * 100) / 100;

export const euro = (n) => `€${n.toFixed(2)}`;
