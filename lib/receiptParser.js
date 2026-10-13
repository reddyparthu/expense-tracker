// Turns OCR lines (or pasted text) into a structured receipt:
//   { merchant, date, total, items[], itemsTotal, difference, totalSource }
//
// Works line by line, top to bottom:
//   header (store) → items (with quantity/weight/discount lines) → TOTAL → payment/VAT (ignored)
// Item parsing stops at the total line, so card/VAT/change lines can't become items.
import { findMerchant } from "./merchants";

// ---------- helpers ----------

// Money like 1,09  12.50  -0,20  0,20-  €3.99 (not dates like 12.10.26 or times).
// A minus only counts when attached ("-0,20"), so "Milk - €2.50" stays positive.
const MONEY = /(-)?[€$£]?\s*(?<![\d.,])(\d{1,5})[.,](\d{2})(?![\d.,]*\d)(\s*-(?!\d))?/g;

function moneyIn(text) {
  const out = [];
  MONEY.lastIndex = 0;
  let m;
  while ((m = MONEY.exec(text)) !== null) {
    const value = parseFloat(`${m[2]}.${m[3]}`);
    const negative = Boolean(m[1] || m[4]);
    out.push({ value: negative ? -value : value, index: m.index, length: m[0].length, raw: m[0] });
  }
  return out;
}

const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
const round2 = (n) => Math.round(n * 100) / 100;
const letterCount = (s) => (s.match(/\p{L}/gu) || []).length;

function normalize(line) {
  return String(line)
    .replace(/[×✕✖*]/g, " x ")
    .replace(/[−–—]/g, "-")
    .replace(/\s{2,}/g, " ")
    // "T O T A A L" → "TOTAAL" (spaced-out headings on some receipts)
    .replace(/\b(?:\p{L}\s){3,}\p{L}\b/gu, (m) => m.replace(/\s/g, ""))
    .trim();
}

// ---------- keyword sets (NL / EN / DE / FR / ES / IT) ----------
const SUBTOTAL = /\bsub\s*-?\s*tot|\bzwischensumme\b|\bsous[-\s]total\b|\bsubtotaal\b/i;
const TOTAL_STRONG =
  /\b(te\s*betalen|to\s*pay|amount\s*due|balance\s*due|zu\s*zahlen|gesamt\s*betrag|gesamtsumme|endbetrag|grand\s*total|[aà]\s*payer|total\s*ttc|total\s*a\s*pagar|totale\s*complessivo)\b/i;
const TOTAL = /\b(totaal|total|totale|gesamt|summe|montant|bedrag|ttl)\b/i;
// After the total anything goes; before it, only lines that clearly start as a payment
const PAYMENT_START =
  /^(pin|pinnen|gepind|visa|maestro|mastercard|v\s*pay|contant|cash|betaald|paid|girocard|ec[-\s]?karte|kreditkarte|debit|credit|contactless)\b/i;
const PAYMENT =
  /\b(pin|pinnen|gepind|card|cash|contant|wisselgeld|change|visa|maestro|mastercard|v\s*pay|betaald|paid|girocard|ec[-\s]?karte|bar|kreditkarte|debit|credit|contactless|apple\s*pay|google\s*pay|tendered|terug|r[uü]ckgeld|esp[eè]ces|carte|efectivo|tarjeta)\b/i;
// VAT summary lines only — not products like "Yoghurt 0% vet"
const VAT =
  /^(btw|mwst|ust|vat|tax|iva|tva|gst|steuer)\b|\b(btw|mwst|vat|tax)\s*\d|\d\s*%\s*(btw|mwst|vat|tax|ust)\b|\b(excl|incl)\.?\s*(btw|mwst|vat|tax)\b/i;
const DISCOUNT =
  /\b(korting|rabatt|discount|actie|bonus|voordeel|aanbieding|coupon|preisvorteil|nachlass|remise|sconto|descuento|savings?|saved|bespaart|prijsvoordeel|promo|gratis)\b/i;
// "Your savings: 0,30" recaps discounts already applied above — never subtract it twice
const SAVINGS_SUMMARY =
  /\b(uw\s*voordeel|totaal\s*(korting|voordeel)|total\s*(savings|discount)|you\s*saved|u\s*bespaart|ihre\s*ersparnis|sie\s*sparen|gespaard|bespaard)\b/i;
const DEPOSIT =/\b(statiegeld|pfand|deposit|emballage|leergut|consigne)\b/i;
const JUNK =
  /\b(bon|kassabon|kasbon|kassa|filiaal|transactie|transaction|terminal|receipt|invoice|factuur|rechnung|beleg|bedankt|dank|danke|thank|merci|gracias|grazie|welkom|welcome|tot\s*ziens|www|http|tel|telefoon|phone|fax|kvk|btw-?nr|ust-?id|vat\s*no|klant|kunde|customer|openingstijden|opening|kaartnr|card\s*no|autorisatie|auth|aid|seq|ref|leesmethode|wechselgeld|kopie|copy|merchant|winkel|store|shop\s*id|cashier|kassier|bediende)\b/i;
const MONTHS = {
  jan: 1, feb: 2, mrt: 3, maa: 3, mar: 3, apr: 4, mei: 5, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12, dez: 12,
};

// ---------- quantities ----------
// "0,512 kg x 2,99 /kg"   "2 x 0,29"   "3 St x 1,49"   "2 x BANANEN"
function parseQty(text) {
  let m = text.match(/(\d+[.,]\d{1,3})\s*kg\s*(?:x|@|a|à)\s*[€]?\s*(\d+[.,]\d{2})(?:\s*(?:eur)?\s*(?:\/|per)\s*kg)?/i);
  if (m) {
    return { qty: parseFloat(m[1].replace(",", ".")), unit: parseFloat(m[2].replace(",", ".")), isWeight: true, raw: m[0] };
  }
  m = text.match(/(?:^|\s)(\d{1,3})\s*(?:st(?:uks?|k)?\.?\s*|pcs?\.?\s*)?x\s*[€]?\s*(\d+[.,]\d{2})/i);
  if (m) {
    return { qty: parseInt(m[1], 10), unit: parseFloat(m[2].replace(",", ".")), isWeight: false, raw: m[0].trim() };
  }
  m = text.match(/^(\d{1,2})\s*x\s+(?=\p{L})/iu);
  if (m) return { qty: parseInt(m[1], 10), unit: null, isWeight: false, raw: m[0].trim() };
  return null;
}

// ---------- names ----------
function cleanName(text, price, qty) {
  let before = text.slice(0, price ? price.index : text.length);
  let after = price ? text.slice(price.index + price.length) : "";
  // Text after the price is usually just a VAT code ("1,09 B"); keep it only if it's a real word
  if (letterCount(after) < 3) after = "";
  let s = `${before} ${after}`;
  if (qty) s = s.replace(qty.raw, " ");
  for (const m of moneyIn(s).reverse()) s = s.slice(0, m.index) + " " + s.slice(m.index + m.length);
  return s
    .replace(/[€$£]|\beur\b/gi, " ")
    .replace(/^\s*\d{1,3}[.)]\s+/, "") // "1. Rice"
    .replace(/^\s*\d{4,}\s+/, "") // article codes
    .replace(/\b\d+\s*x\b/gi, " ")
    .replace(/^[\s\-:|.,…>•·]+|[\s\-:|.,…>•·]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatName(name) {
  if (!name) return "";
  // Only re-case shouty receipt text; leave mixed-case names alone
  if (name !== name.toUpperCase()) return name;
  return name
    .split(" ")
    .map((w) => (w.length <= 2 || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

// ---------- date ----------
function toKey(y, m, d) {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const now = new Date();
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
  if (dt > max || dt < min) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function findDate(lines) {
  for (const raw of lines) {
    const line = String(raw);
    let m = line.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/);
    if (m) {
      const k = toKey(+m[1], +m[2], +m[3]);
      if (k) return k;
    }
    m = line.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})\b/);
    if (m) {
      // European order first (day-month), then month-day as a fallback
      const k = toKey(+m[3], +m[2], +m[1]) || toKey(+m[3], +m[1], +m[2]);
      if (k) return k;
    }
    m = line.match(/\b(\d{1,2})\s*\.?\s*(jan|feb|mrt|maa|mar|apr|mei|may|mai|jun|jul|aug|sep|okt|oct|nov|dec|dez)\p{L}*\.?\s*(20\d{2}|\d{2})?\b/iu);
    if (m) {
      const y = m[3] ? +m[3] : new Date().getFullYear();
      const k = toKey(y, MONTHS[m[2].toLowerCase()], +m[1]);
      if (k) return k;
    }
  }
  return null;
}

// ---------- merchant ----------
function guessMerchantName(lines) {
  for (const raw of lines.slice(0, 4)) {
    const line = normalize(raw);
    if (letterCount(line) < 3) continue;
    if (moneyIn(line).length) continue;
    if (JUNK.test(line) || /\d{4}\s?[a-z]{2}\b/i.test(line) || /\bstraat|weg|laan|plein|str\.|street|road\b/i.test(line)) continue;
    if (letterCount(line) / line.replace(/\s/g, "").length < 0.6) continue;
    return formatName(line.slice(0, 40));
  }
  return null;
}

// ---------- main ----------
// options.guessStore: false for pasted lists, which have no store header
export function parseReceipt(input, { guessStore = true } = {}) {
  const rawLines = (Array.isArray(input) ? input : String(input || "").split("\n"))
    .map((l) => (typeof l === "string" ? l : l.text))
    .map((l) => (l || "").trim())
    .filter(Boolean);
  const lines = rawLines.map(normalize);

  const merchantMatch = findMerchant(lines);
  const merchant = merchantMatch
    ? { name: merchantMatch.name, category: merchantMatch.category }
    : { name: guessStore ? guessMerchantName(lines) : null, category: null };

  const items = [];
  const totals = [];
  const payments = [];
  let subtotal = null;
  let looseDiscount = 0;
  let pendingQty = null;
  let totalSeen = false;
  let nameOnly = null; // previous line had a product name but no price

  const isPriceOnly = (l) => /^[€$£]?\s*-?\s*\d{1,5}[.,]\d{2}\s*-?\s*[A-Z]?$/.test(l);

  for (let i = 0; i < lines.length; i++) {
    let text = lines[i];
    // Name on one line, price alone on the next → join them
    if (!moneyIn(text).length && i + 1 < lines.length && isPriceOnly(lines[i + 1]) && letterCount(text) >= 2) {
      text = `${text} ${lines[i + 1]}`;
      i++;
    }
    const monies = moneyIn(text);
    if (!monies.length) {
      // Remember a bare product name: a weight/quantity line may follow ("BANANEN" / "0,512 kg x 1,99 1,02")
      const looksLikeName =
        !totalSeen &&
        letterCount(text) >= 2 &&
        !JUNK.test(text) &&
        !TOTAL.test(text) &&
        !findDate([text]) &&
        !/\b(straat|weg|laan|plein|str\.|street|road)\b/i.test(text);
      nameOnly = looksLikeName ? text : null;
      continue;
    }
    const nameAbove = nameOnly;
    nameOnly = null;
    const price = monies[monies.length - 1];

    if (SUBTOTAL.test(text)) {
      subtotal = Math.abs(price.value);
      continue;
    }
    if (SAVINGS_SUMMARY.test(text)) continue;
    if ((TOTAL_STRONG.test(text) || TOTAL.test(text)) && !DISCOUNT.test(text)) {
      totals.push({ value: Math.abs(price.value), strong: TOTAL_STRONG.test(text) });
      totalSeen = true;
      continue;
    }
    if (totalSeen) {
      if (PAYMENT.test(text)) payments.push(Math.abs(price.value));
      continue; // after the total: payment, VAT, change, loyalty… never items
    }
    if (PAYMENT_START.test(text) && !DISCOUNT.test(text)) {
      payments.push(Math.abs(price.value));
      continue;
    }
    if (VAT.test(text) && !DISCOUNT.test(text)) continue;
    if (JUNK.test(text) && !DISCOUNT.test(text) && !DEPOSIT.test(text)) continue;

    const qty = parseQty(text);

    // A line that is only a quantity ("2 x 0,29") belongs to the item before or after it
    if (qty && qty.unit !== null) {
      const rest = cleanName(text, price, qty);
      if (letterCount(rest) < 2) {
        const prev = items[items.length - 1];
        const lineTotal = monies.length > 1 ? Math.abs(price.value) : round2(qty.qty * qty.unit);
        if (nameAbove) {
          items.push({
            raw: `${nameAbove} ${text}`,
            name: formatName(cleanName(nameAbove, null, null)),
            amount: lineTotal,
            qty: qty.qty,
            unit: qty.unit,
            isWeight: qty.isWeight,
          });
        } else if (prev && !prev.qty && approx(prev.amount, lineTotal, 0.03)) {
          Object.assign(prev, { qty: qty.qty, unit: qty.unit, isWeight: qty.isWeight });
        } else {
          pendingQty = { ...qty, lineTotal };
        }
        continue;
      }
    }

    // Discounts reduce the item right above them
    if (price.value < 0 || DISCOUNT.test(text)) {
      const amount = Math.abs(price.value);
      const prev = items[items.length - 1];
      if (prev && prev.amount - amount > -0.001) {
        prev.discount = round2((prev.discount || 0) + amount);
        prev.amount = round2(prev.amount - amount);
      } else {
        looseDiscount = round2(looseDiscount + amount);
      }
      continue;
    }

    let name = cleanName(text, price, qty);
    // Quantity column at the start ("2 COCA COLA 4,38" / "1 AH MELK 1,19")
    let leadQty = null;
    const lead = name.match(/^(\d{1,2})\s+(?=\p{L}{2})/u);
    if (lead) {
      leadQty = parseInt(lead[1], 10);
      name = name.slice(lead[0].length);
    }
    if (letterCount(name) < 2) continue;
    if (price.value <= 0 || price.value >= 10000) continue;

    // "BANANEN 2 x 0,29" (no line total) → amount is qty × unit
    let amount = Math.abs(price.value);
    if (qty && qty.unit !== null && monies.length === 1 && approx(amount, qty.unit)) amount = round2(qty.qty * qty.unit);

    const item = { raw: text, name: formatName(name), amount };
    if (qty) {
      item.qty = qty.qty;
      item.unit = qty.unit ?? round2(amount / qty.qty);
      item.isWeight = qty.isWeight;
    } else if (pendingQty && approx(amount, pendingQty.lineTotal, 0.03)) {
      Object.assign(item, { qty: pendingQty.qty, unit: pendingQty.unit, isWeight: pendingQty.isWeight });
    } else if (leadQty && leadQty > 1) {
      Object.assign(item, { qty: leadQty, unit: round2(amount / leadQty), isWeight: false });
    }
    pendingQty = null;
    if (DEPOSIT.test(text)) item.isDeposit = true;
    items.push(item);
  }

  if (looseDiscount && items.length) {
    // A discount with no item above it: take it off the most expensive item
    const top = items.reduce((m, it) => (it.amount > m.amount ? it : m), items[0]);
    top.discount = round2((top.discount || 0) + looseDiscount);
    top.amount = round2(top.amount - looseDiscount);
  }

  const itemsTotal = round2(items.reduce((s, it) => s + it.amount, 0));

  // Pick the total: the one matching the items, else the strongest/last one, else payment, else items
  let total = null;
  let totalSource = "items";
  if (totals.length) {
    const match = totals.find((t) => approx(t.value, itemsTotal, 0.01));
    const strong = totals.filter((t) => t.strong);
    total = (match || strong[strong.length - 1] || totals[totals.length - 1]).value;
    totalSource = "receipt";
  } else if (payments.length) {
    total = Math.max(...payments);
    totalSource = "payment";
  } else if (subtotal !== null) {
    total = subtotal;
    totalSource = "receipt";
  } else {
    total = itemsTotal;
  }

  return {
    merchant,
    date: findDate(rawLines),
    total: round2(total || 0),
    totalSource,
    items,
    itemsTotal,
    difference: round2((total || 0) - itemsTotal),
    lines: rawLines,
  };
}
