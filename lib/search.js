// History search: free text plus a few natural filters.
//
//   lidl                 → name / store / category / receipt items contain "lidl"
//   >50  over 50         → amount above €50          (also <, <=, >=, under, below, above)
//   20-50                → amount between €20 and €50
//   €13.99  13,99        → that exact amount
//   october  oct 2025    → that month (English or Dutch month names)
//   2025                 → that year
//
// Every part must match (AND). Text matching ignores case and accents.
import { CATEGORIES } from "./categories";
import { expenseKey } from "./period";

export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const MONTHS = [
  ["january", "januari", "jan"],
  ["february", "februari", "feb"],
  ["march", "maart", "mar", "mrt"],
  ["april", "apr"],
  ["may", "mei"],
  ["june", "juni", "jun"],
  ["july", "juli", "jul"],
  ["august", "augustus", "aug"],
  ["september", "sept", "sep"],
  ["october", "oktober", "oct", "okt"],
  ["november", "nov"],
  ["december", "dec"],
];
const MONTH_OF = new Map(MONTHS.flatMap((names, i) => names.map((n) => [n, i + 1])));
const MONTH_LABEL = MONTHS.map((m) => m[0][0].toUpperCase() + m[0].slice(1));

const num = (s) => parseFloat(String(s).replace(",", "."));
const money = (n) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function parseQuery(input) {
  const q = { terms: [], min: null, max: null, exact: null, month: null, year: null, raw: input || "" };
  // Join "over 50" / "less than 10" / "> 50" into single tokens first
  let text = fold(input)
    .replace(/\b(over|above|more than|meer dan)\s+€?\s*/g, ">")
    .replace(/\b(under|below|less than|minder dan)\s+€?\s*/g, "<")
    .replace(/([<>]=?)\s+/g, "$1");

  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let m;
    if ((m = t.match(/^([<>]=?)€?(\d+(?:[.,]\d{1,2})?)$/))) {
      const v = num(m[2]);
      if (m[1][0] === ">") q.min = m[1] === ">=" ? v : v + 0.001;
      else q.max = m[1] === "<=" ? v : v - 0.001;
    } else if ((m = t.match(/^€?(\d+(?:[.,]\d{1,2})?)\s*[-–]\s*€?(\d+(?:[.,]\d{1,2})?)$/))) {
      q.min = Math.min(num(m[1]), num(m[2]));
      q.max = Math.max(num(m[1]), num(m[2]));
    } else if ((m = t.match(/^€(\d+(?:[.,]\d{1,2})?)$/)) || (m = t.match(/^(\d+[.,]\d{2})$/))) {
      q.exact = num(m[1]);
    } else if (MONTH_OF.has(t)) {
      q.month = MONTH_OF.get(t);
      const next = tokens[i + 1];
      if (next && /^20\d{2}$/.test(next)) {
        q.year = +next;
        i++;
      }
    } else if (/^20\d{2}$/.test(t)) {
      q.year = +t;
    } else {
      const term = t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (term) q.terms.push(term);
    }
  }
  return q;
}

export const isEmptyQuery = (q) =>
  !q.terms.length && q.min === null && q.max === null && q.exact === null && !q.month && !q.year;

// Chips that show the user how their search was understood
export function describeQuery(q) {
  const out = [];
  if (q.exact !== null) out.push(`Amount ${money(q.exact)}`);
  else if (q.min !== null && q.max !== null) out.push(`${money(Math.round(q.min))}–${money(Math.round(q.max))}`);
  else if (q.min !== null) out.push(`Over ${money(Math.round(q.min))}`);
  else if (q.max !== null) out.push(`Under ${money(Math.round(q.max))}`);
  if (q.month) out.push(`${MONTH_LABEL[q.month - 1]}${q.year ? ` ${q.year}` : ""}`);
  else if (q.year) out.push(`Year ${q.year}`);
  for (const t of q.terms) out.push(`“${t}”`);
  return out;
}

const SHORT_OF = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.short]));

function haystack(e) {
  return fold(
    [e.item, e.merchant, e.category, SHORT_OF[e.category], ...(e.items || []).map((it) => it.name)].join(" | ")
  );
}

// Which receipt items matched the text terms (used to open + highlight them)
export function matchingItems(e, q) {
  if (!q.terms.length || !e.items?.length) return [];
  return e.items.filter((it) => q.terms.some((t) => fold(it.name).includes(t)));
}

function amountFits(amount, q) {
  if (q.exact !== null && Math.abs(amount - q.exact) >= 0.005) return false;
  if (q.min !== null && amount < q.min) return false;
  if (q.max !== null && amount > q.max) return false;
  return true;
}

export function matchExpense(e, q) {
  if (q.exact !== null || q.min !== null || q.max !== null) {
    // The amount can be the expense itself, or an item inside a receipt:
    //  - "€1.09" finds a receipt with a €1.09 item
    //  - "creme under 5" checks the crème item's price, not the whole receipt
    const items = e.items || [];
    const candidates = q.terms.length ? matchingItems(e, q) : q.exact !== null ? items : [];
    const fits = amountFits(Number(e.amount), q) || candidates.some((it) => amountFits(Number(it.amount), q));
    if (!fits) return false;
  }
  if (q.month || q.year) {
    const k = expenseKey(e);
    if (q.year && +k.slice(0, 4) !== q.year) return false;
    if (q.month && +k.slice(5, 7) !== q.month) return false;
  }
  if (q.terms.length) {
    const h = haystack(e);
    if (!q.terms.every((t) => h.includes(t))) return false;
  }
  return true;
}

// Most-used names, for quick suggestions when the search box is empty
export function topNames(expenses, limit = 6) {
  const counts = new Map();
  for (const e of expenses) {
    const name = (e.merchant || e.item || "").trim();
    if (!name) continue;
    const k = fold(name);
    const cur = counts.get(k) || { name, n: 0 };
    cur.n++;
    counts.set(k, cur);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((c) => c.name);
}
