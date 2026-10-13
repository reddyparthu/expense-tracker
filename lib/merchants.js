// Well-known stores and the category their receipts usually belong to.
// `match` is tested against the top lines of a receipt (lower-cased).
export const MERCHANTS = [
  // Groceries
  { name: "Lidl", match: /\blidl\b/, category: "Food & Groceries" },
  { name: "Aldi", match: /\baldi\b/, category: "Food & Groceries" },
  { name: "Albert Heijn", match: /\balbert\s*heijn\b|^ah$|^ah\s+(to\s*go|xl)\b/, category: "Food & Groceries" },
  { name: "Jumbo", match: /\bjumbo\b/, category: "Food & Groceries" },
  { name: "Plus", match: /^plus\b|\bplus\s+supermarkt\b/, category: "Food & Groceries" },
  { name: "Dirk", match: /\bdirk\b/, category: "Food & Groceries" },
  { name: "Vomar", match: /\bvomar\b/, category: "Food & Groceries" },
  { name: "Hoogvliet", match: /\bhoogvliet\b/, category: "Food & Groceries" },
  { name: "Dekamarkt", match: /\bdekamarkt\b/, category: "Food & Groceries" },
  { name: "Coop", match: /\bcoop\b/, category: "Food & Groceries" },
  { name: "Spar", match: /\bspar\b/, category: "Food & Groceries" },
  { name: "Ekoplaza", match: /\bekoplaza\b/, category: "Food & Groceries" },
  { name: "Rewe", match: /\brewe\b/, category: "Food & Groceries" },
  { name: "Edeka", match: /\bedeka\b/, category: "Food & Groceries" },
  { name: "Kaufland", match: /\bkaufland\b/, category: "Food & Groceries" },
  { name: "Netto", match: /\bnetto\s*(marken|markt)?\b(?!\s*\d)/, category: "Food & Groceries" },
  { name: "Penny", match: /\bpenny\b/, category: "Food & Groceries" },
  { name: "Carrefour", match: /\bcarrefour\b/, category: "Food & Groceries" },
  { name: "Delhaize", match: /\bdelhaize\b/, category: "Food & Groceries" },
  { name: "Colruyt", match: /\bcolruyt\b/, category: "Food & Groceries" },
  { name: "Auchan", match: /\bauchan\b/, category: "Food & Groceries" },
  { name: "Leclerc", match: /\bleclerc\b/, category: "Food & Groceries" },
  { name: "Intermarché", match: /\bintermarch[eé]\b/, category: "Food & Groceries" },
  { name: "Mercadona", match: /\bmercadona\b/, category: "Food & Groceries" },
  { name: "Tesco", match: /\btesco\b/, category: "Food & Groceries" },
  { name: "Sainsbury's", match: /\bsainsbury/, category: "Food & Groceries" },
  { name: "Asda", match: /\basda\b/, category: "Food & Groceries" },
  { name: "Waitrose", match: /\bwaitrose\b/, category: "Food & Groceries" },
  { name: "Morrisons", match: /\bmorrisons\b/, category: "Food & Groceries" },
  // Eating out
  { name: "McDonald's", match: /\bmc\s*donald/, category: "Food & Groceries" },
  { name: "Burger King", match: /\bburger\s*king\b/, category: "Food & Groceries" },
  { name: "KFC", match: /\bkfc\b/, category: "Food & Groceries" },
  { name: "Subway", match: /\bsubway\b/, category: "Food & Groceries" },
  { name: "Starbucks", match: /\bstarbucks\b/, category: "Food & Groceries" },
  { name: "Domino's", match: /\bdomino/, category: "Food & Groceries" },
  { name: "New York Pizza", match: /\bnew\s*york\s*pizza\b/, category: "Food & Groceries" },
  // Drugstores / pharmacy
  { name: "Kruidvat", match: /\bkruidvat\b/, category: "Health" },
  { name: "Etos", match: /\betos\b/, category: "Health" },
  { name: "dm", match: /^dm\b|\bdm[\s-]drogerie\b/, category: "Health" },
  { name: "Rossmann", match: /\brossmann\b/, category: "Health" },
  { name: "Boots", match: /\bboots\b/, category: "Health" },
  { name: "Pharmacy", match: /\bapotheek\b|\bapotheke\b|\bpharmacy\b|\bpharmacie\b|\bfarmacia\b/, category: "Health" },
  // Shopping
  { name: "Action", match: /^action\b/, category: "Shopping" },
  { name: "HEMA", match: /\bhema\b/, category: "Shopping" },
  { name: "Primark", match: /\bprimark\b/, category: "Shopping" },
  { name: "Zara", match: /\bzara\b/, category: "Shopping" },
  { name: "H&M", match: /\bh\s*&\s*m\b|\bhennes/, category: "Shopping" },
  { name: "IKEA", match: /\bikea\b/, category: "Shopping" },
  { name: "MediaMarkt", match: /\bmedia\s*markt\b/, category: "Shopping" },
  { name: "Decathlon", match: /\bdecathlon\b/, category: "Shopping" },
  { name: "Blokker", match: /\bblokker\b/, category: "Shopping" },
  { name: "Xenos", match: /\bxenos\b/, category: "Shopping" },
  { name: "Gamma", match: /\bgamma\b/, category: "Rent & Housing" },
  { name: "Praxis", match: /\bpraxis\b/, category: "Rent & Housing" },
  { name: "Karwei", match: /\bkarwei\b/, category: "Rent & Housing" },
  // Transport / fuel
  { name: "Shell", match: /\bshell\b/, category: "Transport" },
  { name: "BP", match: /^bp\b/, category: "Transport" },
  { name: "Esso", match: /\besso\b/, category: "Transport" },
  { name: "Texaco", match: /\btexaco\b/, category: "Transport" },
  { name: "TotalEnergies", match: /\btotal\s*energies\b/, category: "Transport" },
  { name: "Tango", match: /\btango\b/, category: "Transport" },
  { name: "TinQ", match: /\btinq\b/, category: "Transport" },
  { name: "Aral", match: /\baral\b/, category: "Transport" },
  { name: "NS", match: /^ns\b|\bnederlandse\s*spoorwegen\b/, category: "Transport" },
  // Entertainment
  { name: "Pathé", match: /\bpath[eé]\b/, category: "Entertainment" },
  { name: "Vue", match: /^vue\b/, category: "Entertainment" },
  { name: "Kinepolis", match: /\bkinepolis\b/, category: "Entertainment" },
];

export function findMerchant(lines) {
  const top = lines.slice(0, 8).map((l) => l.toLowerCase().trim());
  for (const line of top) {
    for (const m of MERCHANTS) {
      if (m.match.test(line)) return m;
    }
  }
  return null;
}
