// Shared by the review screen (preview) and the API (what actually gets saved),
// so what you see is exactly what's stored.
//
// A receipt becomes one expense per category. The receipt's printed total is
// the truth: any difference between it and the items (rounding, an unread
// line) goes to the biggest category so the expenses always add up to it.

const round2 = (n) => Math.round(n * 100) / 100;

export function splitReceipt({ total, items, mode = "split", category = "Other" }) {
  const kept = (items || []).filter((it) => Number(it.amount) > 0);
  const receiptTotal = round2(Number(total) || kept.reduce((s, it) => s + Number(it.amount), 0));

  if (mode === "single" || kept.length === 0) {
    const cat = mode === "single" ? category : kept[0]?.category || category;
    return [{ category: cat || "Other", amount: receiptTotal, items: kept, adjustment: 0 }];
  }

  const groups = new Map();
  for (const it of kept) {
    const cat = it.category || "Other";
    if (!groups.has(cat)) groups.set(cat, { category: cat, amount: 0, items: [], adjustment: 0 });
    const g = groups.get(cat);
    g.amount = round2(g.amount + Number(it.amount));
    g.items.push(it);
  }

  const list = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const diff = round2(receiptTotal - list.reduce((s, g) => s + g.amount, 0));
  if (diff !== 0) {
    list[0].amount = round2(list[0].amount + diff);
    list[0].adjustment = diff;
  }
  // A negative group can only come from a big unexplained difference; fold it away
  return list.filter((g) => g.amount > 0);
}
